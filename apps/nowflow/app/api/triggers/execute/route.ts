import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, lte } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { executeCalendarPolling } from '@/lib/triggers/calendar-polling'
import { executeDatabasePolling } from '@/lib/triggers/database-polling'
import { executeEmailPolling } from '@/lib/triggers/email-polling'
import { executeTriggeredWorkflow } from '@/lib/triggers/execute-triggered-workflow'
import { executeFilePolling } from '@/lib/triggers/file-polling'
import { executeFormPolling } from '@/lib/triggers/form-polling'
import {
  cleanupOrphanSubscriptions,
  renewOutlookSubscription,
} from '@/lib/triggers/outlook-subscription'
import { checkServerSideUsageLimits } from '@/lib/usage-monitor'
import { db } from '@/db'
import { workflow, workflowTrigger } from '@/db/schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('TriggerExecuteAPI')

interface PollingConfig {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: Record<string, any>
  identifierPath?: string
}

/**
 * Extract unique identifiers from API response
 */
function extractIdentifiers(data: any, path?: string): string[] {
  if (!path) {
    if (Array.isArray(data)) {
      return data.map((item) => item.id || JSON.stringify(item))
    }
    return [data.id || JSON.stringify(data)]
  }

  const parts = path.split('.')
  let current = data

  for (const part of parts) {
    if (part.includes('[].')) {
      const [arrayKey, ...rest] = part.split('[].')
      if (Array.isArray(current[arrayKey])) {
        return current[arrayKey].map((item: any) => {
          let value = item
          for (const key of rest) {
            value = value?.[key]
          }
          return String(value)
        })
      }
    } else {
      current = current?.[part]
    }
  }

  return Array.isArray(current) ? current.map(String) : [String(current)]
}

/**
 * Execute polling for API endpoint
 */
