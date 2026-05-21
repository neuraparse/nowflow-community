import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { webhook, webhookLog } from '@/db/schema'

const logger = createLogger('WebhookRetry')

export interface RetryConfig {
  enabled: boolean
  maxRetries: number
  retryDelay: number // seconds
  backoffMultiplier?: number // exponential backoff multiplier
}

export interface RetryJob {
  webhookId: string
  logId: string
  retryCount: number
  nextRetryAt: Date
  payload: any
  headers: any
}

// In-memory retry queue (for production, use Redis or a job queue)
const retryQueue: Map<string, RetryJob> = new Map()

/**
 * Schedule a webhook retry
 */
export async function scheduleWebhookRetry(
  webhookId: string,
  logId: string,
  payload: any,
  headers: any,
  retryCount: number = 0
): Promise<void> {
  try {
    // Get webhook configuration
    const webhookData = await db.select().from(webhook).where(eq(webhook.id, webhookId)).limit(1)

    if (webhookData.length === 0) {
      logger.warn(`Webhook not found for retry: ${webhookId}`)
      return
    }

    const wh = webhookData[0]

    // Check if retry is enabled
    if (!wh.retryEnabled) {
      logger.debug(`Retry disabled for webhook: ${webhookId}`)
      return
    }

    // Check if max retries exceeded
    if (retryCount >= wh.maxRetries) {
      logger.warn(`Max retries exceeded for webhook: ${webhookId}`)
      return
    }

    // Calculate next retry time with exponential backoff
    const backoffMultiplier = 2 // exponential backoff
    const delaySeconds = wh.retryDelay * Math.pow(backoffMultiplier, retryCount)
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000)

    const retryJob: RetryJob = {
      webhookId,
      logId,
      retryCount: retryCount + 1,
      nextRetryAt,
      payload,
      headers,
    }

    retryQueue.set(logId, retryJob)

    logger.info(
      `Scheduled retry for webhook ${webhookId}, attempt ${retryCount + 1}/${wh.maxRetries}, next retry at ${nextRetryAt.toISOString()}`
    )

    // Update webhook log with retry info
    await db
      .update(webhookLog)
      .set({
        retryCount: retryCount + 1,
      })
      .where(eq(webhookLog.id, logId))
  } catch (error) {
    logger.error('Error scheduling webhook retry:', error)
  }
}

/**
 * Process retry queue
 */
export async function processRetryQueue(): Promise<void> {
  const now = new Date()
  const jobsToRetry: RetryJob[] = []

  // Find jobs ready for retry
  for (const [logId, job] of retryQueue.entries()) {
    if (job.nextRetryAt <= now) {
      jobsToRetry.push(job)
      retryQueue.delete(logId)
    }
  }

  if (jobsToRetry.length === 0) {
    return
  }

  logger.info(`Processing ${jobsToRetry.length} webhook retries`)

  // Process each retry job
  for (const job of jobsToRetry) {
    try {
      await retryWebhook(job)
    } catch (error) {
      logger.error(`Error processing retry for webhook ${job.webhookId}:`, error)
    }
  }
}

/**
 * Retry a webhook execution
 */
async function retryWebhook(job: RetryJob): Promise<void> {
  try {
    logger.info(`Retrying webhook ${job.webhookId}, attempt ${job.retryCount}`)

    // Get webhook details
    const webhookData = await db
      .select()
      .from(webhook)
      .where(eq(webhook.id, job.webhookId))
      .limit(1)

    if (webhookData.length === 0) {
      logger.warn(`Webhook not found for retry: ${job.webhookId}`)
      return
    }

    const wh = webhookData[0]

    // Import processWebhook dynamically to avoid circular dependencies
    const { processWebhook } = await import('./utils')

    // Get workflow details
    const { workflow: workflowSchema } = await import('@/db/schema')
    const workflowData = await db
      .select()
      .from(workflowSchema)
      .where(eq(workflowSchema.id, wh.workflowId))
      .limit(1)

    if (workflowData.length === 0) {
      logger.warn(`Workflow not found for webhook retry: ${wh.workflowId}`)
      return
    }

    // Create a mock request object
    const mockRequest = {
      headers: new Headers(job.headers),
      url: `https://app.example.com/api/webhooks/trigger/${wh.path}`,
      method: 'POST',
    } as any

    const executionId = crypto.randomUUID()
    const requestId = crypto.randomUUID().slice(0, 8)

    // Execute the webhook
    const startTime = Date.now()
    const response = await processWebhook(
      wh,
      workflowData[0],
      job.payload,
      mockRequest,
      executionId,
      requestId
    )
    const responseTime = Date.now() - startTime

    const success = response.status >= 200 && response.status < 300

    // Update webhook log
    await db
      .update(webhookLog)
      .set({
        statusCode: response.status,
        responseTime,
        success,
        completedAt: new Date(),
      })
      .where(eq(webhookLog.id, job.logId))

    if (success) {
      logger.info(`Webhook retry successful: ${job.webhookId}`)
    } else {
      logger.warn(`Webhook retry failed: ${job.webhookId}, status: ${response.status}`)

      // Schedule another retry if needed
      await scheduleWebhookRetry(job.webhookId, job.logId, job.payload, job.headers, job.retryCount)
    }
  } catch (error) {
    logger.error(`Error retrying webhook ${job.webhookId}:`, error)

    // Schedule another retry if needed
    await scheduleWebhookRetry(job.webhookId, job.logId, job.payload, job.headers, job.retryCount)
  }
}

/**
 * Cancel a scheduled retry
 */
export function cancelRetry(logId: string): boolean {
  return retryQueue.delete(logId)
}

/**
 * Get retry queue status
 */
export function getRetryQueueStatus(): {
  queueSize: number
  jobs: Array<{
    webhookId: string
    logId: string
    retryCount: number
    nextRetryAt: Date
  }>
} {
  const jobs = Array.from(retryQueue.values()).map((job) => ({
    webhookId: job.webhookId,
    logId: job.logId,
    retryCount: job.retryCount,
    nextRetryAt: job.nextRetryAt,
  }))

  return {
    queueSize: retryQueue.size,
    jobs,
  }
}

/**
 * Clear retry queue
 */
export function clearRetryQueue(): void {
  retryQueue.clear()
  logger.info('Retry queue cleared')
}

// Start retry queue processor (runs every 30 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    processRetryQueue().catch((error) => {
      logger.error('Error in retry queue processor:', error)
    })
  }, 30000)

  logger.info('Webhook retry queue processor started')
}
