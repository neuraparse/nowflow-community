import { createLogger } from '@/lib/logs/console-logger'
import { NormalizedBlockOutput } from './types'

const logger = createLogger('Executor')

interface CompletionNotificationParams {
  workflowId: string
  executionId?: string
  executionTime: number
  result: NormalizedBlockOutput
  debugMode?: boolean
}

interface FailureNotificationParams {
  workflowId: string
  executionId?: string
  error: string
  executionTime: number
  failedBlockId?: string
  debugMode?: boolean
}

/**
 * Sends a workflow completion notification (non-blocking, server-side only).
 * Wrapped in try-catch to prevent notification failures from breaking workflow execution.
 */
export function sendCompletionNotification(params: CompletionNotificationParams): void {
  const { workflowId, executionId, executionTime, result, debugMode } = params
  const modeLabel = debugMode ? ' (debug mode)' : ''

  try {
    if (typeof window === 'undefined') {
      // Only import and send notifications on server-side
      import('@/lib/notifications/notification-service')
        .then(({ sendWorkflowCompletionNotification }) => {
          sendWorkflowCompletionNotification({
            workflowId,
            executionId: executionId ?? '',
            executionTime,
            result,
          }).catch((notificationError) => {
            logger.error(`Failed to send workflow completion notification${modeLabel}`, {
              workflowId,
              executionId,
              error: notificationError,
            })
          })
        })
        .catch((importError) => {
          logger.error(`Failed to import notification service${modeLabel}`, {
            workflowId,
            executionId,
            error: importError,
          })
        })
    }
  } catch (notificationError) {
    logger.error(`Error triggering workflow completion notification${modeLabel}`, {
      workflowId,
      executionId,
      error: notificationError,
    })
  }
}

/**
 * Sends a workflow failure notification (non-blocking, server-side only).
 * Wrapped in try-catch to prevent notification failures from breaking workflow execution.
 */
export function sendFailureNotification(params: FailureNotificationParams): void {
  const { workflowId, executionId, error, executionTime, failedBlockId, debugMode } = params
  const modeLabel = debugMode ? ' (debug mode)' : ''

  try {
    if (typeof window === 'undefined') {
      // Only import and send notifications on server-side
      import('@/lib/notifications/notification-service')
        .then(({ sendWorkflowFailureNotification }) => {
          sendWorkflowFailureNotification({
            workflowId,
            executionId: executionId ?? '',
            error,
            executionTime,
            failedBlockId,
          }).catch((notificationError) => {
            logger.error(`Failed to send workflow failure notification${modeLabel}`, {
              workflowId,
              executionId,
              error: notificationError,
            })
          })
        })
        .catch((importError) => {
          logger.error(`Failed to import notification service${modeLabel}`, {
            workflowId,
            executionId,
            error: importError,
          })
        })
    }
  } catch (notificationError) {
    logger.error(`Error triggering workflow failure notification${modeLabel}`, {
      workflowId,
      executionId,
      error: notificationError,
    })
  }
}
