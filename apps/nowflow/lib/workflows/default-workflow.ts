import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import {
  createWorkflowWithLimits,
  WorkflowCreationLimitError,
} from '@/lib/workflows/create-workflow'
import { db } from '@/db'
import { workflow, workspaceMember } from '@/db/schema'

const logger = createLogger('DefaultWorkflow')

interface EnsureDefaultWorkflowOptions {
  userId: string
  workspaceId?: string | null
  userName?: string | null
  reason?: string
}

interface EnsureDefaultWorkflowResult {
  created: boolean
  workflowId?: string
  workspaceId?: string
}

async function resolveWorkspaceId(
  userId: string,
  workspaceId?: string | null
): Promise<string | undefined> {
  if (workspaceId) return workspaceId

  const [membership] = await db
    .select({ workspaceId: workspaceMember.workspaceId })
    .from(workspaceMember)
    .where(eq(workspaceMember.userId, userId))
    .orderBy(desc(workspaceMember.joinedAt))
    .limit(1)

  return membership?.workspaceId
}

export async function ensureDefaultWorkflow(
  options: EnsureDefaultWorkflowOptions
): Promise<EnsureDefaultWorkflowResult> {
  const { userId, userName, reason } = options
  if (!userId) return { created: false }

  const workspaceId = await resolveWorkspaceId(userId, options.workspaceId)
  if (!workspaceId) {
    logger.warn('Default workflow skipped - no workspace available', { userId, reason })
    return { created: false }
  }

  const lockKey = `default-workflow-${userId}`
  const lockResult = await db.execute(
    sql`SELECT pg_try_advisory_lock(hashtext(${lockKey})) as acquired`
  )
  const lockRows = Array.isArray(lockResult) ? lockResult : lockResult?.rows
  const acquiredValue = lockRows?.[0]?.acquired
  const acquired = acquiredValue === true || acquiredValue === 't' || acquiredValue === 'true'

  if (!acquired) {
    logger.debug('Default workflow lock not acquired', { userId, reason })
    return { created: false }
  }

  try {
    const [existingWorkflow] = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))
      .limit(1)

    if (existingWorkflow) {
      logger.debug('Default workflow skipped - workflow already exists', {
        userId,
        reason,
      })
      return { created: false, workspaceId }
    }

    const starterId = crypto.randomUUID()
    const starterBlock = {
      id: starterId,
      type: 'starter',
      name: 'Start',
      position: { x: 100, y: 100 },
      subBlocks: {
        startWorkflow: {
          id: 'startWorkflow',
          type: 'dropdown',
          value: 'manual',
        },
        webhookPath: {
          id: 'webhookPath',
          type: 'short-input',
          value: '',
        },
        webhookSecret: {
          id: 'webhookSecret',
          type: 'short-input',
          value: '',
        },
        scheduleType: {
          id: 'scheduleType',
          type: 'dropdown',
          value: 'daily',
        },
        minutesInterval: {
          id: 'minutesInterval',
          type: 'short-input',
          value: '',
        },
        minutesStartingAt: {
          id: 'minutesStartingAt',
          type: 'short-input',
          value: '',
        },
        hourlyMinute: {
          id: 'hourlyMinute',
          type: 'short-input',
          value: '',
        },
        dailyTime: {
          id: 'dailyTime',
          type: 'short-input',
          value: '',
        },
        weeklyDay: {
          id: 'weeklyDay',
          type: 'dropdown',
          value: 'MON',
        },
        weeklyDayTime: {
          id: 'weeklyDayTime',
          type: 'short-input',
          value: '',
        },
        monthlyDay: {
          id: 'monthlyDay',
          type: 'short-input',
          value: '',
        },
        monthlyTime: {
          id: 'monthlyTime',
          type: 'short-input',
          value: '',
        },
        cronExpression: {
          id: 'cronExpression',
          type: 'short-input',
          value: '',
        },
        timezone: {
          id: 'timezone',
          type: 'dropdown',
          value: 'UTC',
        },
      },
      outputs: {
        response: {
          type: {
            input: 'any',
          },
        },
      },
      enabled: true,
      horizontalHandles: true,
      isWide: false,
      height: 0,
    }

    const initialState = {
      blocks: {
        [starterId]: starterBlock,
      },
      edges: [],
      loops: {},
      groups: {},
      selectedNodeIds: [],
      isDeployed: false,
      deployedAt: undefined,
      workspaceId,
      lastSaved: Date.now(),
    }

    const now = new Date()
    const workflowId = crypto.randomUUID()
    const workflowName = userName ? `${userName}'s First Workflow` : 'My First Workflow'

    await createWorkflowWithLimits({
      id: workflowId,
      userId,
      workspaceId,
      name: workflowName,
      description: 'Getting started with agents',
      color: '#3972F6',
      icon: 'workflow',
      state: initialState,
      marketplaceData: null,
      now,
    })

    logger.info('Default workflow created', { userId, workflowId, workspaceId, reason })
    return { created: true, workflowId, workspaceId }
  } catch (error) {
    if (error instanceof WorkflowCreationLimitError) {
      logger.warn('Default workflow skipped - guarded by subscription limits', {
        userId,
        reason,
        code: error.code,
        message: error.message,
      })
      return { created: false, workspaceId }
    }

    logger.error('Failed to create default workflow', { userId, error, reason })
    return { created: false, workspaceId }
  } finally {
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${lockKey}))`)
    } catch (error) {
      logger.warn('Failed to release default workflow lock', { userId, error, reason })
    }
  }
}
