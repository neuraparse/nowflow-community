import { NextRequest } from 'next/server'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { webhook, webhookLog } from '@/db/schema'
import { calculateHealthStatus, sanitizePayload } from './security'

const logger = createLogger('WebhookMonitoring')

export interface WebhookLogEntry {
  id: string
  webhookId: string
  method: string
  headers: any
  body: any
  queryParams: any
  sourceIp: string
  statusCode: number | null
  responseTime: number | null
  success: boolean
  errorMessage: string | null
  executionId: string | null
  retryCount: number
  triggeredAt: Date
  completedAt: Date | null
}

/**
 * Log webhook trigger
 */
export async function logWebhookTrigger(
  webhookId: string,
  request: NextRequest,
  options: {
    method: string
    sourceIp: string
    body?: any
    queryParams?: any
    executionId?: string
  }
): Promise<string> {
  try {
    const logId = crypto.randomUUID()

    // Sanitize sensitive data
    const sanitizedBody = sanitizePayload(options.body)
    const headers = Object.fromEntries(request.headers.entries())
    const sanitizedHeaders = sanitizePayload(headers)

    await db.insert(webhookLog).values({
      id: logId,
      webhookId,
      method: options.method,
      headers: sanitizedHeaders,
      body: sanitizedBody,
      queryParams: options.queryParams || {},
      sourceIp: options.sourceIp,
      statusCode: null,
      responseTime: null,
      success: false,
      errorMessage: null,
      executionId: options.executionId || null,
      retryCount: 0,
      triggeredAt: new Date(),
      completedAt: null,
    })

    logger.debug(`Webhook trigger logged: ${logId}`)
    return logId
  } catch (error) {
    logger.error('Error logging webhook trigger:', error)
    throw error
  }
}

/**
 * Update webhook log with completion details
 */
export async function updateWebhookLog(
  logId: string,
  options: {
    statusCode: number
    responseTime: number
    success: boolean
    errorMessage?: string
  }
): Promise<void> {
  try {
    await db
      .update(webhookLog)
      .set({
        statusCode: options.statusCode,
        responseTime: options.responseTime,
        success: options.success,
        errorMessage: options.errorMessage || null,
        completedAt: new Date(),
      })
      .where(eq(webhookLog.id, logId))

    logger.debug(`Webhook log updated: ${logId}`)
  } catch (error) {
    logger.error('Error updating webhook log:', error)
  }
}

/**
 * Update webhook statistics
 */
export async function updateWebhookStats(
  webhookId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const updates: any = {
      lastTriggeredAt: new Date(),
      totalTriggers: sql`${webhook.totalTriggers} + 1`,
      updatedAt: new Date(),
    }

    if (success) {
      updates.successfulTriggers = sql`${webhook.successfulTriggers} + 1`
      updates.lastError = null
    } else {
      updates.failedTriggers = sql`${webhook.failedTriggers} + 1`
      if (errorMessage) {
        updates.lastError = errorMessage
      }
    }

    await db.update(webhook).set(updates).where(eq(webhook.id, webhookId))

    // Update health status
    await updateWebhookHealthStatus(webhookId)

    logger.debug(`Webhook stats updated: ${webhookId}`)
  } catch (error) {
    logger.error('Error updating webhook stats:', error)
  }
}

/**
 * Update webhook health status
 */
export async function updateWebhookHealthStatus(webhookId: string): Promise<void> {
  try {
    const webhookData = await db.select().from(webhook).where(eq(webhook.id, webhookId)).limit(1)

    if (webhookData.length === 0) {
      return
    }

    const wh = webhookData[0]
    const healthStatus = calculateHealthStatus(
      wh.totalTriggers,
      wh.successfulTriggers,
      wh.failedTriggers,
      wh.lastTriggeredAt
    )

    await db
      .update(webhook)
      .set({ healthStatus, updatedAt: new Date() })
      .where(eq(webhook.id, webhookId))

    logger.debug(`Webhook health status updated: ${webhookId} -> ${healthStatus}`)
  } catch (error) {
    logger.error('Error updating webhook health status:', error)
  }
}

/**
 * Get webhook logs
 */
