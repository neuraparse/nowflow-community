/**
 * Workflow Limit Checking
 * Validates workflow creation against subscription tier limits
 * All limits are fetched from the database subscription_plan table
 */
import { and, count, eq, isNull } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('WorkflowLimits')

/**
 * Get the current workflow count for a user
 * IMPORTANT: Only counts active workflows (excludes soft-deleted workflows)
 */
export async function getUserWorkflowCount(userId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: count() })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))

    return Number(result[0]?.count || 0)
  } catch (error) {
    logger.error('Error getting workflow count:', { error, userId })
    return 0
  }
}

/**
 * Check if user can create a new workflow
 */
export async function canCreateWorkflow(userId: string): Promise<{
  allowed: boolean
  currentCount: number
  limit: number
  message?: string
  planName?: string
}> {
  try {
    const plan = await getEffectiveSubscriptionPlan(userId)
    if (!plan) {
      logger.error('No subscription plan found for user:', { userId })
      return {
        allowed: false,
        currentCount: 0,
        limit: 0,
        message: 'No subscription plan found',
      }
    }

    const currentCount = await getUserWorkflowCount(userId)

    if (currentCount >= plan.workflowLimit) {
      return {
        allowed: false,
        currentCount,
        limit: plan.workflowLimit,
        planName: plan.name,
        message: `You have reached the workflow limit for your ${plan.displayName} plan (${plan.workflowLimit} workflows). Upgrade to create more workflows.`,
      }
    }

    return {
      allowed: true,
      currentCount,
      limit: plan.workflowLimit,
      planName: plan.name,
    }
  } catch (error) {
    logger.error('Error checking workflow creation permission:', { error, userId })
    return {
      allowed: false,
      currentCount: 0,
      limit: 0,
      message: 'Unable to verify workflow limits right now. Please try again.',
    }
  }
}

/**
 * Get workflow usage for a user
 */
export async function getWorkflowUsage(userId: string): Promise<{
  current: number
  limit: number
  percentage: number
  planName: string
}> {
  try {
    const plan = await getEffectiveSubscriptionPlan(userId)
    if (!plan) {
      logger.error('No subscription plan found for user:', { userId })
      return {
        current: 0,
        limit: 0,
        percentage: 0,
        planName: 'unknown',
      }
    }

    const current = await getUserWorkflowCount(userId)
    const percentage = Math.round((current / plan.workflowLimit) * 100)

    return {
      current,
      limit: plan.workflowLimit,
      percentage,
      planName: plan.name,
    }
  } catch (error) {
    logger.error('Error getting workflow usage:', { error, userId })
    return {
      current: 0,
      limit: 0,
      percentage: 0,
      planName: 'unknown',
    }
  }
}
