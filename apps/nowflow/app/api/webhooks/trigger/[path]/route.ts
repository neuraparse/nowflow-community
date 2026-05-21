import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { consumeApiCallQuota } from '@/lib/api-rate-limits'
import { createLogger } from '@/lib/logs/console-logger'
import { acquireLock, hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'
import { checkServerSideUsageLimits } from '@/lib/usage-monitor'
import { logWebhookTrigger, updateWebhookLog, updateWebhookStats } from '@/lib/webhooks/monitoring'
import { scheduleWebhookRetry } from '@/lib/webhooks/retry'
import { checkRateLimit, getClientIp, isIpAllowed } from '@/lib/webhooks/security'
import {
  fetchAndProcessAirtablePayloads,
  handleSlackChallenge,
  handleWhatsAppVerification,
  processGenericDeduplication,
  processWebhook,
  processWhatsAppDeduplication,
} from '@/lib/webhooks/utils'
import { db } from '@/db'
import { webhook, workflow } from '@/db/schema'

const logger = createLogger('WebhookTriggerAPI')

// Define Next.js config for webhook processing
export const dynamic = 'force-dynamic' // Ensure dynamic rendering
export const maxDuration = 300 // 5 minutes max execution time

// Storage for active processing tasks to prevent garbage collection
const activeProcessingTasks = new Map<string, Promise<any>>()

/**
 * Webhook Verification Handler (GET)
 *
 * Handles verification requests from webhook providers and confirms endpoint exists.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const path = (await params).path
    const url = new URL(request.url)

    // Handle WhatsApp specific verification challenge
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const whatsAppResponse = await handleWhatsAppVerification(
      requestId,
      path,
      mode,
      token,
      challenge
    )
    if (whatsAppResponse) {
      return whatsAppResponse
    }

    // Verify webhook exists in database
    const webhooks = await db
      .select({
        webhook: webhook,
      })
      .from(webhook)
      .where(and(eq(webhook.path, path), eq(webhook.isActive, true)))
      .limit(1)

    if (webhooks.length === 0) {
      logger.warn(`[${requestId}] No active webhook found for path: ${path}`)
      return new NextResponse('Webhook not found', { status: 404 })
    }

    logger.info(`[${requestId}] Webhook verification successful for path: ${path}`)
    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    logger.error(`[${requestId}] Error processing webhook verification`, error)
    return new NextResponse(`Internal Server Error: ${error.message}`, {
      status: 500,
    })
  }
}

/**
 * Webhook Payload Handler (POST)
 *
 * Processes incoming webhook payloads from all supported providers.
 * Fast acknowledgment with async processing for most providers except Airtable.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const requestId = crypto.randomUUID().slice(0, 8)
  let foundWorkflow: any = null
  let foundWebhook: any = null

  // --- PHASE 1: Request validation and parsing ---
  let rawBody: string | null = null
  try {
    const requestClone = request.clone()
    rawBody = await requestClone.text()

    if (!rawBody || rawBody.length === 0) {
      logger.warn(`[${requestId}] Rejecting request with empty body`)
      return new NextResponse('Empty request body', { status: 400 })
    }
  } catch (bodyError) {
    logger.error(`[${requestId}] Failed to read request body`, {
      error: bodyError instanceof Error ? bodyError.message : String(bodyError),
    })
    return new NextResponse('Failed to read request body', { status: 400 })
  }

  // Parse the body as JSON
  let body: any
  try {
    body = JSON.parse(rawBody)

    if (Object.keys(body).length === 0) {
      logger.warn(`[${requestId}] Rejecting empty JSON object`)
      return new NextResponse('Empty JSON payload', { status: 400 })
    }
  } catch (parseError) {
    logger.error(`[${requestId}] Failed to parse JSON body`, {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    })
    return new NextResponse('Invalid JSON payload', { status: 400 })
  }

  // --- PHASE 2: Early Slack deduplication handling ---
  const messageId = body?.event_id

  if (body?.type === 'event_callback') {
    const dedupeKey = messageId
      ? `slack:msg:${messageId}`
      : `slack:${body?.team_id || ''}:${body?.event?.ts || body?.event?.event_ts || Date.now()}`

    try {
      const isDuplicate = await hasProcessedMessage(dedupeKey)
      if (isDuplicate) {
        logger.info(`[${requestId}] Duplicate Slack message detected: ${dedupeKey}`)
        return new NextResponse('Duplicate message', { status: 200 })
      }

      await markMessageAsProcessed(dedupeKey, 60 * 60 * 24) // 24 hour TTL
    } catch (error) {
      logger.error(`[${requestId}] Error in Slack deduplication`, error)
      // Continue processing - better to risk a duplicate than fail
    }
  }

  // --- PHASE 3: Distributed lock acquisition ---
  let hasExecutionLock = false
  let executionLockKey: string

  if (body?.type === 'event_callback') {
    // For Slack events, use message-specific lock key
    executionLockKey = messageId
      ? `execution:lock:slack:${messageId}`
      : `execution:lock:slack:${body?.team_id || ''}:${body?.event?.ts || body?.event?.event_ts || Date.now()}`
  } else {
    // Default fallback for other providers
    executionLockKey = `execution:lock:${requestId}:${crypto.randomUUID()}`
  }

  try {
    hasExecutionLock = await acquireLock(executionLockKey, requestId, 30) // 30 second TTL
  } catch (lockError) {
    logger.error(`[${requestId}] Error acquiring execution lock`, lockError)
    // Proceed without lock in case of Redis failure (fallback to best-effort)
  }

  // --- PHASE 4: Webhook identification ---
  const path = (await params).path
  logger.info(`[${requestId}] Processing webhook request for path: ${path}`)

  // Find webhook and associated workflow
  const webhooks = await db
    .select({
      webhook: webhook,
      workflow: workflow,
    })
    .from(webhook)
    .innerJoin(workflow, eq(webhook.workflowId, workflow.id))
    .where(and(eq(webhook.path, path), eq(webhook.isActive, true)))
    .limit(1)

  if (webhooks.length === 0) {
    logger.warn(`[${requestId}] No active webhook found for path: ${path}`)
    return new NextResponse('Webhook not found', { status: 404 })
  }

  foundWebhook = webhooks[0].webhook
  foundWorkflow = webhooks[0].workflow

  // --- PHASE 4.5: Security checks ---
  const startTime = Date.now()
  let logId: string | null = null

  try {
    // Get client IP
    const clientIp = getClientIp(request)
    logger.debug(`[${requestId}] Client IP: ${clientIp}`)

    // Log webhook trigger
    logId = await logWebhookTrigger(foundWebhook.id, request, {
      method: request.method,
      sourceIp: clientIp,
      body,
      queryParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
    })

    // Check IP whitelist
    const allowedIps = (foundWebhook.allowedIps as string[]) || []
    if (!isIpAllowed(clientIp, allowedIps)) {
      logger.warn(`[${requestId}] IP not allowed: ${clientIp}`)

      if (logId) {
        await updateWebhookLog(logId, {
          statusCode: 403,
          responseTime: Date.now() - startTime,
          success: false,
          errorMessage: 'IP not allowed',
        })
      }
      await updateWebhookStats(foundWebhook.id, false, 'IP not allowed')

      return new NextResponse('Forbidden', { status: 403 })
    }

    // Check rate limit
    const rateLimit = foundWebhook.rateLimit || 100
    const rateLimitCheck = checkRateLimit(`webhook:${foundWebhook.id}:${clientIp}`, rateLimit)

    if (!rateLimitCheck.allowed) {
      logger.warn(`[${requestId}] Rate limit exceeded for webhook: ${foundWebhook.id}`)

      if (logId) {
        await updateWebhookLog(logId, {
          statusCode: 429,
          responseTime: Date.now() - startTime,
          success: false,
          errorMessage: 'Rate limit exceeded',
        })
      }
      await updateWebhookStats(foundWebhook.id, false, 'Rate limit exceeded')

      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.toString(),
          'X-RateLimit-Remaining': rateLimitCheck.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitCheck.resetAt).toISOString(),
        },
      })
    }
  } catch (securityError) {
    logger.error(`[${requestId}] Security check error:`, securityError)
    // Continue processing - don't fail on security check errors
  }

  const earlyUsageCheck = await checkServerSideUsageLimits(foundWorkflow.userId)
  if (earlyUsageCheck.isExceeded) {
    logger.warn(
      `[${requestId}] User ${foundWorkflow.userId} has exceeded usage limits before webhook execution.`,
      {
        currentUsage: earlyUsageCheck.currentUsage,
        limit: earlyUsageCheck.limit,
        workflowId: foundWorkflow.id,
      }
    )

    return new NextResponse(
      JSON.stringify({
        status: 'error',
        message:
          earlyUsageCheck.message ||
          'Usage limit exceeded. Please upgrade your plan to continue using webhooks.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const apiCallCheck = await consumeApiCallQuota(foundWorkflow.userId)
  if (!apiCallCheck.allowed) {
    logger.warn(`[${requestId}] User ${foundWorkflow.userId} has exceeded API call limit`, {
      currentCalls: apiCallCheck.currentCalls,
      limit: apiCallCheck.limit,
    })
    return new NextResponse(
      JSON.stringify({
        error: 'API call limit exceeded',
        message: apiCallCheck.message || 'Limit resets in 24 hours.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Detect provider type
  const isAirtableWebhook = foundWebhook.provider === 'airtable'

  // Handle Slack challenge verification (must be done before timeout)
  const slackChallengeResponse =
    body?.type === 'url_verification' ? handleSlackChallenge(body) : null
  if (slackChallengeResponse) {
    logger.info(`[${requestId}] Responding to Slack URL verification challenge`)
    return slackChallengeResponse
  }

  // Skip processing if another instance is already handling this request
  if (!hasExecutionLock) {
    logger.info(`[${requestId}] Skipping execution as lock was not acquired`)
    return new NextResponse('Request is being processed by another instance', { status: 200 })
  }

  // --- PHASE 5: Provider-specific processing ---

  // For Airtable: Process synchronously without timeouts
  if (isAirtableWebhook) {
    try {
      logger.info(`[${requestId}] Airtable webhook ping received for webhook: ${foundWebhook.id}`)

      // Handle Airtable deduplication
      const notificationId = body.notificationId || null
      if (notificationId) {
        try {
          const processedKey = `airtable-webhook-${foundWebhook.id}-${notificationId}`

          // Check if notification was already processed
          const alreadyProcessed = await db
            .select({ id: webhook.id })
            .from(webhook)
            .where(
              and(
                eq(webhook.id, foundWebhook.id),
                sql`(webhook.provider_config->>'processedNotifications')::jsonb ? ${processedKey}`
              )
            )
            .limit(1)

          if (alreadyProcessed.length > 0) {
            logger.info(
              `[${requestId}] Duplicate Airtable notification detected: ${notificationId}`
            )
            return new NextResponse('Notification already processed', { status: 200 })
          }

          // Store notification ID for deduplication
          const providerConfig = foundWebhook.providerConfig || {}
          const processedNotifications = providerConfig.processedNotifications || []
          processedNotifications.push(processedKey)

          // Keep only the last 100 notifications to prevent unlimited growth
          const limitedNotifications = processedNotifications.slice(-100)

          // Update the webhook record
          await db
            .update(webhook)
            .set({
              providerConfig: {
                ...providerConfig,
                processedNotifications: limitedNotifications,
              },
              updatedAt: new Date(),
            })
            .where(eq(webhook.id, foundWebhook.id))
        } catch (error) {
          logger.warn(`[${requestId}] Airtable deduplication check failed, continuing`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Process Airtable payloads synchronously
      try {
        logger.info(`[${requestId}] Starting Airtable payload processing`)
        await fetchAndProcessAirtablePayloads(foundWebhook, foundWorkflow, requestId)
        return new NextResponse('Airtable ping processed successfully', { status: 200 })
      } catch (error: any) {
        logger.error(`[${requestId}] Error during Airtable processing`, {
          error: error.message,
        })
        return new NextResponse(`Error processing Airtable webhook: ${error.message}`, {
          status: 500,
        })
      }
    } catch (error: any) {
      logger.error(`[${requestId}] Error in Airtable processing`, error)
      return new NextResponse(`Internal server error: ${error.message}`, { status: 500 })
    }
  }

  // --- For all other webhook types: Use async processing with timeout ---

  // Create timeout promise for fast initial response (2.5 seconds)
  const timeoutDuration = 25000
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      logger.info(`[${requestId}] Fast response timeout activated`)
      resolve(new NextResponse('Request received', { status: 200 }))
    }, timeoutDuration)
  })

  // Create the processing promise for asynchronous execution
  const processingPromise = (async () => {
    try {
      // Provider-specific deduplication
      if (foundWebhook.provider === 'whatsapp') {
        const data = body?.entry?.[0]?.changes?.[0]?.value
        const messages = data?.messages || []

        const whatsappDuplicateResponse = await processWhatsAppDeduplication(requestId, messages)
        if (whatsappDuplicateResponse) {
          return whatsappDuplicateResponse
        }
      } else if (foundWebhook.provider !== 'slack') {
        const genericDuplicateResponse = await processGenericDeduplication(requestId, path, body)
        if (genericDuplicateResponse) {
          return genericDuplicateResponse
        }
      }

      // Check if the user has exceeded their usage limits
      const usageCheck = await checkServerSideUsageLimits(foundWorkflow.userId)
      if (usageCheck.isExceeded) {
        logger.warn(
          `[${requestId}] User ${foundWorkflow.userId} has exceeded usage limits. Skipping webhook execution.`,
          {
            currentUsage: usageCheck.currentUsage,
            limit: usageCheck.limit,
            workflowId: foundWorkflow.id,
          }
        )

        // Return a successful response to avoid webhook retries, but don't execute the workflow
        return new NextResponse(
          JSON.stringify({
            status: 'error',
            message:
              usageCheck.message ||
              'Usage limit exceeded. Please upgrade your plan to continue using webhooks.',
          }),
          {
            status: 200, // Use 200 to prevent webhook provider retries
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Execute workflow for the webhook event
      logger.info(`[${requestId}] Executing workflow for ${foundWebhook.provider} webhook`)

      const executionId = uuidv4()
      const response = await processWebhook(
        foundWebhook,
        foundWorkflow,
        body,
        request,
        executionId,
        requestId
      )

      // Update webhook log and stats
      const responseTime = Date.now() - startTime
      const success = response.status >= 200 && response.status < 300

      if (logId) {
        await updateWebhookLog(logId, {
          statusCode: response.status,
          responseTime,
          success,
          errorMessage: success ? undefined : `HTTP ${response.status}`,
        })
      }

      await updateWebhookStats(
        foundWebhook.id,
        success,
        success ? undefined : `HTTP ${response.status}`
      )

      // Schedule retry if failed and retry is enabled
      if (!success && foundWebhook.retryEnabled) {
        await scheduleWebhookRetry(
          foundWebhook.id,
          logId || '',
          body,
          Object.fromEntries(request.headers.entries())
        )
      }

      return response
    } catch (error: any) {
      logger.error(`[${requestId}] Error processing webhook:`, error)

      // Update webhook log and stats on error
      const responseTime = Date.now() - startTime

      if (logId) {
        await updateWebhookLog(logId, {
          statusCode: 500,
          responseTime,
          success: false,
          errorMessage: error.message,
        })
      }

      await updateWebhookStats(foundWebhook.id, false, error.message)

      // Schedule retry on error if retry is enabled
      if (foundWebhook.retryEnabled) {
        await scheduleWebhookRetry(
          foundWebhook.id,
          logId || '',
          body,
          Object.fromEntries(request.headers.entries())
        )
      }

      return new NextResponse(`Internal server error: ${error.message}`, { status: 500 })
    }
  })()

  // Race processing against timeout to ensure fast response
  return Promise.race([timeoutPromise, processingPromise])
}
