import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { alertEvent, analyticsAlert, workflowAnalytics } from '@/db/schema'

const logger = createLogger('AlertProcessor')

export interface AlertConfig {
  id: string
  userId: string
  workflowId: string | null
  name: string
  description: string | null
  isEnabled: boolean
  metric: string
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  threshold: number
  windowMinutes: number
  notificationChannels: string[]
  webhookUrl: string | null
  slackWebhookUrl: string | null
  lastTriggeredAt: Date | null
  cooldownMinutes: number
  triggerCount: number
}

export interface AlertEventData {
  id: string
  alertId: string
  workflowId: string | null
  metricValue: number
  thresholdValue: number
  status: 'triggered' | 'acknowledged' | 'resolved'
  acknowledgedBy: string | null
  acknowledgedAt: Date | null
  resolvedAt: Date | null
  notificationsSent: string[]
  metadata: any
  createdAt: Date
}

/**
 * Creates a new alert
 */
export async function createAlert(
  userId: string,
  config: {
    workflowId?: string
    name: string
    description?: string
    metric: string
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
    threshold: number
    windowMinutes?: number
    notificationChannels?: string[]
    webhookUrl?: string
    slackWebhookUrl?: string
    cooldownMinutes?: number
  }
): Promise<AlertConfig> {
  try {
    const alertId = uuidv4()
    const now = new Date()

    await db.insert(analyticsAlert).values({
      id: alertId,
      userId,
      workflowId: config.workflowId || null,
      name: config.name,
      description: config.description || null,
      isEnabled: true,
      metric: config.metric,
      operator: config.operator,
      threshold: String(config.threshold),
      windowMinutes: config.windowMinutes || 60,
      notificationChannels: config.notificationChannels || ['email'],
      webhookUrl: config.webhookUrl || null,
      slackWebhookUrl: config.slackWebhookUrl || null,
      cooldownMinutes: config.cooldownMinutes || 60,
      triggerCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    logger.info('Created alert', { alertId, name: config.name, metric: config.metric })

    return {
      id: alertId,
      userId,
      workflowId: config.workflowId || null,
      name: config.name,
      description: config.description || null,
      isEnabled: true,
      metric: config.metric,
      operator: config.operator,
      threshold: config.threshold,
      windowMinutes: config.windowMinutes || 60,
      notificationChannels: config.notificationChannels || ['email'],
      webhookUrl: config.webhookUrl || null,
      slackWebhookUrl: config.slackWebhookUrl || null,
      lastTriggeredAt: null,
      cooldownMinutes: config.cooldownMinutes || 60,
      triggerCount: 0,
    }
  } catch (error) {
    logger.error('Failed to create alert', { error })
    throw error
  }
}

/**
 * Gets alerts for a user
 */
export async function getUserAlerts(userId: string): Promise<AlertConfig[]> {
  try {
    const alerts = await db
      .select()
      .from(analyticsAlert)
      .where(eq(analyticsAlert.userId, userId))
      .orderBy(desc(analyticsAlert.createdAt))

    return alerts.map((a: typeof analyticsAlert.$inferSelect) => ({
      id: a.id,
      userId: a.userId,
      workflowId: a.workflowId,
      name: a.name,
      description: a.description,
      isEnabled: a.isEnabled,
      metric: a.metric,
      operator: a.operator as AlertConfig['operator'],
      threshold: Number(a.threshold),
      windowMinutes: a.windowMinutes,
      notificationChannels: (a.notificationChannels as string[]) || [],
      webhookUrl: a.webhookUrl,
      slackWebhookUrl: a.slackWebhookUrl,
      lastTriggeredAt: a.lastTriggeredAt,
      cooldownMinutes: a.cooldownMinutes,
      triggerCount: a.triggerCount,
    }))
  } catch (error) {
    logger.error('Failed to get user alerts', { userId, error })
    throw error
  }
}

/**
 * Updates an alert
 */
export async function updateAlert(
  alertId: string,
  updates: Partial<{
    name: string
    description: string
    isEnabled: boolean
    metric: string
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
    threshold: number
    windowMinutes: number
    notificationChannels: string[]
    webhookUrl: string
    slackWebhookUrl: string
    cooldownMinutes: number
  }>
): Promise<void> {
  try {
    const updateData: Record<string, any> = { ...updates, updatedAt: new Date() }
    if (updates.threshold !== undefined) {
      updateData.threshold = String(updates.threshold)
    }

    await db.update(analyticsAlert).set(updateData).where(eq(analyticsAlert.id, alertId))

    logger.debug('Updated alert', { alertId })
  } catch (error) {
    logger.error('Failed to update alert', { alertId, error })
    throw error
  }
}

/**
 * Deletes an alert
 */
export async function deleteAlert(alertId: string): Promise<void> {
  try {
    await db.delete(analyticsAlert).where(eq(analyticsAlert.id, alertId))
    logger.info('Deleted alert', { alertId })
  } catch (error) {
    logger.error('Failed to delete alert', { alertId, error })
    throw error
  }
}

/**
 * Processes all active alerts
 */
export async function processAlerts(): Promise<number> {
  try {
    // Get all enabled alerts
    const alerts = await db.select().from(analyticsAlert).where(eq(analyticsAlert.isEnabled, true))

    let triggeredCount = 0

    for (const alert of alerts) {
      try {
        // Check cooldown
        if (alert.lastTriggeredAt) {
          const cooldownEnd = new Date(
            alert.lastTriggeredAt.getTime() + alert.cooldownMinutes * 60 * 1000
          )
          if (new Date() < cooldownEnd) {
            continue
          }
        }

        // Get metric value
        const metricValue = await getMetricValue(
          alert.metric,
          alert.workflowId,
          alert.windowMinutes
        )

        if (metricValue === null) {
          continue
        }

        // Check threshold
        const threshold = Number(alert.threshold)
        const triggered = evaluateCondition(metricValue, alert.operator, threshold)

        if (triggered) {
          await triggerAlert(alert as any, metricValue, threshold)
          triggeredCount++
        }
      } catch (err) {
        logger.error('Failed to process alert', { alertId: alert.id, error: err })
      }
    }

    if (triggeredCount > 0) {
      logger.info(`Triggered ${triggeredCount} alerts`)
    }

    return triggeredCount
  } catch (error) {
    logger.error('Failed to process alerts', { error })
    throw error
  }
}

/**
 * Gets the metric value for an alert
 */
async function getMetricValue(
  metric: string,
  workflowId: string | null,
  windowMinutes: number
): Promise<number | null> {
  const startTime = new Date(Date.now() - windowMinutes * 60 * 1000)

  try {
    const conditions = [gte(workflowAnalytics.date, startTime)]
    if (workflowId) {
      conditions.push(eq(workflowAnalytics.workflowId, workflowId))
    }

    const [result] = await db
      .select({
        totalExecutions: sql`sum(${workflowAnalytics.totalExecutions})`,
        successfulExecutions: sql`sum(${workflowAnalytics.successfulExecutions})`,
        failedExecutions: sql`sum(${workflowAnalytics.failedExecutions})`,
        totalTokens: sql`sum(${workflowAnalytics.totalTokens})`,
        totalCost: sql`sum(${workflowAnalytics.totalCost}::numeric)`,
        avgLatency: sql`avg(${workflowAnalytics.avgExecutionTime})`,
        p95Latency: sql`avg(${workflowAnalytics.p95ExecutionTime})`,
        errorCount: sql`sum(${workflowAnalytics.errorCount})`,
      })
      .from(workflowAnalytics)
      .where(and(...conditions))

    if (!result) {
      return null
    }

    switch (metric) {
      case 'error_rate':
        const total = Number(result.totalExecutions) || 0
        const errors = Number(result.failedExecutions) || 0
        return total > 0 ? (errors / total) * 100 : 0

      case 'latency_avg':
        return Number(result.avgLatency) || 0

      case 'latency_p95':
        return Number(result.p95Latency) || 0

      case 'cost_total':
        return Number(result.totalCost) || 0

      case 'execution_count':
        return Number(result.totalExecutions) || 0

      case 'token_usage':
        return Number(result.totalTokens) || 0

      default:
        return null
    }
  } catch (error) {
    logger.error('Failed to get metric value', { metric, workflowId, error })
    return null
  }
}

/**
 * Evaluates the alert condition
 */
function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold
    case 'lt':
      return value < threshold
    case 'gte':
      return value >= threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return value === threshold
    default:
      return false
  }
}

