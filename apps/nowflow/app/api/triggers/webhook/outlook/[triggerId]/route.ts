import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { APP_HOSTNAME, NOREPLY_EMAIL } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'
import { canExecuteTrigger } from '@/lib/spam-guard'
import type { EmailMessage, EmailTriggerConfig } from '@/lib/triggers/email-polling'
import { executeTriggeredWorkflow } from '@/lib/triggers/execute-triggered-workflow'
import { checkServerSideUsageLimits } from '@/lib/usage-monitor'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflow, workflowTrigger } from '@/db/schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('OutlookWebhook')

// In-memory dedup: tracks message IDs that have been processed or are currently
// being processed. Entries expire after 5 minutes to avoid memory leaks while
// providing strong dedup against Graph's duplicate notifications.
const processingMessages = new Map<string, number>()

function cleanupProcessingMessages() {
  const now = Date.now()
  for (const [key, timestamp] of processingMessages) {
    if (now - timestamp > 300_000) processingMessages.delete(key)
  }
}

// In-memory cache of trigger IDs confirmed to not exist or inactive in DB.
// Prevents repeated DB queries for orphan triggers whose Graph subscriptions
// haven't been cleaned up yet. Entries expire after 10 min for re-check.
const deadTriggers = new Map<string, number>()
const DEAD_TRIGGER_TTL = 10 * 60 * 1000

function isKnownDeadTrigger(triggerId: string): boolean {
  const ts = deadTriggers.get(triggerId)
  if (!ts) return false
  if (Date.now() - ts > DEAD_TRIGGER_TTL) {
    deadTriggers.delete(triggerId)
    return false
  }
  return true
}

function markDeadTrigger(triggerId: string) {
  deadTriggers.set(triggerId, Date.now())
}

// Self-loop prevention: skip emails sent by our own system
const SELF_LOOP_SENDERS = [NOREPLY_EMAIL, `onboarding@${APP_HOSTNAME}`]

/**
 * Fetch a single email by its ID from Microsoft Graph.
 * This is the key difference from polling: we fetch ONLY the triggering email.
 */
