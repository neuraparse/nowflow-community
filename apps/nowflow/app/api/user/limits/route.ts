import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getApiCallUsage } from '@/lib/api-rate-limits'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { getStorageUsage } from '@/lib/storage-limits'
import { getWorkflowUsage } from '@/lib/workflow-limits'
import { db } from '@/db'
import { subscription, subscriptionPlan } from '@/db/schema'

const logger = createLogger('UserLimitsAPI')

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get user's subscription plan from DB
    let planName = 'free'
    let planDisplayName = 'Free'
    try {
      const userSubscription = await db
        .select({
          planName: subscriptionPlan.name,
          planDisplayName: subscriptionPlan.displayName,
        })
        .from(subscription)
        .innerJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
        .where(and(eq(subscription.referenceId, userId), eq(subscription.status, 'active')))
        .orderBy(desc(subscriptionPlan.workflowLimit))
        .limit(1)

      if (userSubscription[0]) {
        planName = userSubscription[0].planName
        planDisplayName = userSubscription[0].planDisplayName
      }
    } catch (error) {
      logger.warn('Error fetching user subscription plan, defaulting to free:', error)
    }

    // Get all limit data in parallel
    const [workflowUsage, apiCallUsage, storageUsage] = await Promise.all([
      getWorkflowUsage(userId),
      getApiCallUsage(userId),
      getStorageUsage(userId),
    ])

    return NextResponse.json({
      plan: planName,
      planDisplayName: planDisplayName,
      workflowCount: workflowUsage.current,
      workflowLimit: workflowUsage.limit,
      apiCallsToday: apiCallUsage.current,
      apiCallsLimit: apiCallUsage.limit,
      storageUsed: storageUsage.current,
      storageLimit: storageUsage.limit,
    })
  } catch (error) {
    logger.error('Error fetching user limits:', error)
    return NextResponse.json({ error: 'Failed to fetch user limits' }, { status: 500 })
  }
}
