import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { isMidPlan, isProPlan, isStarterPlan, isTeamPlan } from '@/lib/subscription'

const logger = createLogger('UserSubscriptionAPI')

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getSession()

    if (!session?.user?.id) {
      logger.warn('Unauthorized subscription access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const [isPro, isTeam, isStarter, isMid] = await Promise.all([
      isProPlan(userId),
      isTeamPlan(userId),
      isStarterPlan(userId),
      isMidPlan(userId),
    ])

    return NextResponse.json({ isPro, isTeam, isStarter, isMid })
  } catch (error) {
    logger.error('Error checking subscription status:', error)
    return NextResponse.json({ error: 'Failed to check subscription status' }, { status: 500 })
  }
}
