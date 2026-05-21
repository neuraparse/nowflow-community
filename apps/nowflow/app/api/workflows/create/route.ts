import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  createWorkflowWithLimits,
  WorkflowCreationLimitError,
} from '@/lib/workflows/create-workflow'
import { db } from '@/db'
import { workflow, workspace, workspaceMember } from '@/db/schema'

const logger = createLogger('WorkflowCreateAPI')

function isUniqueViolation(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    ('code' in error || 'constraint' in error) &&
    (error as any).code === '23505'
  )
}

// Define marketplace data schema
const MarketplaceDataSchema = z
  .object({
    id: z.string(),
    status: z.enum(['owner', 'temp']),
  })
  .nullable()
  .optional()

// Schema for workflow state
const WorkflowStateSchema = z.object({
  blocks: z.record(z.string(), z.any()),
  edges: z.array(z.any()),
  loops: z.record(z.string(), z.any()),
  groups: z.record(z.string(), z.any()).optional(),
  selectedNodeIds: z.array(z.string()).optional(),
  lastSaved: z.number().optional(),
  isDeployed: z.boolean().optional(),
  deployedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
  isPublished: z.boolean().optional(),
  marketplaceData: MarketplaceDataSchema,
  toolParams: z.record(z.string(), z.any()).optional(),
})

// Schema for creating a new workflow
const CreateWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  state: WorkflowStateSchema,
  workspaceId: z.string().uuid().optional(),
  marketplaceData: MarketplaceDataSchema,
})

/**
 * POST /api/workflows/create - Explicitly create a new workflow
 * This is the ONLY way to create a workflow - sync will NOT create new workflows
 * This prevents stale clients from resurrecting deleted workflows
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized workflow create attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch (parseError) {
      logger.error(`[${requestId}] Failed to parse JSON body`, { error: parseError })
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Validate request data
    const validationResult = CreateWorkflowSchema.safeParse(body)
    if (!validationResult.success) {
      logger.warn(`[${requestId}] Invalid workflow data`, {
        errors: validationResult.error.issues,
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const workflowData = validationResult.data
    const { id, name, description, color, icon, state, workspaceId, marketplaceData } = workflowData

    logger.info(`[${requestId}] CREATE workflow request`, {
      id,
      name,
      workspaceId,
      userId,
    })

    // Check if workflow already exists
    const [existingWorkflow] = await db
      .select({ id: workflow.id, deletedAt: workflow.deletedAt })
      .from(workflow)
      .where(eq(workflow.id, id))
      .limit(1)

    if (existingWorkflow) {
      if (existingWorkflow.deletedAt) {
        // Workflow was soft-deleted, don't allow recreation with same ID
        logger.warn(`[${requestId}] Attempted to recreate soft-deleted workflow ${id}`)
        return NextResponse.json(
          {
            error: 'Workflow ID was previously deleted',
            message:
              'This workflow ID was deleted. Please create a new workflow with a different ID.',
            code: 'WORKFLOW_DELETED',
          },
          { status: 409 }
        )
      } else {
        // Workflow already exists and is active
        logger.warn(`[${requestId}] Workflow ${id} already exists`)
        return NextResponse.json(
          {
            error: 'Workflow already exists',
            message: 'A workflow with this ID already exists. Use sync to update it.',
            code: 'WORKFLOW_EXISTS',
          },
          { status: 409 }
        )
      }
    }

    // Validate workspace if provided
    if (workspaceId) {
      const [workspaceAccess] = await db
        .select({
          id: workspace.id,
          ownerId: workspace.ownerId,
          memberUserId: workspaceMember.userId,
        })
        .from(workspace)
        .leftJoin(
          workspaceMember,
          and(eq(workspaceMember.workspaceId, workspace.id), eq(workspaceMember.userId, userId))
        )
        .where(eq(workspace.id, workspaceId))
        .limit(1)

      if (!workspaceAccess) {
        logger.warn(`[${requestId}] Workspace ${workspaceId} not found`)
        return NextResponse.json(
          { error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' },
          { status: 404 }
        )
      }

      const hasWorkspaceAccess =
        workspaceAccess.ownerId === userId || workspaceAccess.memberUserId === userId

      if (!hasWorkspaceAccess) {
        logger.warn(
          `[${requestId}] User ${userId} tried to create workflow in unauthorized workspace ${workspaceId}`
        )
        return NextResponse.json(
          {
            error: 'Workspace access denied',
            message: 'You do not have access to create workflows in this workspace.',
            code: 'WORKSPACE_ACCESS_DENIED',
          },
          { status: 403 }
        )
      }
    }

    const newWorkflow = await createWorkflowWithLimits({
      id,
      userId,
      workspaceId,
      name,
      description,
      color,
      icon,
      state,
      marketplaceData,
    })

    logger.info(`[${requestId}] Successfully CREATED workflow`, {
      id: newWorkflow.id,
      name: newWorkflow.name,
      workspaceId: newWorkflow.workspaceId,
    })

    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
    })
  } catch (error: any) {
    if (error instanceof WorkflowCreationLimitError) {
      return NextResponse.json(
        {
          error:
            error.code === 'STORAGE_LIMIT_EXCEEDED'
              ? 'Storage limit exceeded'
              : 'Workflow limit exceeded',
          message: error.message,
          code: error.code,
        },
        { status: error.status }
      )
    }

    if (isUniqueViolation(error)) {
      logger.warn(`[${requestId}] Workflow create hit unique constraint`, {
        code: error?.code,
        constraint: error?.constraint,
      })
      return NextResponse.json(
        {
          error: 'Workflow already exists',
          message: 'A workflow with this ID already exists. Please retry with a new workflow ID.',
          code: 'WORKFLOW_EXISTS',
        },
        { status: 409 }
      )
    }

    logger.error(`[${requestId}] Workflow create error`, error)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}
