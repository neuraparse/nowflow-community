/**
 * Storage Limit Checking
 * Validates storage usage against subscription tier limits
 */
import { and, eq, isNull, sum } from 'drizzle-orm'
import { isProd } from '@/lib/environment'
import { createLogger } from '@/lib/logs/console-logger'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('StorageLimits')

/**
 * Calculate storage size of a workflow (in MB)
 * Estimates based on JSON serialization
 */
export function calculateWorkflowSize(workflowData: any): number {
  try {
    const jsonString = JSON.stringify(workflowData)
    // Convert bytes to MB (1 MB = 1024 KB = 1048576 bytes)
    return Math.ceil(jsonString.length / 1024) // Return in KB
  } catch (error) {
    logger.error('Error calculating workflow size:', error)
    return 0
  }
}

/**
 * Get total storage used by a user (in MB)
 */
export async function getUserStorageUsed(userId: string): Promise<number> {
  try {
    const result = await db
      .select({ total: sum(workflow.storageSize) })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))

    const totalKB = result[0]?.total || 0
    return Math.ceil(totalKB / 1024) // Convert KB to MB
  } catch (error) {
    logger.error('Error getting user storage:', { error, userId })
    return 0
  }
}

/**
 * Check if user can create/update a workflow with given size
 */
export async function canUseStorage(
  userId: string,
  additionalSizeKB: number
): Promise<{
  allowed: boolean
  currentUsage: number
  limit: number
  message?: string
}> {
  try {
    const plan = isProd
      ? await getEffectiveSubscriptionPlan(userId)
      : {
          ...(await getEffectiveSubscriptionPlan(userId)),
          name: 'pro',
          displayName: 'Pro',
          storageLimit: 5120,
        }
    const limitMB = plan.storageLimit
    const limitKB = limitMB * 1024

    const currentUsageKB = await db
      .select({ total: sum(workflow.storageSize) })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))

    const currentTotalKB = Number(currentUsageKB[0]?.total || 0)
    const totalKB = currentTotalKB + additionalSizeKB

    if (totalKB > limitKB) {
      const currentMB = Math.ceil(currentTotalKB / 1024)
      return {
        allowed: false,
        currentUsage: currentMB,
        limit: limitMB,
        message: `Storage limit exceeded for your ${plan.displayName} plan. Current: ${currentMB}MB / ${limitMB}MB. Upgrade to increase storage.`,
      }
    }

    const currentMB = Math.ceil(currentTotalKB / 1024)
    return {
      allowed: true,
      currentUsage: currentMB,
      limit: limitMB,
    }
  } catch (error) {
    logger.error('Error checking storage permission:', { error, userId })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      message: 'Unable to verify storage limits right now. Please try again.',
    }
  }
}

/**
 * Update workflow storage size
 */
export async function updateWorkflowStorageSize(
  workflowId: string,
  workflowData: any
): Promise<void> {
  try {
    const sizeKB = calculateWorkflowSize(workflowData)
    await db.update(workflow).set({ storageSize: sizeKB }).where(eq(workflow.id, workflowId))

    logger.debug('Updated workflow storage size', { workflowId, sizeKB })
  } catch (error) {
    logger.error('Error updating workflow storage size:', { error, workflowId })
  }
}

/**
 * Get storage usage for a user
 */
export async function getStorageUsage(userId: string): Promise<{
  current: number
  limit: number
  percentage: number
  tier: string
}> {
  try {
    const plan = isProd
      ? await getEffectiveSubscriptionPlan(userId)
      : {
          ...(await getEffectiveSubscriptionPlan(userId)),
          name: 'pro',
          displayName: 'Pro',
          storageLimit: 5120,
        }

    const result = await db
      .select({ total: sum(workflow.storageSize) })
      .from(workflow)
      .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))

    const totalKB = result[0]?.total || 0
    const currentMB = Math.ceil(totalKB / 1024)
    const percentage = Math.round((currentMB / plan.storageLimit) * 100)

    return {
      current: currentMB,
      limit: plan.storageLimit,
      percentage,
      tier: plan.name,
    }
  } catch (error) {
    logger.error('Error getting storage usage:', { error, userId })
    return {
      current: 0,
      limit: 0,
      percentage: 0,
      tier: 'unknown',
    }
  }
}
