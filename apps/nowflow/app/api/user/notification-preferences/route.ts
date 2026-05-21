import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  getUserNotificationPreferences,
  updatePreferences,
} from '@/lib/notifications/notification-service'

const logger = createLogger('NotificationPreferencesAPI')

// GET /api/user/notification-preferences - Get notification preferences for the current user
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get user notification preferences (creates defaults if they don't exist)
    const preferences = await getUserNotificationPreferences(userId)

    if (!preferences) {
      logger.error(`[${requestId}] Failed to get or create preferences for user`, { userId })
      return NextResponse.json(
        { error: 'Failed to retrieve notification preferences' },
        { status: 500 }
      )
    }

    logger.info(`[${requestId}] Notification preferences retrieved`, { userId })

    return NextResponse.json({
      data: {
        id: preferences.id,
        userId: preferences.userId,
        workflowCompletion: preferences.workflowCompletion,
        workflowFailure: preferences.workflowFailure,
        approvalRequests: preferences.approvalRequests,
        digestEnabled: preferences.digestEnabled,
        digestSchedule: preferences.digestSchedule,
        createdAt: preferences.createdAt,
        updatedAt: preferences.updatedAt,
      },
    })
  } catch (error) {
    logger.error(`[${requestId}] Failed to fetch notification preferences`, { error })
    return NextResponse.json({ error: 'Failed to fetch notification preferences' }, { status: 500 })
  }
}

// POST /api/user/notification-preferences - Update notification preferences for the current user
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const body = await request.json()
    const { workflowCompletion, workflowFailure, approvalRequests, digestEnabled, digestSchedule } =
      body

    logger.info(`[${requestId}] Updating notification preferences`, { userId, body })

    // Prepare update data - only include fields that are provided
    const updateData: any = {}
    if (workflowCompletion !== undefined) updateData.workflowCompletion = workflowCompletion
    if (workflowFailure !== undefined) updateData.workflowFailure = workflowFailure
    if (approvalRequests !== undefined) updateData.approvalRequests = approvalRequests
    if (digestEnabled !== undefined) updateData.digestEnabled = digestEnabled
    if (digestSchedule !== undefined) updateData.digestSchedule = digestSchedule

    // Update preferences
    const updatedPreferences = await updatePreferences(userId, updateData)

    logger.info(`[${requestId}] Notification preferences updated successfully`, { userId })

    return NextResponse.json({
      data: {
        id: updatedPreferences.id,
        userId: updatedPreferences.userId,
        workflowCompletion: updatedPreferences.workflowCompletion,
        workflowFailure: updatedPreferences.workflowFailure,
        approvalRequests: updatedPreferences.approvalRequests,
        digestEnabled: updatedPreferences.digestEnabled,
        digestSchedule: updatedPreferences.digestSchedule,
        createdAt: updatedPreferences.createdAt,
        updatedAt: updatedPreferences.updatedAt,
      },
    })
  } catch (error) {
    logger.error(`[${requestId}] Failed to update notification preferences`, { error })
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}
