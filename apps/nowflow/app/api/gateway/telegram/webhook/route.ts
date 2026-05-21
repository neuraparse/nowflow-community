import { NextRequest, NextResponse } from 'next/server'
import { TelegramAdapter } from '@/lib/gateway/adapters/telegram-adapter'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'
import { hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'

const logger = createLogger('TelegramWebhook')

// Ensure dynamic rendering for webhook processing
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Singleton adapter instance for webhook handling
const telegramAdapter = new TelegramAdapter()

/**
 * Telegram Webhook Handler (POST)
 *
 * Receives incoming updates from Telegram Bot API.
 * Validates the secret_token header, deduplicates messages via Redis,
 * parses the update into an InboundMessage, and routes it for processing.
 * Returns 200 immediately as Telegram expects a fast response.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    // --- Validate secret token header ---
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (expectedSecret) {
      const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token')
      if (receivedSecret !== expectedSecret) {
        logger.warn(`[${requestId}] Invalid Telegram webhook secret token`)
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    // --- Parse request body ---
    let body: any
    try {
      const rawBody = await request.text()
      if (!rawBody || rawBody.length === 0) {
        logger.warn(`[${requestId}] Rejecting request with empty body`)
        return new NextResponse('Empty request body', { status: 400 })
      }
      body = JSON.parse(rawBody)
    } catch (parseError) {
      logger.error(`[${requestId}] Failed to parse Telegram webhook body`, {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return new NextResponse('Invalid JSON payload', { status: 400 })
    }

    // --- Deduplication via Redis ---
    const updateId = body.update_id
    if (updateId) {
      const dedupeKey = `telegram:update:${updateId}`
      try {
        const isDuplicate = await hasProcessedMessage(dedupeKey)
        if (isDuplicate) {
          logger.info(`[${requestId}] Duplicate Telegram update detected: ${updateId}`)
          return new NextResponse('OK', { status: 200 })
        }
        // Mark as processed with 24-hour TTL
        await markMessageAsProcessed(dedupeKey, 60 * 60 * 24)
      } catch (error) {
        logger.error(`[${requestId}] Error in Telegram deduplication`, {
          error: error instanceof Error ? error.message : String(error),
        })
        // Continue processing - better to risk a duplicate than drop a message
      }
    }

    // --- Parse the Telegram update into an InboundMessage ---
    const inboundMessage = await telegramAdapter.handleWebhook(body)

    if (!inboundMessage) {
      // Not a message type we handle (e.g., channel_post, inline_query)
      logger.debug(`[${requestId}] Telegram update did not produce an inbound message`, {
        updateId,
        hasMessage: !!body.message,
        hasCallbackQuery: !!body.callback_query,
      })
      return new NextResponse('OK', { status: 200 })
    }

    logger.info(`[${requestId}] Telegram message received`, {
      messageId: inboundMessage.id,
      senderId: inboundMessage.senderId,
      senderName: inboundMessage.senderName,
      chatType: inboundMessage.metadata.chatType,
      hasMedia: !!inboundMessage.media,
      textLength: inboundMessage.text?.length || 0,
    })

    // --- Route to gateway service for processing ---
    // Fire-and-forget: process the message asynchronously so we return 200 quickly.
    // The gateway service will handle workflow triggering, session management, etc.
    processInboundMessage(requestId, inboundMessage).catch((error) => {
      logger.error(`[${requestId}] Error processing Telegram inbound message`, {
        messageId: inboundMessage.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    // Return 200 immediately - Telegram will retry if it doesn't get a fast response
    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    logger.error(`[${requestId}] Unhandled error in Telegram webhook`, {
      error: error.message,
      stack: error.stack,
    })
    // Return 200 even on errors to prevent Telegram from retrying endlessly
    return new NextResponse('OK', { status: 200 })
  }
}

/**
 * Process an inbound Telegram message asynchronously.
 * This function handles routing the message to the appropriate gateway service
 * for workflow triggering, session management, and response generation.
 */
async function processInboundMessage(requestId: string, message: any): Promise<void> {
  try {
    logger.info(`[${requestId}] Processing inbound Telegram message`, {
      messageId: message.id,
      senderId: message.senderId,
      chatId: message.metadata.chatId,
    })

    // Route to gateway service for workflow triggering and session management
    const gateway = getGatewayService()
    const result = await gateway.handleInboundMessage(message)

    if (result.error) {
      logger.warn(`[${requestId}] Gateway returned error for Telegram message`, {
        messageId: message.id,
        error: result.error,
      })
    } else {
      logger.info(`[${requestId}] Telegram message processed by gateway`, {
        messageId: message.id,
        handled: result.handled,
        workflowId: result.workflowId,
      })
    }
  } catch (error) {
    logger.error(`[${requestId}] Failed to process inbound Telegram message`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