/**
 * Triggers an alert
 */
async function triggerAlert(
  alert: AlertConfig,
  metricValue: number,
  threshold: number
): Promise<void> {
  try {
    const eventId = uuidv4()
    const now = new Date()

    // Create alert event
    await db.insert(alertEvent).values({
      id: eventId,
      alertId: alert.id,
      workflowId: alert.workflowId,
      metricValue: String(metricValue),
      thresholdValue: String(threshold),
      status: 'triggered',
      notificationsSent: [],
      createdAt: now,
    })

    // Update alert
    await db
      .update(analyticsAlert)
      .set({
        lastTriggeredAt: now,
        triggerCount: alert.triggerCount + 1,
        updatedAt: now,
      })
      .where(eq(analyticsAlert.id, alert.id))

    // Send notifications
    const sentNotifications: string[] = []

    for (const channel of alert.notificationChannels) {
      try {
        await sendAlertNotification(alert, channel, metricValue, threshold)
        sentNotifications.push(channel)
      } catch (err) {
        logger.error('Failed to send notification', { alertId: alert.id, channel, error: err })
      }
    }

    // Update event with sent notifications
    await db
      .update(alertEvent)
      .set({ notificationsSent: sentNotifications })
      .where(eq(alertEvent.id, eventId))

    logger.info('Triggered alert', {
      alertId: alert.id,
      name: alert.name,
      metric: alert.metric,
      value: metricValue,
      threshold,
    })
  } catch (error) {
    logger.error('Failed to trigger alert', { alertId: alert.id, error })
    throw error
  }
}