async function executePolling(
  trigger: typeof workflowTrigger.$inferSelect,
  workflowRecord: typeof workflow.$inferSelect
): Promise<{ hasNewData: boolean; newData?: any }> {
  const config = trigger.config as PollingConfig

  try {
    const requestOptions: RequestInit = {
      method: config.method,
      headers: config.headers || {},
    }

    if (config.method === 'POST' && config.body) {
      requestOptions.body = JSON.stringify(config.body)
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/json',
      }
    }

    const response = await fetch(config.url, requestOptions)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    const currentIdentifiers = extractIdentifiers(data, config.identifierPath)
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []

    const newIdentifiers = currentIdentifiers.filter((id) => !lastSeenIdentifiers.includes(id))

    if (newIdentifiers.length > 0) {
      const updatedIdentifiers = [...newIdentifiers, ...lastSeenIdentifiers].slice(0, 100)

      await db
        .update(workflowTrigger)
        .set({
          lastSeenIdentifiers: updatedIdentifiers,
          lastPolledAt: new Date(),
        })
        .where(eq(workflowTrigger.id, trigger.id))

      logger.info(`Found ${newIdentifiers.length} new items for trigger ${trigger.id}`)

      return {
        hasNewData: true,
        newData: data,
      }
    }

    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))

    return { hasNewData: false }
  } catch (error: any) {
    logger.error(`Polling error for trigger ${trigger.id}`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Renew Outlook webhook subscriptions that expire within 24 hours.
 * Called once per cron cycle.
 */
async function renewOutlookSubscriptions(requestId: string) {
  try {
    const outlookTriggers = await db
      .select({
        trigger: workflowTrigger,
        workflow: workflow,
      })
      .from(workflowTrigger)
      .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
      .where(
        and(
          eq(workflowTrigger.triggerType, 'email'),
          eq(workflowTrigger.provider, 'outlook'),
          eq(workflowTrigger.isActive, true)
        )
      )

    const renewThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    for (const { trigger, workflow: workflowRecord } of outlookTriggers) {
      const config = trigger.config as any
      const sub = config?.outlookSubscription
      if (!sub?.subscriptionId) continue

      const expiresAt = new Date(sub.expirationDateTime)
      if (expiresAt > renewThreshold) continue // Not expiring soon

      logger.info(`[${requestId}] Renewing Outlook subscription ${sub.subscriptionId}`)

      const newExpiry = await renewOutlookSubscription(
        sub.subscriptionId,
        config.credentialId,
        workflowRecord.userId
      )

      if (newExpiry) {
        // Update subscription expiry in config
        await db
          .update(workflowTrigger)
          .set({
            config: {
              ...config,
              outlookSubscription: {
                ...sub,
                expirationDateTime: newExpiry,
              },
            },
          })
          .where(eq(workflowTrigger.id, trigger.id))
        logger.info(`[${requestId}] Subscription ${sub.subscriptionId} renewed until ${newExpiry}`)
      } else {
        // Renewal failed - switch back to polling as fallback
        logger.warn(`[${requestId}] Subscription renewal failed, enabling polling fallback`)
        const pollingInterval = trigger.pollingInterval || 5
        await db
          .update(workflowTrigger)
          .set({
            config: { ...config, outlookSubscription: null },
            nextPollAt: new Date(Date.now() + pollingInterval * 60 * 1000),
          })
          .where(eq(workflowTrigger.id, trigger.id))
      }
    }

    // Cleanup orphan subscriptions on Graph side.
    // Collect known subscription IDs from DB and compare with Graph.
    // Group by credential+user to minimize API calls.
    const credentialGroups = new Map<
      string,
      { credentialId: string; userId: string; subIds: Set<string> }
    >()

    for (const { trigger, workflow: workflowRecord } of outlookTriggers) {
      const config = trigger.config as any
      if (!config?.credentialId) continue

      const key = `${config.credentialId}:${workflowRecord.userId}`
      if (!credentialGroups.has(key)) {
        credentialGroups.set(key, {
          credentialId: config.credentialId,
          userId: workflowRecord.userId,
          subIds: new Set(),
        })
      }

      if (config?.outlookSubscription?.subscriptionId) {
        credentialGroups.get(key)!.subIds.add(config.outlookSubscription.subscriptionId)
      }
    }

    for (const [, group] of credentialGroups) {
      await cleanupOrphanSubscriptions(group.credentialId, group.userId, group.subIds)
    }
  } catch (error) {
    logger.error(`[${requestId}] Error renewing Outlook subscriptions`, error)
  }
}

/**
 * GET /api/triggers/execute
 * Execute due triggers (called by cron job)
 *
 * Note: Outlook email triggers with active webhook subscriptions have nextPollAt=null,
 * so they are NOT picked up by this cron. They are handled by the webhook endpoint instead.
 * This cron processes: polling, email, form, database, file, and calendar triggers.
 * Outlook email triggers with active webhooks are excluded (polling fallback only).
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const now = new Date()

  logger.info(`[${requestId}] Trigger execution check started`)

  try {
    // Renew expiring Outlook subscriptions (non-blocking)
    renewOutlookSubscriptions(requestId).catch((err) =>
      logger.error(`[${requestId}] Subscription renewal error`, err)
    )

    // Atomically claim due triggers by advancing their nextPollAt.
    // This prevents double-fire across concurrent cron invocations or serverless instances:
    // only the instance that successfully UPDATEs a row gets to process it.
    const dueTriggers = await db
      .select({
        trigger: workflowTrigger,
        workflow: workflow,
      })
      .from(workflowTrigger)
      .innerJoin(workflow, eq(workflowTrigger.workflowId, workflow.id))
      .where(
        and(
          inArray(workflowTrigger.triggerType, [
            'polling',
            'email',
            'form',
            'database',
            'file',
            'calendar',
          ]),
          eq(workflowTrigger.isActive, true),
          lte(workflowTrigger.nextPollAt, now)
        )
      )
      .limit(10)

    logger.info(`[${requestId}] Found ${dueTriggers.length} due triggers`)

    // Atomically claim all triggers by pushing nextPollAt into the future
    // If another cron instance already claimed a trigger, the WHERE won't match
    const claimedIds: string[] = []
    for (const { trigger } of dueTriggers) {
      const pollingInterval = trigger.pollingInterval || 5
      const nextPoll = new Date(now.getTime() + pollingInterval * 60 * 1000)
      const result = await db
        .update(workflowTrigger)
        .set({ nextPollAt: nextPoll, updatedAt: now })
        .where(
          and(
            eq(workflowTrigger.id, trigger.id),
            lte(workflowTrigger.nextPollAt, now) // Only succeeds if not yet claimed
          )
        )
        .returning({ id: workflowTrigger.id })

      if (result.length > 0) {
        claimedIds.push(trigger.id)
      }
    }

    logger.info(`[${requestId}] Claimed ${claimedIds.length} of ${dueTriggers.length} triggers`)

    for (const { trigger, workflow: workflowRecord } of dueTriggers) {
      // Only process triggers we successfully claimed
      if (!claimedIds.includes(trigger.id)) continue

      try {
        // Check usage limits
        const usageCheck = await checkServerSideUsageLimits(workflowRecord.userId)
        if (usageCheck.isExceeded) {
          logger.warn(`[${requestId}] User ${workflowRecord.userId} exceeded usage limits`)

          const nextPollAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          await db
            .update(workflowTrigger)
            .set({ nextPollAt, updatedAt: now })
            .where(eq(workflowTrigger.id, trigger.id))

          continue
        }

        let hasNewData = false
        let newData: any = undefined

        if (trigger.triggerType === 'email') {
          // Email polling fallback (Gmail always, Outlook only if webhook setup failed)
          const result = await executeEmailPolling(trigger, workflowRecord.userId)
          hasNewData = result.hasNewData
          newData = result.newData
        } else if (trigger.triggerType === 'form') {
          const result = await executeFormPolling(trigger, workflowRecord.userId)
          hasNewData = result.hasNewData
          newData = result.newData
        } else if (trigger.triggerType === 'database') {
          const result = await executeDatabasePolling(trigger, workflowRecord.userId)
          hasNewData = result.hasNewData
          newData = result.newData
        } else if (trigger.triggerType === 'file') {
          const result = await executeFilePolling(trigger, workflowRecord.userId)
          hasNewData = result.hasNewData
          newData = result.newData
        } else if (trigger.triggerType === 'calendar') {
          const result = await executeCalendarPolling(trigger, workflowRecord.userId)
          hasNewData = result.hasNewData
          newData = result.newData
        } else {
          // Execute API polling
          const result = await executePolling(trigger, workflowRecord)
          hasNewData = result.hasNewData
          newData = result.newData
        }

        if (hasNewData && newData) {
          if (Array.isArray(newData)) {
            // Array-based triggers: execute workflow for each item
            for (const item of newData) {
              try {
                await executeTriggeredWorkflow(trigger, workflowRecord, [item])
                logger.info(
                  `[${requestId}] Workflow executed for ${trigger.triggerType} item: ${item.messageId || item.responseId || item.recordId || item.fileId || item.eventId || 'unknown'}`
                )
              } catch (itemError: any) {
                logger.error(
                  `[${requestId}] Failed to execute workflow for ${trigger.triggerType} item`,
                  itemError
                )
              }
            }
          } else {
            // Non-array triggers: single execution
            await executeTriggeredWorkflow(trigger, workflowRecord, newData)
          }
        }
      } catch (error: any) {
        logger.error(`[${requestId}] Error processing trigger ${trigger.id}`, error)

        // Schedule retry in 5 minutes
        const nextPollAt = new Date(now.getTime() + 5 * 60 * 1000)
        await db
          .update(workflowTrigger)
          .set({ nextPollAt, updatedAt: now })
          .where(eq(workflowTrigger.id, trigger.id))
      }
    }

    return NextResponse.json({
      message: 'Trigger execution completed',
      processedCount: claimedIds.length,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Error in trigger execution`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
