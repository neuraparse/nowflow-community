import { and, desc, eq, inArray } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import {
  getDefaultLimits,
  type SubscriptionLimits,
  type SubscriptionTier,
} from '@/lib/subscription-limits'
import { db } from '@/db'
import { member, subscription, subscriptionPlan } from '@/db/schema'

const logger = createLogger('SubscriptionPlanAccess')

export interface EffectiveSubscriptionPlan extends SubscriptionLimits {
  id: string
  name: SubscriptionTier
  displayName: string
  price: number | null
}

const DEFAULT_FREE_PLAN: EffectiveSubscriptionPlan = {
  id: 'fallback-free-plan',
  name: 'free',
  displayName: 'Free',
  price: null,
  ...getDefaultLimits(),
}

export async function getEffectiveSubscriptionPlan(
  userId: string
): Promise<EffectiveSubscriptionPlan> {
  if (!userId) {
    return DEFAULT_FREE_PLAN
  }

  try {
    const memberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))

    const referenceIds = Array.from(
      new Set([
        userId,
        ...memberships.map((membership: { organizationId: string }) => membership.organizationId),
      ])
    )

    const [activePlan] = await db
      .select({
        id: subscriptionPlan.id,
        name: subscriptionPlan.name,
        displayName: subscriptionPlan.displayName,
        workflowLimit: subscriptionPlan.workflowLimit,
        apiCallsLimit: subscriptionPlan.apiCallsLimit,
        storageLimit: subscriptionPlan.storageLimit,
        costLimit: subscriptionPlan.costLimit,
        sharingEnabled: subscriptionPlan.sharingEnabled,
        multiplayerEnabled: subscriptionPlan.multiplayerEnabled,
        workspaceCollaborationEnabled: subscriptionPlan.workspaceCollaborationEnabled,
        price: subscriptionPlan.price,
      })
      .from(subscription)
      .innerJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
      .where(
        and(inArray(subscription.referenceId, referenceIds), eq(subscription.status, 'active'))
      )
      .orderBy(
        desc(subscriptionPlan.workflowLimit),
        desc(subscriptionPlan.apiCallsLimit),
        desc(subscriptionPlan.storageLimit),
        desc(subscriptionPlan.costLimit)
      )
      .limit(1)

    if (activePlan) {
      return {
        id: activePlan.id,
        name: (activePlan.name as SubscriptionTier) || 'free',
        displayName: activePlan.displayName,
        workflowLimit: activePlan.workflowLimit,
        apiCallsLimit: activePlan.apiCallsLimit,
        storageLimit: activePlan.storageLimit,
        costLimit: activePlan.costLimit,
        sharingEnabled: activePlan.sharingEnabled,
        multiplayerEnabled: activePlan.multiplayerEnabled,
        workspaceCollaborationEnabled: activePlan.workspaceCollaborationEnabled,
        price: activePlan.price,
      }
    }

    const [freePlan] = await db
      .select({
        id: subscriptionPlan.id,
        name: subscriptionPlan.name,
        displayName: subscriptionPlan.displayName,
        workflowLimit: subscriptionPlan.workflowLimit,
        apiCallsLimit: subscriptionPlan.apiCallsLimit,
        storageLimit: subscriptionPlan.storageLimit,
        costLimit: subscriptionPlan.costLimit,
        sharingEnabled: subscriptionPlan.sharingEnabled,
        multiplayerEnabled: subscriptionPlan.multiplayerEnabled,
        workspaceCollaborationEnabled: subscriptionPlan.workspaceCollaborationEnabled,
        price: subscriptionPlan.price,
      })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.name, 'free'))
      .limit(1)

    if (freePlan) {
      return {
        id: freePlan.id,
        name: (freePlan.name as SubscriptionTier) || 'free',
        displayName: freePlan.displayName,
        workflowLimit: freePlan.workflowLimit,
        apiCallsLimit: freePlan.apiCallsLimit,
        storageLimit: freePlan.storageLimit,
        costLimit: freePlan.costLimit,
        sharingEnabled: freePlan.sharingEnabled,
        multiplayerEnabled: freePlan.multiplayerEnabled,
        workspaceCollaborationEnabled: freePlan.workspaceCollaborationEnabled,
        price: freePlan.price,
      }
    }
  } catch (error) {
    logger.error('Failed to resolve effective subscription plan', { error, userId })
  }

  return DEFAULT_FREE_PLAN
}