async function fetchOutlookMessageById(
  messageId: string,
  accessToken: string,
  folder: string
): Promise<EmailMessage | null> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,hasAttachments,isRead`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) return null

    const msg = await response.json()

    return {
      messageId: msg.id,
      from: {
        name: msg.from?.emailAddress?.name || '',
        email: msg.from?.emailAddress?.address || '',
      },
      to: (msg.toRecipients || []).map((r: any) => ({
        name: r.emailAddress?.name || '',
        email: r.emailAddress?.address || '',
      })),
      cc:
        msg.ccRecipients?.length > 0
          ? msg.ccRecipients.map((r: any) => ({
              name: r.emailAddress?.name || '',
              email: r.emailAddress?.address || '',
            }))
          : undefined,
      subject: msg.subject || '',
      body:
        msg.body?.contentType === 'html'
          ? (msg.body?.content || '').replace(/<[^>]*>/g, '')
          : msg.body?.content || '',
      htmlBody: msg.body?.contentType === 'html' ? msg.body?.content : undefined,
      date: msg.receivedDateTime || '',
      attachments: undefined,
      folder,
      provider: 'outlook',
      isRead: msg.isRead ?? false,
      hasAttachments: msg.hasAttachments ?? false,
    }
  } catch (error) {
    logger.error(`Failed to fetch message ${messageId}`, error)
    return null
  }
}

/**
 * Check if email passes user-defined filter (from:, subject:, keyword).
 */
function matchesFilter(email: EmailMessage, filter: string): boolean {
  if (!filter) return true

  const filterParts = filter.toLowerCase().split(/\s+/)
  const subject = email.subject.toLowerCase()
  const fromEmail = email.from.email.toLowerCase()
  const fromName = email.from.name.toLowerCase()

  return filterParts.every((part) => {
    if (part.startsWith('from:')) {
      const v = part.slice(5)
      return fromEmail.includes(v) || fromName.includes(v)
    }
    if (part.startsWith('subject:')) {
      return subject.includes(part.slice(8))
    }
    return subject.includes(part) || fromEmail.includes(part)
  })
}

/**
 * Extract message IDs from notifications SYNCHRONOUSLY before any async work.
 * This ensures dedup happens in the same event loop tick, preventing race conditions
 * when multiple POST requests arrive simultaneously from Microsoft Graph.
 */
function deduplicateNotifications(notifications: any[], triggerId: string): any[] {
  cleanupProcessingMessages()
  const unique: any[] = []
  let skipped = 0

  for (const notification of notifications) {
    const messageId = notification.resourceData?.id
    if (!messageId) continue

    // Key includes triggerId so different triggers can independently process the same email
    const dedupKey = `${triggerId}:${messageId}`
    if (processingMessages.has(dedupKey)) {
      skipped++
      continue
    }

    // Mark IMMEDIATELY in the same synchronous tick to prevent race conditions
    processingMessages.set(dedupKey, Date.now())
    unique.push(notification)
  }

  // Log once instead of per-duplicate
  if (skipped > 0) {
    logger.debug(`Trigger ${triggerId}: ${skipped} duplicate notification(s) dropped`)
  }

  return unique
}

/**
 * Process Graph change notifications asynchronously.
 * Runs after the 202 response is sent to Microsoft Graph.
 * Receives pre-deduplicated notifications only.
 */
async function processNotifications(dedupedNotifications: any[], triggerId: string) {
  const requestId = crypto.randomUUID().slice(0, 8)

  if (dedupedNotifications.length === 0) return

  // Centralized rate limit check BEFORE any DB work
  if (!(await canExecuteTrigger(triggerId))) {
    logger.warn(
      `[${requestId}] Trigger ${triggerId} rate limited by spam-guard, dropping ${dedupedNotifications.length} notification(s)`
    )
    return
  }

  // Look up trigger
  const [trigger] = await db
    .select()
    .from(workflowTrigger)
    .where(eq(workflowTrigger.id, triggerId))
    .limit(1)

  if (!trigger || !trigger.isActive) {
    if (!trigger) {
      markDeadTrigger(triggerId)
      logger.warn(
        `[${requestId}] Trigger ${triggerId} not found, marked as dead (future requests will get 410)`
      )
    } else {
      logger.warn(`[${requestId}] Trigger ${triggerId} is inactive`)
    }
    return
  }

  const config = trigger.config as EmailTriggerConfig & {
    outlookSubscription?: { clientState: string }
  }

  // Look up workflow
  const [workflowRecord] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, trigger.workflowId))
    .limit(1)

  if (!workflowRecord) {
    logger.warn(`[${requestId}] Workflow ${trigger.workflowId} not found`)
    return
  }

  // Check usage limits
  const usageCheck = await checkServerSideUsageLimits(workflowRecord.userId)
  if (usageCheck.isExceeded) {
    logger.warn(`[${requestId}] User ${workflowRecord.userId} exceeded usage limits`)
    return
  }

  // Get access token to fetch email content
  const accessToken = await refreshAccessTokenIfNeeded(
    config.credentialId,
    workflowRecord.userId,
    requestId
  )

  if (!accessToken) {
    logger.error(`[${requestId}] No access token for webhook processing`)
    return
  }

  for (const notification of dedupedNotifications) {
    // Log clientState mismatch but don't skip — stale notifications from
    // a previous subscription may arrive after renewal with an old clientState.
    // The triggerId in the URL is sufficient to authenticate the source.
    if (
      config.outlookSubscription?.clientState &&
      notification.clientState !== config.outlookSubscription.clientState
    ) {
      logger.warn(
        `[${requestId}] Client state mismatch (expected=${config.outlookSubscription.clientState?.slice(0, 8)}… got=${notification.clientState?.slice(0, 8)}…), proceeding anyway`
      )
    }

    const messageId = notification.resourceData?.id
    if (!messageId) continue

    // Re-check rate limit for each message in the batch
    if (!(await canExecuteTrigger(triggerId))) {
      logger.warn(`[${requestId}] Trigger ${triggerId} rate limited mid-batch, skipping remaining`)
      break
    }

    // Fresh DB dedup check: re-read lastSeenIdentifiers to catch concurrent updates
    const [freshTrigger] = await db
      .select({ lastSeenIdentifiers: workflowTrigger.lastSeenIdentifiers })
      .from(workflowTrigger)
      .where(eq(workflowTrigger.id, triggerId))
      .limit(1)
    const freshLastSeenIds = (freshTrigger?.lastSeenIdentifiers as string[]) || []

    if (freshLastSeenIds.includes(messageId)) {
      logger.debug(`[${requestId}] Message ${messageId} already processed (fresh check)`)
      continue
    }

    // Fetch ONLY this specific email by ID
    const email = await fetchOutlookMessageById(messageId, accessToken, config.folder || 'Inbox')
    if (!email) {
      logger.warn(`[${requestId}] Could not fetch message ${messageId}`)
      continue
    }

    // Self-loop prevention: skip emails sent by our own system
    if (SELF_LOOP_SENDERS.includes(email.from.email.toLowerCase())) {
      logger.info(
        `[${requestId}] Skipping self-sent email from ${email.from.email} (loop prevention)`
      )
      await db
        .update(workflowTrigger)
        .set({
          lastSeenIdentifiers: [messageId, ...freshLastSeenIds].slice(0, 100),
        })
        .where(eq(workflowTrigger.id, trigger.id))
      continue
    }

    // Apply user filter
    if (!matchesFilter(email, config.filter || '')) {
      logger.debug(`[${requestId}] Message ${messageId} filtered out by user filter`)
      await db
        .update(workflowTrigger)
        .set({
          lastSeenIdentifiers: [messageId, ...freshLastSeenIds].slice(0, 100),
        })
        .where(eq(workflowTrigger.id, trigger.id))
      continue
    }

    // Mark as seen BEFORE executing workflow to prevent race conditions
    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: [messageId, ...freshLastSeenIds].slice(0, 100),
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    // Execute workflow with this specific triggering email
    try {
      await executeTriggeredWorkflow(trigger, workflowRecord, [email])
      logger.info(`[${requestId}] Workflow executed for email: ${email.subject} (${messageId})`)
    } catch (error: any) {
      logger.error(`[${requestId}] Workflow execution failed for ${messageId}`, error)
    }
  }
}

/**
 * POST /api/triggers/webhook/outlook/[triggerId]
 *
 * Handles two types of requests from Microsoft Graph:
 * 1. Validation: POST with ?validationToken=xxx → respond with token as text/plain
 * 2. Change notification: POST with JSON body → respond 202, process async
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const { triggerId } = await params

  // --- Fast reject for known dead triggers ---
  // Return 202 immediately to prevent Graph retries (Graph retries non-2xx for 4 hours).
  // The orphan subscription will be cleaned up by the cron-based cleanupOrphanSubscriptions.
  if (isKnownDeadTrigger(triggerId)) {
    return new Response(null, { status: 202 })
  }

  // --- Validation request ---
  // When creating a subscription, Graph POSTs with validationToken query param.
  // We must echo it back as text/plain within 10 seconds.
  // Reject validation for triggers that don't exist — prevents new orphan subscriptions.
  const validationToken = req.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    const [trigger] = await db
      .select({ id: workflowTrigger.id, isActive: workflowTrigger.isActive })
      .from(workflowTrigger)
      .where(eq(workflowTrigger.id, triggerId))
      .limit(1)

    if (!trigger || !trigger.isActive) {
      logger.info(
        `Validation rejected for ${!trigger ? 'non-existent' : 'inactive'} trigger ${triggerId}`
      )
      markDeadTrigger(triggerId)
      // Return 404 for validation — Graph won't create the subscription
      return new Response(null, { status: 404 })
    }

    logger.info(`Validation request for trigger ${triggerId}`)
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // --- Change notification ---
  // Always return 202 quickly to prevent Graph retries.
  // Graph retries non-2xx responses for up to 4 hours with exponential backoff.
  try {
    const body = await req.json()
    const notifications = body.value || []

    if (notifications.length > 0) {
      // SYNCHRONOUS dedup BEFORE any async work - this runs in the same event loop
      // tick as the POST handler, preventing race conditions between concurrent requests
      const dedupedNotifications = deduplicateNotifications(notifications, triggerId)

      if (dedupedNotifications.length > 0) {
        logger.info(`Trigger ${triggerId}: ${dedupedNotifications.length} new notification(s)`)

        // Fire and forget - process after response
        processNotifications(dedupedNotifications, triggerId).catch((err) => {
          logger.error(`Failed to process notifications for ${triggerId}`, err)
        })
      }
    }

    return new Response(null, { status: 202 })
  } catch (error) {
    logger.error(`Error in webhook handler for ${triggerId}`, error)
    return new Response(null, { status: 202 })
  }
}
