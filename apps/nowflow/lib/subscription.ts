import { eq, inArray } from 'drizzle-orm'
import { isProd } from '@/lib/environment'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { client } from './auth-client'

const logger = createLogger('Subscription')

type SubscriptionPlanRecord = {
  status: string | null
  planName: string | null
  referenceId: string
}

type ClientSubscription = {
  status: string
  limits?: {
    cost?: number
    sharingEnabled?: boolean
    multiplayerEnabled?: boolean
    workspaceCollaborationEnabled?: boolean
  }
}

async function getSubscriptionsWithPlan(referenceId: string): Promise<SubscriptionPlanRecord[]> {
  return db
    .select({
      status: schema.subscription.status,
      planName: schema.subscriptionPlan.name,
      referenceId: schema.subscription.referenceId,
    })
    .from(schema.subscription)
    .leftJoin(schema.subscriptionPlan, eq(schema.subscription.planId, schema.subscriptionPlan.id))
    .where(eq(schema.subscription.referenceId, referenceId))
}

/**
 * Batch fetch subscriptions for multiple reference IDs in a single query.
 * Eliminates N+1 pattern where each org membership triggered a separate query.
 */
async function getBatchSubscriptionsWithPlan(
  referenceIds: string[]
): Promise<SubscriptionPlanRecord[]> {
  if (referenceIds.length === 0) return []
  return db
    .select({
      status: schema.subscription.status,
      planName: schema.subscriptionPlan.name,
      referenceId: schema.subscription.referenceId,
    })
    .from(schema.subscription)
    .leftJoin(schema.subscriptionPlan, eq(schema.subscription.planId, schema.subscriptionPlan.id))
    .where(inArray(schema.subscription.referenceId, referenceIds))
}

function hasActivePlan(
  subscriptions: SubscriptionPlanRecord[],
  predicate: (planName: string) => boolean
) {
  return subscriptions.some(
    (sub) => sub.status === 'active' && sub.planName !== null && predicate(sub.planName)
  )
}

/**
 * Core plan check: fetches user memberships + all org subscriptions in 2 queries (not N+1).
 * Returns true if any org or direct subscription matches the predicate.
 */
async function checkPlanAccess(
  userId: string,
  predicate: (planName: string) => boolean
): Promise<boolean> {
  const memberships = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))

  // Single batch query for all org subscriptions + direct user subscription
  const allReferenceIds = [
    ...memberships.map((m: { organizationId: string }) => m.organizationId),
    userId,
  ]

  const allSubscriptions = await getBatchSubscriptionsWithPlan(allReferenceIds)

  return hasActivePlan(allSubscriptions, predicate)
}

/**
 * Check if the user is on any paid plan (Starter or above)
 */
export async function isStarterPlan(userId: string): Promise<boolean> {
  try {
    return await checkPlanAccess(userId, (planName) =>
      ['starter', 'mid', 'pro', 'team', 'enterprise'].includes(planName)
    )
  } catch (error) {
    logger.error('Error checking starter plan status', { error, userId })
    return false
  }
}

/**
 * Check if the user is on the Mid plan or above
 */
export async function isMidPlan(userId: string): Promise<boolean> {
  try {
    return await checkPlanAccess(userId, (planName) =>
      ['mid', 'pro', 'team', 'enterprise'].includes(planName)
    )
  } catch (error) {
    logger.error('Error checking mid plan status', { error, userId })
    return false
  }
}

/**
 * Check if the user is on the Pro plan
 */
export async function isProPlan(userId: string): Promise<boolean> {
  try {
    return await checkPlanAccess(userId, (planName) =>
      ['pro', 'team', 'enterprise'].includes(planName)
    )
  } catch (error) {
    logger.error('Error checking pro plan status', { error, userId })
    return false
  }
}

/**
 * Check if the user is on the Team plan
 */
export async function isTeamPlan(userId: string): Promise<boolean> {
  try {
    return await checkPlanAccess(userId, (planName) => planName === 'team')
  } catch (error) {
    logger.error('Error checking team plan status', { error, userId })
    return false
  }
}

/**
 * Check if a user has exceeded their cost limit based on their subscription plan
 */
