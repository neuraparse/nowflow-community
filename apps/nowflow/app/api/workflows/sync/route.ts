import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { publishWorkflowUpdate } from '@/lib/redis-pubsub'
import { calculateWorkflowSize, canUseStorage } from '@/lib/storage-limits'
import { syncTriggerFromWorkflowState } from '@/lib/triggers/utils'
import { canCreateWorkflow } from '@/lib/workflow-limits'
import { ensureDefaultWorkflow } from '@/lib/workflows/default-workflow'
import { db } from '@/db'
import { workflow, workspace } from '@/db/schema'

const logger = createLogger('WorkflowAPI')

// Define marketplace data schema
const MarketplaceDataSchema = z
  .object({
    id: z.string(),
    status: z.enum(['owner', 'temp']),
  })
  .nullable()
  .optional()

// Schema for workflow data
const WorkflowStateSchema = z.object({
  blocks: z.record(z.string(), z.any()),
  edges: z.array(z.any()),
  loops: z.record(z.string(), z.any()),
  groups: z.record(z.string(), z.any()).optional(), // FIX: Add groups to schema
  selectedNodeIds: z.array(z.string()).optional(), // FIX: Add selectedNodeIds to schema
  lastSaved: z.number().optional(),
  isDeployed: z.boolean().optional(),
  deployedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
  isPublished: z.boolean().optional(),
  marketplaceData: MarketplaceDataSchema,
  toolParams: z.record(z.string(), z.any()).optional(), // CRITICAL FIX: Add toolParams for cross-device API key sync
})

const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  state: WorkflowStateSchema,
  marketplaceData: MarketplaceDataSchema,
  workspaceId: z.string().optional(),
})

const SyncPayloadSchema = z.object({
  workflows: z.record(z.string(), WorkflowSchema),
  workspaceId: z.string().optional(),
})