/**
 * Sends alert notification
 */
async function sendAlertNotification(
  alert: AlertConfig,
  channel: string,
  metricValue: number,
  threshold: number
): Promise<void> {
  const message =
    `Alert: ${alert.name}\n` +
    `Metric: ${alert.metric}\n` +
    `Value: ${metricValue.toFixed(2)}\n` +
    `Threshold: ${alert.operator} ${threshold}\n` +
    `Workflow: ${alert.workflowId || 'All workflows'}`

  switch (channel) {
    case 'email':
      // TODO: Implement email notification
      logger.debug('Would send email notification', { alertId: alert.id })
      break

    case 'slack':
      if (alert.slackWebhookUrl) {
        await fetch(alert.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: message,
            username: 'NowFlow Alerts',
            icon_emoji: ':warning:',
          }),
        })
      }
      break

    case 'webhook':
      if (alert.webhookUrl) {
        await fetch(alert.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertId: alert.id,
            alertName: alert.name,
            metric: alert.metric,
            value: metricValue,
            threshold,
            operator: alert.operator,
            workflowId: alert.workflowId,
            timestamp: new Date().toISOString(),
          }),
        })
      }
      break
  }
}

/**
 * Acknowledges an alert event
 */
export async function acknowledgeAlert(eventId: string, userId: string): Promise<void> {
  try {
    await db
      .update(alertEvent)
      .set({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(alertEvent.id, eventId))

    logger.info('Acknowledged alert event', { eventId, userId })
  } catch (error) {
    logger.error('Failed to acknowledge alert', { eventId, error })
    throw error
  }
}

/**
 * Resolves an alert event
 */
export async function resolveAlert(eventId: string): Promise<void> {
  try {
    await db
      .update(alertEvent)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(alertEvent.id, eventId))

    logger.info('Resolved alert event', { eventId })
  } catch (error) {
    logger.error('Failed to resolve alert', { eventId, error })
    throw error
  }
}

/**
 * Gets recent alert events
 */
export async function getAlertEvents(
  userId: string,
  options: { limit?: number; offset?: number; status?: string } = {}
): Promise<{ events: AlertEventData[]; total: number }> {
  const { limit = 50, offset = 0, status } = options

  try {
    // Get user's alert IDs
    const userAlerts = await db
      .select({ id: analyticsAlert.id })
      .from(analyticsAlert)
      .where(eq(analyticsAlert.userId, userId))

    const alertIds = userAlerts.map((a: { id: string }) => a.id)

    if (alertIds.length === 0) {
      return { events: [], total: 0 }
    }

    const conditions = [sql`${alertEvent.alertId} IN (${sql.join(alertIds, sql`, `)})`]
    if (status) {
      conditions.push(eq(alertEvent.status, status))
    }

    const events = await db
      .select()
      .from(alertEvent)
      .where(and(...conditions))
      .orderBy(desc(alertEvent.createdAt))
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(alertEvent)
      .where(and(...conditions))

    return {
      events: events.map((e: typeof alertEvent.$inferSelect) => ({
        id: e.id,
        alertId: e.alertId,
        workflowId: e.workflowId,
        metricValue: Number(e.metricValue),
        thresholdValue: Number(e.thresholdValue),
        status: e.status as AlertEventData['status'],
        acknowledgedBy: e.acknowledgedBy,
        acknowledgedAt: e.acknowledgedAt,
        resolvedAt: e.resolvedAt,
        notificationsSent: (e.notificationsSent as string[]) || [],
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      total: Number(count),
    }
  } catch (error) {
    logger.error('Failed to get alert events', { userId, error })
    throw error
  }
}
