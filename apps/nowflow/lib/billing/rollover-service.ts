import { and, asc, eq, lte, ne } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { isStarterPlan } from '@/lib/subscription'
import { db } from '@/db'
import * as schema from '@/db/schema'

const logger = createLogger('RolloverService')

type QuotaType = 'api_calls' | 'storage' | 'ai_credits' | 'workflows'

const ROLLOVER_CAP_PERCENT = 0.5
const ROLLOVER_MAX_MONTHS = 1

/** Map quota types to their corresponding subscriptionPlan limit columns */
const QUOTA_LIMIT_KEYS: Record<QuotaType, keyof typeof schema.subscriptionPlan.$inferSelect> = {
  api_calls: 'apiCallsLimit',
  storage: 'storageLimit',
  ai_credits: 'costLimit',
  workflows: 'workflowLimit',
}

/** Map quota types to their corresponding userStats usage columns */
const USAGE_KEYS: Record<QuotaType, keyof typeof schema.userStats.$inferSelect> = {
  api_calls: 'totalApiCalls',
  storage: 'totalStorageUsed',
  ai_credits: 'totalCost',
  workflows: 'totalManualExecutions',
}

function generateId(): string {
  return crypto.randomUUID()
}

async function getPlanForUser(userId: string) {
  const rows = await db
    .select({
      planName: schema.subscriptionPlan.name,
      apiCallsLimit: schema.subscriptionPlan.apiCallsLimit,
      storageLimit: schema.subscriptionPlan.storageLimit,
      costLimit: schema.subscriptionPlan.costLimit,
      workflowLimit: schema.subscriptionPlan.workflowLimit,
    })
    .from(schema.subscription)
    .leftJoin(schema.subscriptionPlan, eq(schema.subscription.planId, schema.subscriptionPlan.id))
    .where(
      and(eq(schema.subscription.referenceId, userId), eq(schema.subscription.status, 'active'))
    )
    .limit(1)

  return rows[0] ?? null
}

export class RolloverService {
  /**
   * Calculate unused quota for a user in the current period.
   */
  async calculateUnusedQuota(userId: string, quotaType: QuotaType): Promise<number> {
    const plan = await getPlanForUser(userId)
    if (!plan) return 0

    const limitKey = QUOTA_LIMIT_KEYS[quotaType]
    const planLimit = Number(plan[limitKey]) || 0
    if (planLimit <= 0) return 0

    const stats = await db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1)

    if (stats.length === 0) return planLimit

    const usageKey = USAGE_KEYS[quotaType]
    const used = Number(stats[0][usageKey]) || 0