export async function GET(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const url = new URL(request.url)
  const workspaceId = url.searchParams.get('workspaceId')

  try {
    // Get the session directly in the API route
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized workflow access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // If workspaceId is provided, verify it exists first
    if (workspaceId) {
      const workspaceExists = await db
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .then((rows: any) => rows.length > 0)

      if (!workspaceExists) {
        logger.warn(
          `[${requestId}] Attempt to fetch workflows for non-existent workspace: ${workspaceId}`
        )
        return NextResponse.json(
          { error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' },
          { status: 404 }
        )
      }

      // Migrate any orphaned workflows to this workspace
      await migrateOrphanedWorkflows(userId, workspaceId)
    }

    // Fetch workflows for the user (ONLY non-deleted workflows)
    let ownedWorkflows
    let sharedWorkflows

    const selectFields = {
      id: workflow.id,
      userId: workflow.userId,
      workspaceId: workflow.workspaceId,
      name: workflow.name,
      description: workflow.description,
      state: workflow.state,
      color: workflow.color,
      icon: workflow.icon,
      lastSynced: workflow.lastSynced,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      isDeployed: workflow.isDeployed,
      deployedState: workflow.deployedState,
      deployedAt: workflow.deployedAt,
      lastRunAt: workflow.lastRunAt,
      marketplaceData: workflow.marketplaceData,
      collaborators: workflow.collaborators,
      deletedAt: workflow.deletedAt, // Include for filtering
    }

    if (workspaceId) {
      // Filter by user ID, workspace ID, and non-deleted
      ownedWorkflows = await db
        .select(selectFields)
        .from(workflow)
        .where(
          and(
            eq(workflow.userId, userId),
            eq(workflow.workspaceId, workspaceId),
            isNull(workflow.deletedAt) // Only return non-deleted workflows
          )
        )
    } else {
      // Filter by user ID and non-deleted only, including workflows without workspace IDs
      ownedWorkflows = await db
        .select(selectFields)
        .from(workflow)
        .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))
    }

    // Fetch workflows where user is a collaborator (NOT the owner)
    // IMPORTANT: Shared workflows can be in ANY workspace, not just the active one
    // Uses PostgreSQL JSONB containment operator to filter at the DB level
    // instead of loading ALL workflows into memory.
    const sharedWorkflowRows = await db
      .select(selectFields)
      .from(workflow)
      .where(
        and(
          isNull(workflow.deletedAt),
          ne(workflow.userId, userId), // Exclude owned workflows
          sql`${workflow.collaborators}::jsonb @> ${JSON.stringify([{ userId }])}::jsonb`
        )
      )

    // Pre-parse collaborators for role extraction in the response
    const workflowsWithParsedCollaborators = sharedWorkflowRows.map((w: any) => {
      let parsedCollaborators: any[] = []
      if (w.collaborators) {
        try {
          parsedCollaborators = Array.isArray(w.collaborators)
            ? w.collaborators
            : JSON.parse(w.collaborators as string)
        } catch (error) {
          logger.error('Error parsing collaborators', { workflowId: w.id, error })
        }
      }
      return { ...w, parsedCollaborators }
    })

    sharedWorkflows = workflowsWithParsedCollaborators

    if (sharedWorkflows.length > 0) {
      logger.info(`Found ${sharedWorkflows.length} shared workflow(s) for user`, {
        userId,
        activeWorkspace: workspaceId,
        sharedWorkflowIds: sharedWorkflows.map((w: any) => w.id),
      })
    }

    let totalCount = ownedWorkflows.length + sharedWorkflows.length

    if (totalCount === 0) {
      const bootstrapResult = await ensureDefaultWorkflow({
        userId,
        workspaceId,
        userName: session.user.name,
        reason: 'workflows:sync',
      })

      if (bootstrapResult.created) {
        const shouldFilterByWorkspace = Boolean(workspaceId)
        const effectiveWorkspaceId = workspaceId || bootstrapResult.workspaceId

        if (shouldFilterByWorkspace && effectiveWorkspaceId) {
          ownedWorkflows = await db
            .select(selectFields)
            .from(workflow)
            .where(
              and(
                eq(workflow.userId, userId),
                eq(workflow.workspaceId, effectiveWorkspaceId),
                isNull(workflow.deletedAt)
              )
            )
        } else {
          ownedWorkflows = await db
            .select(selectFields)
            .from(workflow)
            .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))
        }

        totalCount = ownedWorkflows.length + sharedWorkflows.length
      }
    }

    logger.debug(`[${requestId}] Workflow sync results`, {
      userId,
      workspaceId,
      ownedCount: ownedWorkflows.length,
      sharedCount: sharedWorkflows.length,
      totalCount,
    })

    // Return the workflows with shared flag
    const workflows = [
      ...ownedWorkflows.map((w: any) => ({ ...w, isShared: false, role: 'owner' })),
      ...sharedWorkflows.map((w: any) => {
        // Find user's role in collaborators (using pre-parsed collaborators)
        let role = 'viewer'
        const userCollab = w.parsedCollaborators.find((c: any) => c.userId === userId)
        if (userCollab) role = userCollab.role

        // Remove parsedCollaborators from response (internal optimization only)
        const { parsedCollaborators, ...workflowData } = w
        return { ...workflowData, isShared: true, role }
      }),
    ]

    return NextResponse.json({ data: workflows }, { status: 200 })
  } catch (error: any) {
    logger.error(`[${requestId}] Workflow fetch error`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Helper function to migrate orphaned workflows to a workspace
async function migrateOrphanedWorkflows(userId: string, workspaceId: string) {
  try {
    // Find non-deleted workflows without workspace IDs for this user
    const orphanedWorkflows = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(
        and(
          eq(workflow.userId, userId),
          isNull(workflow.workspaceId),
          isNull(workflow.deletedAt) // Only migrate non-deleted workflows
        )
      )

    if (orphanedWorkflows.length === 0) {
      return // No orphaned workflows to migrate
    }

    logger.info(
      `Migrating ${orphanedWorkflows.length} orphaned workflows to workspace ${workspaceId}`
    )

    // Update each workflow to associate it with the provided workspace
    for (const { id } of orphanedWorkflows) {
      await db
        .update(workflow)
        .set({
          workspaceId: workspaceId,
          updatedAt: new Date(),
        })
        .where(eq(workflow.id, id))
    }
  } catch (error) {
    logger.error('Error migrating orphaned workflows:', error)
    // Continue execution even if migration fails
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized workflow sync attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Safe JSON parsing with error handling
    let body: any
    try {
      const bodyText = await req.text()

      // Debug logging (now throttled at logger level)
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[${requestId}] Raw request body length: ${bodyText.length}`)
      }

      if (!bodyText || bodyText.trim().length === 0) {
        // Don't log empty body as warning if it's likely a connection reset
        logger.debug(`[${requestId}] Empty request body received (likely connection reset)`)
        return NextResponse.json(
          { error: 'Empty request body', code: 'EMPTY_BODY' },
          { status: 400 }
        )
      }

      body = JSON.parse(bodyText)

      // Debug logging (now throttled at logger level)
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[${requestId}] Successfully parsed JSON body`)
      }
    } catch (parseError) {
      if (isAbortLikeError(parseError, req.signal)) {
        logger.debug(`[${requestId}] Workflow sync request body read was aborted`)
        return NextResponse.json(
          { error: 'Request aborted', code: 'REQUEST_ABORTED' },
          { status: 499 }
        )
      }

      logger.error(`[${requestId}] Failed to parse JSON body`, {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return NextResponse.json(
        { error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    try {
      const { workflows: clientWorkflows, workspaceId } = SyncPayloadSchema.parse(body)

      // CRITICAL SAFEGUARD: Prevent wiping out existing workflows
      // If client is sending empty workflows object, first check if user has existing workflows
      if (Object.keys(clientWorkflows).length === 0) {
        let existingWorkflows

        if (workspaceId) {
          existingWorkflows = await db
            .select()
            .from(workflow)
            .where(
              and(
                eq(workflow.userId, session.user.id),
                eq(workflow.workspaceId, workspaceId),
                isNull(workflow.deletedAt) // Only check non-deleted workflows
              )
            )
        } else {
          existingWorkflows = await db
            .select()
            .from(workflow)
            .where(and(eq(workflow.userId, session.user.id), isNull(workflow.deletedAt)))
        }

        // If user has existing workflows, but client sends empty, ALWAYS reject the sync
        if (existingWorkflows.length > 0) {
          logger.error(
            `[${requestId}] CRITICAL: Prevented data loss - Client attempted to sync empty workflows while DB has ${existingWorkflows.length} active workflows in workspace ${workspaceId || 'default'}`
          )
          return NextResponse.json(
            {
              error: 'Sync rejected to prevent data loss',
              message: `Client sent empty workflows, but database has ${existingWorkflows.length} active workflows. This usually happens when switching browsers or clearing cache. Please refresh the page to load workflows from database.`,
              code: 'EMPTY_SYNC_REJECTED',
              workflowCount: existingWorkflows.length,
            },
            { status: 409 }
          )
        }
      }

      // OPTIMIZED: Batch workspace validation with workflow fetch in parallel
      const [workspaceValidation, dbWorkflows] = await Promise.all([
        // Validate workspace exists (only if workspaceId provided)
        workspaceId
          ? db
              .select({ id: workspace.id })
              .from(workspace)
              .where(eq(workspace.id, workspaceId))
              .then((rows: any) => ({ exists: rows.length > 0 }))
          : Promise.resolve({ exists: true }),

        // Fetch workflows in parallel
        workspaceId
          ? db
              .select()
              .from(workflow)
              .where(
                and(
                  eq(workflow.userId, session.user.id),
                  eq(workflow.workspaceId, workspaceId),
                  isNull(workflow.deletedAt)
                )
              )
          : db
              .select()
              .from(workflow)
              .where(and(eq(workflow.userId, session.user.id), isNull(workflow.deletedAt))),
      ])

      // Check workspace validation result
      if (!workspaceValidation.exists) {
        logger.warn(
          `[${requestId}] Attempt to sync workflows to non-existent workspace: ${workspaceId}`
        )
        return NextResponse.json(
          {
            error: 'Workspace not found',
            code: 'WORKSPACE_NOT_FOUND',
          },
          { status: 404 }
        )
      }

      const now = new Date()
      const operations: Promise<any>[] = []
      const bulkUpdates: Array<{ id: string; data: any }> = [] // OPTIMIZATION: Batch updates

      // Create a map of DB workflows for easier lookup
      const dbWorkflowMap = new Map(dbWorkflows.map((w: any) => [w.id, w]))
      const processedIds = new Set<string>()

      // OPTIMIZATION: Pre-stringify client workflows once for comparison
      const clientWorkflowStrings = new Map<string, string>()
      for (const [id, clientWorkflow] of Object.entries(clientWorkflows)) {
        clientWorkflowStrings.set(id, JSON.stringify(clientWorkflow.state))
      }

      // CRITICAL VALIDATION: Detect suspicious sync patterns
      const clientWorkflowCount = Object.keys(clientWorkflows).length
      const dbWorkflowCount = dbWorkflows.length
      const difference = Math.abs(clientWorkflowCount - dbWorkflowCount)
      const percentageDiff = dbWorkflowCount > 0 ? (difference / dbWorkflowCount) * 100 : 0

      if (percentageDiff > 50 && dbWorkflowCount > 0) {
        logger.error(
          `[${requestId}] SUSPICIOUS SYNC: Large discrepancy detected - Client has ${clientWorkflowCount} workflows, DB has ${dbWorkflowCount} workflows (${percentageDiff.toFixed(1)}% difference). Workspace: ${workspaceId || 'default'}`
        )
        // Continue with sync but log the issue for investigation
      } else if (difference > 0) {
        logger.info(
          `[${requestId}] Sync state: Client=${clientWorkflowCount}, DB=${dbWorkflowCount}, Diff=${difference}`
        )
      }

      // Process client workflows - ONLY UPDATE existing ones
      // DB IS SOURCE OF TRUTH: Sync will NOT create new workflows
      // New workflows must be created via explicit POST /api/workflows/create endpoint
      const skippedWorkflows: string[] = []

      for (const [id, clientWorkflow] of Object.entries(clientWorkflows)) {
        processedIds.add(id)
        const dbWorkflow = dbWorkflowMap.get(id)

        // Handle legacy published workflows migration
        // If client workflow has isPublished but no marketplaceData, create marketplaceData with owner status
        if (clientWorkflow.state.isPublished && !clientWorkflow.marketplaceData) {
          clientWorkflow.marketplaceData = { id: clientWorkflow.id, status: 'owner' }
        }

        // Ensure the workflow has the correct workspaceId
        const effectiveWorkspaceId = clientWorkflow.workspaceId || workspaceId

        // Calculate workflow size
        const workflowSize = calculateWorkflowSize(clientWorkflow.state)

        if (!dbWorkflow) {
          // CRITICAL: Do NOT create new workflows via sync!
          // This prevents stale clients from resurrecting deleted workflows
          // New workflows must be created explicitly via POST /api/workflows/create
          skippedWorkflows.push(id)
          logger.info(
            `[${requestId}] SYNC SKIP: Workflow ${id} not in DB - will not create via sync. ` +
              `Use POST /api/workflows/create for new workflows.`
          )
          continue
        } else {
          // OPTIMIZED: Use pre-stringified values for comparison
          const clientStateStr = clientWorkflowStrings.get(id)!
          const dbStateStr = JSON.stringify((dbWorkflow as any).state)
          const dbMarketplaceStr = JSON.stringify((dbWorkflow as any).marketplaceData)
          const clientMarketplaceStr = JSON.stringify(clientWorkflow.marketplaceData)

          // Quick comparison with pre-stringified values
          const needsUpdate =
            dbStateStr !== clientStateStr ||
            (dbWorkflow as any).name !== (clientWorkflow as any).name ||
            (dbWorkflow as any).description !== (clientWorkflow as any).description ||
            (dbWorkflow as any).color !== (clientWorkflow as any).color ||
            (dbWorkflow as any).workspaceId !== effectiveWorkspaceId ||
            dbMarketplaceStr !== clientMarketplaceStr

          if (needsUpdate) {
            // OPTIMIZATION: Collect updates for batch processing
            bulkUpdates.push({
              id,
              data: {
                name: clientWorkflow.name,
                description: clientWorkflow.description,
                color: clientWorkflow.color,
                workspaceId: effectiveWorkspaceId,
                state: clientWorkflow.state,
                marketplaceData: clientWorkflow.marketplaceData || null,
                storageSize: workflowSize,
                lastSynced: now,
                updatedAt: now,
              },
            })
          }
        }
      }

      // OPTIMIZATION: Single storage check for all updates combined
      if (bulkUpdates.length > 0) {
        const totalSize = bulkUpdates.reduce(
          (sum, update) => sum + (update.data.storageSize || 0),
          0
        )
        const storageCheck = await canUseStorage(session.user.id, totalSize)

        if (!storageCheck.allowed) {
          logger.warn(
            `[${requestId}] Storage limit exceeded for user ${session.user.id}: ${storageCheck.message}`
          )
          return NextResponse.json(
            {
              error: 'Storage limit exceeded',
              message: storageCheck.message,
            },
            { status: 429 }
          )
        }

        // OPTIMIZATION: Execute all updates in parallel (batched)
        const updatePromises = bulkUpdates.map(({ id, data }) =>
          db.update(workflow).set(data).where(eq(workflow.id, id))
        )
        operations.push(...updatePromises)
      }

      // CRITICAL FIX: NO AUTO-DELETE!
      // Sync should ONLY handle CREATE and UPDATE operations.
      // DELETE must be EXPLICIT - only through the dedicated DELETE endpoint.
      // This prevents data loss when:
      // - User opens app on a new device (empty localStorage)
      // - User clears browser cache
      // - localStorage gets corrupted
      // - Network issues cause partial sync
      //
      // Workflows in DB but not in client are PRESERVED.
      // If client has fewer workflows than DB, it's likely because:
      // 1. New device/browser - will be populated from DB on next GET
      // 2. Cache cleared - same as above
      // 3. Partial sync - should not cause data loss
      const workflowsNotInClient = dbWorkflows.filter((w: any) => !processedIds.has(w.id))
      if (workflowsNotInClient.length > 0) {
        logger.info(
          `[${requestId}] SYNC PROTECTION: ${workflowsNotInClient.length} workflows in DB but not in client payload. These are PRESERVED (not deleted). Use explicit DELETE endpoint to remove workflows.`,
          {
            preservedIds: workflowsNotInClient.map((w: any) => w.id),
            preservedNames: workflowsNotInClient.map((w: any) => w.name),
            workspaceId: workspaceId || 'default',
          }
        )
      }

      // Execute all operations in parallel (already batched above)
      await Promise.all(operations)

      // Auto-sync triggers for updated workflows (non-blocking)
      // This ensures triggers work as soon as the starter block is configured
      if (bulkUpdates.length > 0) {
        Promise.allSettled(
          bulkUpdates.map(({ id, data }) => {
            if (data.state?.blocks) {
              return syncTriggerFromWorkflowState(id, data.state)
            }
            return Promise.resolve()
          })
        ).catch((err) => {
          logger.error(`[${requestId}] Trigger sync error (non-blocking)`, err)
        })
      }

      // Notify other tabs/devices via Redis Pub/Sub for each updated workflow
      // Also notify all collaborators so they get real-time updates
      for (const { id } of bulkUpdates) {
        // Notify the owner
        await publishWorkflowUpdate(id, session.user.id, 'workflow_updated')

        // Notify collaborators of this workflow
        const dbWf = dbWorkflowMap.get(id)
        if (dbWf && (dbWf as any).collaborators) {
          try {
            const collabs = Array.isArray((dbWf as any).collaborators)
              ? (dbWf as any).collaborators
              : JSON.parse((dbWf as any).collaborators as string)
            for (const collab of collabs) {
              if (collab.userId && collab.userId !== session.user.id) {
                await publishWorkflowUpdate(id, collab.userId, 'workflow_updated')
              }
            }
          } catch {
            // Ignore parse errors for collaborators
          }
        }
      }

      // Log summary
      if (skippedWorkflows.length > 0) {
        logger.info(
          `[${requestId}] SYNC COMPLETE: Updated ${operations.length} workflows, skipped ${skippedWorkflows.length} (not in DB)`
        )
      }

      return NextResponse.json({
        success: true,
        updated: operations.length,
        skipped: skippedWorkflows.length,
        skippedIds: skippedWorkflows, // Client can use this to know which workflows need explicit creation
      })
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.warn(`[${requestId}] Invalid workflow data`, {
          errors: validationError.issues,
        })
        return NextResponse.json(
          { error: 'Invalid request data', details: validationError.issues },
          { status: 400 }
        )
      }
      throw validationError
    }
  } catch (error) {
    logger.error(`[${requestId}] Workflow sync error`, error)
    return NextResponse.json({ error: 'Workflow sync failed' }, { status: 500 })
  }
}