export async function getWebhookLogs(
  webhookId: string,
  options: {
    limit?: number
    offset?: number
    successOnly?: boolean
    failedOnly?: boolean
    since?: Date
  } = {}
): Promise<WebhookLogEntry[]> {
  try {
    const { limit = 50, offset = 0, successOnly, failedOnly, since } = options

    let query = db.select().from(webhookLog).where(eq(webhookLog.webhookId, webhookId))

    if (successOnly) {
      query = query.where(eq(webhookLog.success, true)) as any
    } else if (failedOnly) {
      query = query.where(eq(webhookLog.success, false)) as any
    }

    if (since) {
      query = query.where(gte(webhookLog.triggeredAt, since)) as any
    }

    const logs = await query.orderBy(desc(webhookLog.triggeredAt)).limit(limit).offset(offset)

    return logs as WebhookLogEntry[]
  } catch (error) {
    logger.error('Error getting webhook logs:', error)
    return []
  }
}

/**
 * Get webhook statistics
 */
export async function getWebhookStats(webhookId: string): Promise<{
  totalTriggers: number
  successfulTriggers: number
  failedTriggers: number
  successRate: number
  averageResponseTime: number
  lastTriggeredAt: Date | null
  healthStatus: string
} | null> {
  try {
    const webhookData = await db.select().from(webhook).where(eq(webhook.id, webhookId)).limit(1)

    if (webhookData.length === 0) {
      return null
    }

    const wh = webhookData[0]

    // Calculate average response time from recent logs
    const recentLogs = await db
      .select()
      .from(webhookLog)
      .where(and(eq(webhookLog.webhookId, webhookId), eq(webhookLog.success, true)))
      .orderBy(desc(webhookLog.triggeredAt))
      .limit(100)

    const avgResponseTime =
      recentLogs.length > 0
        ? recentLogs.reduce(
            (sum: number, log: { responseTime: number | null }) => sum + (log.responseTime || 0),
            0
          ) / recentLogs.length
        : 0

    const successRate = wh.totalTriggers > 0 ? wh.successfulTriggers / wh.totalTriggers : 0

    return {
      totalTriggers: wh.totalTriggers,
      successfulTriggers: wh.successfulTriggers,
      failedTriggers: wh.failedTriggers,
      successRate,
      averageResponseTime: Math.round(avgResponseTime),
      lastTriggeredAt: wh.lastTriggeredAt,
      healthStatus: wh.healthStatus,
    }
  } catch (error) {
    logger.error('Error getting webhook stats:', error)
    return null
  }
}

/**
 * Clean up old webhook logs
 */
export async function cleanupOldWebhookLogs(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await db.delete(webhookLog).where(sql`${webhookLog.triggeredAt} < ${cutoffDate}`)

    logger.info(`Cleaned up webhook logs older than ${daysToKeep} days`)
    return 0 // drizzle doesn't return affected rows count easily
  } catch (error) {
    logger.error('Error cleaning up old webhook logs:', error)
    return 0
  }
}

/**
 * Get webhook activity timeline
 */
export async function getWebhookActivityTimeline(
  webhookId: string,
  hours: number = 24
): Promise<{ timestamp: Date; success: number; failed: number }[]> {
  try {
    const since = new Date()
    since.setHours(since.getHours() - hours)

    const logs = await db
      .select()
      .from(webhookLog)
      .where(and(eq(webhookLog.webhookId, webhookId), gte(webhookLog.triggeredAt, since)))
      .orderBy(webhookLog.triggeredAt)

    // Group by hour
    const timeline: { [key: string]: { success: number; failed: number } } = {}

    logs.forEach((log: { triggeredAt: Date; success: boolean }) => {
      const hour = new Date(log.triggeredAt)
      hour.setMinutes(0, 0, 0)
      const key = hour.toISOString()

      if (!timeline[key]) {
        timeline[key] = { success: 0, failed: 0 }
      }

      if (log.success) {
        timeline[key].success++
      } else {
        timeline[key].failed++
      }
    })

    return Object.entries(timeline).map(([timestamp, counts]) => ({
      timestamp: new Date(timestamp),
      ...counts,
    }))
  } catch (error) {
    logger.error('Error getting webhook activity timeline:', error)
    return []
  }
}