    return Math.max(0, planLimit - used)
  }

  /**
   * Create a rollover entry for the next billing period.
   * Applies the 50% cap and checks plan eligibility.
   */
  async createRollover(
    userId: string,
    quotaType: QuotaType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<typeof schema.quotaRollover.$inferSelect | null> {
    const isPaid = await isStarterPlan(userId)
    if (!isPaid) {
      logger.debug('Skipping rollover for free plan user', { userId })
      return null
    }

    const plan = await getPlanForUser(userId)
    if (!plan) return null

    const unused = await this.calculateUnusedQuota(userId, quotaType)
    if (unused <= 0) return null

    const limitKey = QUOTA_LIMIT_KEYS[quotaType]
    const planLimit = Number(plan[limitKey]) || 0
    const cap = Math.floor(planLimit * ROLLOVER_CAP_PERCENT)
    const rolloverAmount = Math.min(unused, cap)

    if (rolloverAmount <= 0) return null

    const expiresAt = new Date(periodEnd)
    expiresAt.setMonth(expiresAt.getMonth() + ROLLOVER_MAX_MONTHS)

    const entry = {
      id: generateId(),
      userId,
      workspaceId: null,
      quotaType,
      amount: rolloverAmount,
      period: 'monthly' as const,
      rolledFromDate: periodStart,
      rolledToDate: periodEnd,
      expiresAt,
      status: 'active',
      consumedAmount: 0,
      createdAt: new Date(),
    }

    await db.insert(schema.quotaRollover).values(entry)
    logger.debug('Created rollover', { userId, quotaType, amount: rolloverAmount })
    return entry
  }

  /**
   * Process monthly rollovers for all active paid subscribers.
   */
  async processMonthlyRollovers(periodStart: Date, periodEnd: Date): Promise<number> {
    const activeSubscriptions = await db
      .select({ referenceId: schema.subscription.referenceId })
      .from(schema.subscription)
      .leftJoin(schema.subscriptionPlan, eq(schema.subscription.planId, schema.subscriptionPlan.id))
      .where(
        and(eq(schema.subscription.status, 'active'), ne(schema.subscriptionPlan.name, 'free'))
      )

    const quotaTypes: QuotaType[] = ['api_calls', 'storage', 'ai_credits', 'workflows']
    let count = 0

    for (const sub of activeSubscriptions) {
      for (const qt of quotaTypes) {
        const result = await this.createRollover(sub.referenceId, qt, periodStart, periodEnd)
        if (result) count++
      }
    }

    // Expire old rollovers after processing new ones
    await this.expireOldRollovers()

    logger.debug('Processed monthly rollovers', { count })
    return count
  }

  /**
   * Get current available quota: base plan + active rollovers.
   */
  async getAvailableQuota(userId: string, quotaType: QuotaType): Promise<number> {
    const plan = await getPlanForUser(userId)
    const limitKey = QUOTA_LIMIT_KEYS[quotaType]
    const baseQuota = plan ? Number(plan[limitKey]) || 0 : 0

    const rollovers = await db
      .select()
      .from(schema.quotaRollover)
      .where(
        and(
          eq(schema.quotaRollover.userId, userId),
          eq(schema.quotaRollover.quotaType, quotaType),
          eq(schema.quotaRollover.status, 'active')
        )
      )

    const rolloverRemaining = rollovers.reduce(
      (sum: number, r: typeof schema.quotaRollover.$inferSelect) =>
        sum + (r.amount - r.consumedAmount),
      0
    )

    return baseQuota + rolloverRemaining
  }

  /**
   * Consume quota using FIFO ordering -- oldest rollovers consumed first.
   * Returns actual amount consumed.
   */
  async consumeQuota(userId: string, quotaType: QuotaType, amount: number): Promise<number> {
    if (amount <= 0) return 0

    // Get active rollovers ordered by oldest first (FIFO)
    const rollovers = await db
      .select()
      .from(schema.quotaRollover)
      .where(
        and(
          eq(schema.quotaRollover.userId, userId),
          eq(schema.quotaRollover.quotaType, quotaType),
          eq(schema.quotaRollover.status, 'active')
        )
      )
      .orderBy(asc(schema.quotaRollover.rolledFromDate))

    let remaining = amount

    for (const rollover of rollovers) {
      if (remaining <= 0) break

      const available = rollover.amount - rollover.consumedAmount
      if (available <= 0) continue

      const toConsume = Math.min(available, remaining)
      const newConsumed = rollover.consumedAmount + toConsume
      const newStatus = newConsumed >= rollover.amount ? 'consumed' : 'active'

      await db
        .update(schema.quotaRollover)
        .set({ consumedAmount: newConsumed, status: newStatus })
        .where(eq(schema.quotaRollover.id, rollover.id))

      remaining -= toConsume
    }

    return amount - remaining
  }

  /**
   * Get a breakdown of quota: base amount, rollover amount, usage, remaining.
   */
  async getQuotaBreakdown(userId: string, quotaType: QuotaType) {
    const plan = await getPlanForUser(userId)
    const limitKey = QUOTA_LIMIT_KEYS[quotaType]
    const baseQuota = plan ? Number(plan[limitKey]) || 0 : 0

    const stats = await db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1)

    const usageKey = USAGE_KEYS[quotaType]
    const usage = stats.length > 0 ? Number(stats[0][usageKey]) || 0 : 0

    const rollovers = await db
      .select()
      .from(schema.quotaRollover)
      .where(
        and(
          eq(schema.quotaRollover.userId, userId),
          eq(schema.quotaRollover.quotaType, quotaType),
          eq(schema.quotaRollover.status, 'active')
        )
      )

    const rolloverAmount = rollovers.reduce(
      (sum: number, r: typeof schema.quotaRollover.$inferSelect) =>
        sum + (r.amount - r.consumedAmount),
      0
    )

    const totalAvailable = baseQuota + rolloverAmount
    const remaining = Math.max(0, totalAvailable - usage)

    return {
      quotaType,
      baseQuota,
      rolloverAmount,
      totalAvailable,
      usage,
      remaining,
      planName: plan?.planName ?? 'free',
    }
  }

  /**
   * Expire rollovers that have passed their expiration date.
   */
  async expireOldRollovers(): Promise<number> {
    const now = new Date()

    const expired = await db
      .update(schema.quotaRollover)
      .set({ status: 'expired' })
      .where(
        and(eq(schema.quotaRollover.status, 'active'), lte(schema.quotaRollover.expiresAt, now))
      )
      .returning({ id: schema.quotaRollover.id })

    if (expired.length > 0) {
      logger.debug('Expired old rollovers', { count: expired.length })
    }

    return expired.length
  }

  /**
   * Get rollover history for a user, ordered by most recent first.
   */
  async getRolloverHistory(userId: string, quotaType?: QuotaType) {
    const conditions = [eq(schema.quotaRollover.userId, userId)]
    if (quotaType) {
      conditions.push(eq(schema.quotaRollover.quotaType, quotaType))
    }

    return db
      .select()
      .from(schema.quotaRollover)
      .where(and(...conditions))
      .orderBy(asc(schema.quotaRollover.createdAt))
  }
}

export const rolloverService = new RolloverService()