export async function hasExceededCostLimit(userId: string): Promise<boolean> {
  try {
    // In development, users never exceed their limit
    if (!isProd) {
      return false
    }

    // Get user's direct subscription
    const { data: directSubscriptions } = await client.subscription.list({
      query: { referenceId: userId },
    })

    // Find active direct subscription
    const activeDirectSubscription = directSubscriptions?.find(
      (sub: ClientSubscription) => sub.status === 'active'
    )

    // Get organizations the user belongs to
    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))

    let highestCostLimit = 0

    // Check cost limit from direct subscription
    if (activeDirectSubscription && typeof activeDirectSubscription.limits?.cost === 'number') {
      highestCostLimit = activeDirectSubscription.limits.cost
    }

    // Batch fetch all org subscriptions in parallel
    const orgSubscriptionResults = await Promise.all(
      memberships.map((m: { organizationId: string }) =>
        client.subscription.list({ query: { referenceId: m.organizationId } })
      )
    )

    for (const { data: orgSubscriptions } of orgSubscriptionResults) {
      const activeOrgSubscription = orgSubscriptions?.find(
        (sub: ClientSubscription) => sub.status === 'active'
      )

      if (
        activeOrgSubscription &&
        typeof activeOrgSubscription.limits?.cost === 'number' &&
        activeOrgSubscription.limits.cost > highestCostLimit
      ) {
        highestCostLimit = activeOrgSubscription.limits.cost
      }
    }

    // If no subscription found, use default free tier limit
    if (highestCostLimit === 0) {
      highestCostLimit = process.env.FREE_TIER_COST_LIMIT
        ? parseFloat(process.env.FREE_TIER_COST_LIMIT)
        : 5
    }

    logger.debug('User cost limit from subscription', { userId, costLimit: highestCostLimit })

    // Get user's actual usage from the database
    const statsRecords = await db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1)

    if (statsRecords.length === 0) {
      return false
    }

    const currentCost = parseFloat(statsRecords[0].totalCost.toString())

    return currentCost >= highestCostLimit
  } catch (error) {
    logger.error('Error checking cost limit', { error, userId })
    return false
  }
}

/**
 * Check if a user is allowed to share workflows based on their subscription plan
 */
export async function isSharingEnabled(userId: string): Promise<boolean> {
  try {
    if (!isProd) {
      return true
    }

    // Check direct subscription
    const { data: directSubscriptions } = await client.subscription.list({
      query: { referenceId: userId },
    })

    const activeDirectSubscription = directSubscriptions?.find(
      (sub: ClientSubscription) => sub.status === 'active'
    )

    if (activeDirectSubscription && activeDirectSubscription.limits?.sharingEnabled) {
      return true
    }

    // Check organizations the user belongs to
    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))

    // Batch fetch all org subscriptions in parallel
    const orgSubscriptionResults = await Promise.all(
      memberships.map((m: { organizationId: string }) =>
        client.subscription.list({ query: { referenceId: m.organizationId } })
      )
    )

    for (const { data: orgSubscriptions } of orgSubscriptionResults) {
      const activeOrgSubscription = orgSubscriptions?.find(
        (sub: ClientSubscription) => sub.status === 'active'
      )
      if (activeOrgSubscription && activeOrgSubscription.limits?.sharingEnabled) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Error checking sharing permission', { error, userId })
    return false
  }
}

/**
 * Check if multiplayer collaboration is enabled for the user
 */
export async function isMultiplayerEnabled(userId: string): Promise<boolean> {
  try {
    if (!isProd) {
      return true
    }

    const { data: directSubscriptions } = await client.subscription.list({
      query: { referenceId: userId },
    })

    const activeDirectSubscription = directSubscriptions?.find(
      (sub: ClientSubscription) => sub.status === 'active'
    )

    if (activeDirectSubscription && activeDirectSubscription.limits?.multiplayerEnabled) {
      return true
    }

    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))

    const orgSubscriptionResults = await Promise.all(
      memberships.map((m: { organizationId: string }) =>
        client.subscription.list({ query: { referenceId: m.organizationId } })
      )
    )

    for (const { data: orgSubscriptions } of orgSubscriptionResults) {
      const activeOrgSubscription = orgSubscriptions?.find(
        (sub: ClientSubscription) => sub.status === 'active'
      )
      if (activeOrgSubscription && activeOrgSubscription.limits?.multiplayerEnabled) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Error checking multiplayer permission', { error, userId })
    return false
  }
}

/**
 * Check if workspace collaboration is enabled for the user
 */
export async function isWorkspaceCollaborationEnabled(userId: string): Promise<boolean> {
  try {
    if (!isProd) {
      return true
    }

    const { data: directSubscriptions } = await client.subscription.list({
      query: { referenceId: userId },
    })

    const activeDirectSubscription = directSubscriptions?.find(
      (sub: ClientSubscription) => sub.status === 'active'
    )

    if (
      activeDirectSubscription &&
      activeDirectSubscription.limits?.workspaceCollaborationEnabled
    ) {
      return true
    }

    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))

    const orgSubscriptionResults = await Promise.all(
      memberships.map((m: { organizationId: string }) =>
        client.subscription.list({ query: { referenceId: m.organizationId } })
      )
    )

    for (const { data: orgSubscriptions } of orgSubscriptionResults) {
      const activeOrgSubscription = orgSubscriptions?.find(
        (sub: ClientSubscription) => sub.status === 'active'
      )
      if (activeOrgSubscription && activeOrgSubscription.limits?.workspaceCollaborationEnabled) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Error checking workspace collaboration permission', { error, userId })
    return false
  }
}
