import { render } from '@react-email/components'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { WorkflowCompletionEmail } from '@/components/emails/workflow-completion-email'
import { WorkflowFailureEmail } from '@/components/emails/workflow-failure-email'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { buildUnsubscribeHeaders } from '@/lib/email/unsubscribe-token'
import { createLogger } from '@/lib/logs/console-logger'
import { sendEmail } from '@/lib/mailer'
import { canSendFailureNotification, canSendWorkflowNotification } from '@/lib/spam-guard'
import { db } from '@/db'
import { user, userNotificationPreferences, workflow, workflowRun } from '@/db/schema'

const logger = createLogger('NotificationService')

export type NotificationEventType = 'workflowCompletion' | 'workflowFailure' | 'approvalRequests'

export interface WorkflowCompletionOptions {
  workflowId: string
  executionId: string
  executionTime?: number
  result?: any
}

export interface WorkflowFailureOptions {
  workflowId: string
  executionId: string
  error: string | Error
  executionTime?: number
  failedBlockId?: string
}

export interface UserNotificationPreferences {
  id: string
  userId: string
  workflowCompletion: boolean
  workflowFailure: boolean
  approvalRequests: boolean
  digestEnabled: boolean
  digestSchedule: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Formats execution time in milliseconds to human-readable format
 */
function formatExecutionTime(milliseconds?: number): string {
  if (!milliseconds) return 'N/A'

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Gets user notification preferences, creating defaults if they don't exist
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences | null> {
  try {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1)

    if (!preferences) {
      // Create default preferences if they don't exist
      return await createDefaultPreferences(userId)
    }

    return preferences as UserNotificationPreferences
  } catch (error) {
    logger.error('Failed to get user notification preferences', { userId, error })
    throw error
  }
}

/**
 * Creates default notification preferences for a user
 */
export async function createDefaultPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  try {
    const preferencesId = uuidv4()
    const now = new Date()

    await db.insert(userNotificationPreferences).values({
      id: preferencesId,
      userId,
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: now,
      updatedAt: now,
    })

    logger.info('Created default notification preferences', { userId, preferencesId })

    return {
      id: preferencesId,
      userId,
      workflowCompletion: true,
      workflowFailure: true,
      approvalRequests: true,
      digestEnabled: false,
      digestSchedule: 'daily',
      createdAt: now,
      updatedAt: now,
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      code: error?.code,
      constraint: error?.constraint,
    }
    logger.error('Failed to create default preferences', { userId, error: errorDetails })
    throw new Error(`Failed to create default preferences: ${errorDetails.message}`)
  }
}

/**
 * Updates user notification preferences
 */
export async function updatePreferences(
  userId: string,
  preferences: Partial<
    Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  >
): Promise<UserNotificationPreferences> {
  try {
    const now = new Date()

    // Ensure preferences exist
    const existing = await getUserNotificationPreferences(userId)
    if (!existing) {
      throw new Error('User preferences not found')
    }

    await db
      .update(userNotificationPreferences)
      .set({
        ...preferences,
        updatedAt: now,
      })
      .where(eq(userNotificationPreferences.userId, userId))

    logger.info('Updated notification preferences', { userId, preferences })

    // Fetch and return updated preferences
    const [updated] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1)

    return updated as UserNotificationPreferences
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      code: error?.code,
    }
    logger.error('Failed to update preferences', { userId, error: errorDetails })
    throw new Error(`Failed to update preferences: ${errorDetails.message}`)
  }
}

/**
 * Checks if user should receive notification for a specific event type
 */
async function checkUserPreferences(
  userId: string,
  eventType: NotificationEventType
): Promise<boolean> {
  try {
    const preferences = await getUserNotificationPreferences(userId)

    if (!preferences) {
      // Default to sending notifications if preferences don't exist
      return true
    }

    switch (eventType) {
      case 'workflowCompletion':
        return preferences.workflowCompletion
      case 'workflowFailure':
        return preferences.workflowFailure
      case 'approvalRequests':
        return preferences.approvalRequests
      default:
        return false
    }
  } catch (error) {
    logger.error('Error checking user preferences', { userId, eventType, error })
    // Default to true in case of error to avoid missing critical notifications
    return true
  }
}

/**
 * Sends workflow completion notification email
 */
