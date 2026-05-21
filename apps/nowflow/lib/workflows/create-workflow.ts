import { and, count, eq, isNull, sql, sum } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { calculateWorkflowSize } from '@/lib/storage-limits'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'
import { db } from '@/db'
import { workflow } from '@/db/schema'

// db is typed as `any` (see db/index.ts) so transaction's tx is also any

type DbTx = any

const logger = createLogger('WorkflowCreationService')

export class WorkflowCreationLimitError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number = 429) {
    super(message)
    this.name = 'WorkflowCreationLimitError'
    this.code = code
    this.status = status
  }
}

interface CreateWorkflowWithLimitsInput {
  id: string
  userId: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  state: unknown
  workspaceId?: string | null
  marketplaceData?: unknown
  isDeployed?: boolean
  runCount?: number
  now?: Date
}

export async function createWorkflowWithLimits(input: CreateWorkflowWithLimitsInput) {
  const now = input.now ?? new Date()
  const storageSize = calculateWorkflowSize(input.state)
  const plan = await getEffectiveSubscriptionPlan(input.userId)

  return db.transaction(async (tx: DbTx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`workflow-create-${input.userId}`}))`
    )

    const [workflowCountResult] = await tx
      .select({ count: count() })
      .from(workflow)
      .where(and(eq(workflow.userId, input.userId), isNull(workflow.deletedAt)))

    const currentCount = Number(workflowCountResult?.count || 0)
    if (currentCount >= plan.workflowLimit) {
      throw new WorkflowCreationLimitError(
        `You have reached the workflow limit for your ${plan.displayName} plan (${plan.workflowLimit} workflows). Upgrade to create more workflows.`,
        'WORKFLOW_LIMIT_EXCEEDED'
      )
    }

    const [storageUsageResult] = await tx
      .select({ total: sum(workflow.storageSize) })
      .from(workflow)
      .where(and(eq(workflow.userId, input.userId), isNull(workflow.deletedAt)))

    const currentStorageKB = Number(storageUsageResult?.total || 0)
    const storageLimitKB = plan.storageLimit * 1024

    if (currentStorageKB + storageSize > storageLimitKB) {
      const currentStorageMB = Math.ceil(currentStorageKB / 1024)
      throw new WorkflowCreationLimitError(
        `Storage limit exceeded for your ${plan.displayName} plan. Current: ${currentStorageMB}MB / ${plan.storageLimit}MB. Upgrade to increase storage.`,
        'STORAGE_LIMIT_EXCEEDED'
      )
    }

    const [createdWorkflow] = await tx
      .insert(workflow)
      .values({
        id: input.id,
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        name: input.name,
        description: input.description || null,
        color: input.color || '#3972F6',
        icon: input.icon || null,
        state: input.state,
        marketplaceData: input.marketplaceData || null,
        storageSize,
        isDeployed: input.isDeployed ?? false,
        runCount: input.runCount ?? 0,
        lastSynced: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: workflow.id,
        name: workflow.name,
        workspaceId: workflow.workspaceId,
        createdAt: workflow.createdAt,
      })

    logger.info('Workflow created with atomic limit guard', {
      workflowId: createdWorkflow.id,
      userId: input.userId,
      storageSize,
      currentCount,
      workflowLimit: plan.workflowLimit,
    })

    return createdWorkflow
  })
}
