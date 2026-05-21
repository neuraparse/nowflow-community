import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { subscription, subscriptionPlan } from '@/db/schema'

const logger = createLogger('subscriptionPlanHelper')

const FREE_PLAN_NAME = 'free'
const FREE_PLAN_ID = 'plan_free'

const FREE_PLAN_DEFAULTS: typeof subscriptionPlan.$inferInsert = {
  id: FREE_PLAN_ID,
  name: FREE_PLAN_NAME,
  displayName: 'Free',
  workflowLimit: 3,
  apiCallsLimit: 20,
  storageLimit: 50, // 50 MB
  costLimit: 5,
  sharingEnabled: false,
  multiplayerEnabled: false,
  workspaceCollaborationEnabled: false,
  price: null,
}

/**
 * Ensure the FREE plan exists in the database.
 * Returns the plan whether it was pre-existing or newly created.
 */
export async function ensureFreePlan() {
  const existing = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, FREE_PLAN_NAME))
    .limit(1)

  if (existing[0]) {
    return existing[0]
  }

  logger.warn('FREE subscription plan missing - seeding default one automatically.')

  const [inserted] = await db.insert(subscriptionPlan).values(FREE_PLAN_DEFAULTS).returning()

  logger.info('Default FREE subscription plan created successfully', {
    planId: inserted.id,
  })

  return inserted
}

export async function ensureFreeSubscriptionForUser(userId: string) {
  if (!userId) {
    throw new Error('User ID is required to ensure subscription')
  }

  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, userId))
    .limit(1)

  if (existing[0]) {
    return existing[0]
  }

  const freePlan = await ensureFreePlan()
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const [inserted] = await db
    .insert(subscription)
    .values({
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      planId: freePlan.id,
      referenceId: userId,
      status: 'active',
      periodStart: now,
      periodEnd,
      seats: 1,
    })
    .returning()

  logger.info('Created default FREE subscription for user', {
    userId,
    planId: freePlan.id,
  })

  return inserted
}