export async function sendWorkflowCompletionNotification(
  options: WorkflowCompletionOptions
): Promise<void> {
  const { workflowId, executionId, executionTime, result } = options

  try {
    // Fetch workflow details
    const [workflowData] = await db
      .select()
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData) {
      logger.error('Workflow not found', { workflowId, executionId })
      return
    }

    // Fetch user details
    const [userData] = await db.select().from(user).where(eq(user.id, workflowData.userId)).limit(1)

    if (!userData) {
      logger.error('User not found', { userId: workflowData.userId, workflowId })
      return
    }

    // Check user preferences
    const shouldNotify = await checkUserPreferences(userData.id, 'workflowCompletion')
    if (!shouldNotify) {
      logger.info('User has disabled workflow completion notifications', {
        userId: userData.id,
        workflowId,
      })
      return
    }

    // Rate limit check - prevent notification spam for same workflow
    if (!(await canSendWorkflowNotification(userData.id, workflowId))) {
      logger.info('Workflow completion notification rate-limited', {
        userId: userData.id,
        workflowId,
        executionId,
      })
      return
    }

    // Generate result link
    const baseUrl = APP_DOMAIN
    const resultLink = `${baseUrl}/workflows/${workflowId}/runs/${executionId}`

    // Render email template
    const html = await render(
      WorkflowCompletionEmail({
        userName: userData.name,
        workflowName: workflowData.name,
        completionDate: new Date(),
        executionTime: formatExecutionTime(executionTime),
        resultLink,
        userEmail: userData.email,
      })
    )

    // Send email with unsubscribe headers for Gmail compliance
    const emailResult = await sendEmail({
      to: userData.email,
      subject: `Workflow "${workflowData.name}" completed successfully`,
      html,
      headers: buildUnsubscribeHeaders(userData.id, 'workflowCompletion'),
    })

    if (emailResult.success) {
      logger.info('Workflow completion notification sent', {
        workflowId,
        executionId,
        userId: userData.id,
        email: userData.email,
      })
    } else {
      logger.error('Failed to send workflow completion notification', {
        workflowId,
        executionId,
        userId: userData.id,
        error: emailResult.message,
      })
    }

    // Send via NotificationHub to all other configured channels
    try {
      const { getNotificationHub } = await import('./notification-hub')
      const hub = getNotificationHub()
      await hub.send({
        userId: userData.id,
        channels: ['in_app', 'telegram', 'slack', 'discord', 'whatsapp', 'push'],
        payload: {
          title: 'Workflow Completed',
          body: `Workflow "${workflowData.name}" completed successfully.`,
          actionUrl: `/w/${workflowId}`,
        },
        priority: 'normal',
        category: 'workflowCompletion',
        deduplicationKey: `wf_${executionId}_completion`,
      })
    } catch (hubError) {
      logger.warn('NotificationHub delivery failed (non-critical)', { error: hubError })
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    }
    logger.error('Error sending workflow completion notification', {
      workflowId,
      executionId,
      error: errorDetails,
    })
    // Don't throw - notifications should never break workflow execution
  }
}

/**
 * Sends workflow failure notification email
 */
export async function sendWorkflowFailureNotification(
  options: WorkflowFailureOptions
): Promise<void> {
  const { workflowId, executionId, error, executionTime, failedBlockId } = options

  try {
    // Fetch workflow details
    const [workflowData] = await db
      .select()
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData) {
      logger.error('Workflow not found', { workflowId, executionId })
      return
    }

    // Fetch user details
    const [userData] = await db.select().from(user).where(eq(user.id, workflowData.userId)).limit(1)

    if (!userData) {
      logger.error('User not found', { userId: workflowData.userId, workflowId })
      return
    }

    // Check user preferences
    const shouldNotify = await checkUserPreferences(userData.id, 'workflowFailure')
    if (!shouldNotify) {
      logger.info('User has disabled workflow failure notifications', {
        userId: userData.id,
        workflowId,
      })
      return
    }

    // Rate limit check - use stricter failure-specific limiter with circuit breaker
    // to prevent spam loops from broken triggers (e.g. bad OAuth scope → repeated failures)
    if (!(await canSendFailureNotification(userData.id, workflowId))) {
      logger.info('Workflow failure notification rate-limited (circuit breaker)', {
        userId: userData.id,
        workflowId,
        executionId,
      })
      return
    }

    // Format error message
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Generate details link
    const baseUrl = APP_DOMAIN
    const detailsLink = `${baseUrl}/workflows/${workflowId}/runs/${executionId}`

    // Render email template
    const html = await render(
      WorkflowFailureEmail({
        userName: userData.name,
        workflowName: workflowData.name,
        failureDate: new Date(),
        errorMessage,
        executionTime: formatExecutionTime(executionTime),
        detailsLink,
        userEmail: userData.email,
      })
    )

    // Send email with unsubscribe headers for Gmail compliance
    const emailResult = await sendEmail({
      to: userData.email,
      subject: `Workflow "${workflowData.name}" failed - Action may be required`,
      html,
      headers: buildUnsubscribeHeaders(userData.id, 'workflowFailure'),
    })

    if (emailResult.success) {
      logger.info('Workflow failure notification sent', {
        workflowId,
        executionId,
        userId: userData.id,
        email: userData.email,
      })
    } else {
      logger.error('Failed to send workflow failure notification', {
        workflowId,
        executionId,
        userId: userData.id,
        error: emailResult.message,
      })
    }

    // Send via NotificationHub to all other configured channels
    try {
      const { getNotificationHub } = await import('./notification-hub')
      const hub = getNotificationHub()
      await hub.send({
        userId: userData.id,
        channels: ['in_app', 'telegram', 'slack', 'discord', 'whatsapp', 'push'],
        payload: {
          title: 'Workflow Failed',
          body: `Workflow "${workflowData.name}" failed: ${errorMessage}`,
          actionUrl: `/w/${workflowId}`,
        },
        priority: 'high',
        category: 'workflowFailure',
        deduplicationKey: `wf_${executionId}_failure`,
      })
    } catch (hubError) {
      logger.warn('NotificationHub delivery failed (non-critical)', { error: hubError })
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    }
    logger.error('Error sending workflow failure notification', {
      workflowId,
      executionId,
      error: errorDetails,
    })
    // Don't throw - notifications should never break workflow execution
  }
}
