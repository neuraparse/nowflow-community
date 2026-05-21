/**
 * API Rate Limit Checking
 * Validates API calls against subscription tier limits
 */
import { eq, sql } from 'drizzle-orm'
import { isProd } from '@/lib/environment'
import { createLogger } from '@/lib/logs/console-logger'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'
import { db } from '@/db'
import { userStats } from '@/db/schema'

type DbTx = any

const logger = createLogger('APIRateLimits')

/**
 * Get the subscription limits for a user
 */
async function getUserPlan(userId: string) {
  if (!isProd) {
    return {
      ...(await getEffectiveSubscriptionPlan(userId)),
      apiCallsLimit: 2000,
      name: 'pro',
      displayName: 'Pro',
    }
  }

  return getEffectiveSubscriptionPlan(userId)
}

/**
 * Reset daily API call counter if needed
 */
async function resetDailyCounterIfNeeded(userId: string): Promise<void> {
  try {
    const stats = await db.select().from(userStats).where(eq(userStats.userId, userId))

    if (stats.length === 0) return

    const stat = stats[0]
    const now = new Date()
    const lastReset = stat.apiCallsResetAt ? new Date(stat.apiCallsResetAt) : new Date()

    // Check if 24 hours have passed
    const hoursPassed = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60)

    if (hoursPassed >= 24) {
      await db
        .update(userStats)
        .set({
          apiCallsToday: 0,
          apiCallsResetAt: now,
        })
        .where(eq(userStats.userId, userId))

      logger.info('Reset daily API call counter', { userId })
    }
  } catch (error) {
    logger.error('Error resetting daily counter:', { error, userId })
  }
}

async function ensureUserStatsRecord(userId: string) {
  let stats = await db.select().from(userStats).where(eq(userStats.userId, userId))

  if (stats.length === 0) {
    await db.insert(userStats).values({
      id: `stats_${userId}`,
      userId,
      apiCallsToday: 0,
      apiCallsResetAt: new Date(),
      lastActive: new Date(),
    })
    stats = await db.select().from(userStats).where(eq(userStats.userId, userId))
  }

  return stats[0]
}

/**
 * Check if user can make an API call
 */
export async function canMakeApiCall(userId: string): Promise<{
  allowed: boolean
  currentCalls: number
  limit: number
  message?: string
}> {
  try {
    // Reset counter if needed
    await resetDailyCounterIfNeeded(userId)

    const plan = await getUserPlan(userId)

    // Get current stats
    const stats = await ensureUserStatsRecord(userId)
    const currentCalls = stats?.apiCallsToday || 0

    if (currentCalls >= plan.apiCallsLimit) {
      return {
        allowed: false,
        currentCalls,
        limit: plan.apiCallsLimit,
        message: `You have reached the API call limit for your ${plan.displayName} plan (${plan.apiCallsLimit} calls/day). Limit resets in 24 hours.`,
      }
    }

    return {
      allowed: true,
      currentCalls,
      limit: plan.apiCallsLimit,
    }
  } catch (error) {
    logger.error('Error checking API call permission:', { error, userId })
    return {
      allowed: false,
      currentCalls: 0,
      limit: 0,
      message: 'Unable to verify API call quota right now. Please try again.',
    }
  }
}

/**
 * Atomically reserve one API call for the user.
 * This prevents concurrent requests from overshooting the plan limit.
 */
export async function consumeApiCallQuota(userId: string): Promise<{
  allowed: boolean
  currentCalls: number
  limit: number
  message?: string
}> {
  try {
    const plan = await getUserPlan(userId)

    return db.transaction(async (tx: DbTx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`api-calls-${userId}`}))`)

      let [stats] = await tx.select().from(userStats).where(eq(userStats.userId, userId))

      const now = new Date()
      if (!stats) {
        await tx.insert(userStats).values({
          id: `stats_${userId}`,
          userId,
          apiCallsToday: 0,
          apiCallsResetAt: now,
          lastActive: now,
        })
        ;[stats] = await tx.select().from(userStats).where(eq(userStats.userId, userId))
      }

      let currentCalls = stats?.apiCallsToday || 0
      const lastReset = stats?.apiCallsResetAt ? new Date(stats.apiCallsResetAt) : now
      const hoursPassed = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60)

      if (hoursPassed >= 24) {
        currentCalls = 0
        await tx
          .update(userStats)
          .set({
            apiCallsToday: 0,
            apiCallsResetAt: now,
          })
          .where(eq(userStats.userId, userId))
      }

      if (currentCalls >= plan.apiCallsLimit) {
        return {
          allowed: false,
          currentCalls,
          limit: plan.apiCallsLimit,
          message: `You have reached the API call limit for your ${plan.displayName} plan (${plan.apiCallsLimit} calls/day). Limit resets in 24 hours.`,
        }
      }

      const nextCalls = currentCalls + 1

      await tx
        .update(userStats)
        .set({
          apiCallsToday: nextCalls,
          lastActive: now,
        })
        .where(eq(userStats.userId, userId))

      return {
        allowed: true,
        currentCalls: nextCalls,
        limit: plan.apiCallsLimit,
      }
    })
  } catch (error) {
    logger.error('Error consuming API call quota:', { error, userId })
    return {
      allowed: false,
      currentCalls: 0,
      limit: 0,
      message: 'Unable to reserve API call quota right now. Please try again.',
    }
  }
}

/**
 * Get API call usage for a user
 */
export async function getApiCallUsage(userId: string): Promise<{
  current: number
  limit: number
  percentage: number
  tier: string
}> {
  try {
    await resetDailyCounterIfNeeded(userId)

    const plan = await getUserPlan(userId)
    const stats = await ensureUserStatsRecord(userId)

    const current = stats?.apiCallsToday || 0
    const percentage = Math.round((current / plan.apiCallsLimit) * 100)

    return {
      current,
      limit: plan.apiCallsLimit,
      percentage,
      tier: plan.name,
    }
  } catch (error) {
    logger.error('Error getting API call usage:', { error, userId })
    return {
      current: 0,
      limit: 0,
      percentage: 0,
      tier: 'unknown',
    }
  }
}
