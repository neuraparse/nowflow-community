import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { hasProcessedMessage, markMessageAsProcessed } from '@/lib/redis'

const logger = createLogger('WebhookDeduplication')

/**
 * Process WhatsApp message deduplication
 */
export async function processWhatsAppDeduplication(
  requestId: string,
  messages: any[]
): Promise<NextResponse | null> {
  if (messages.length > 0) {
    const message = messages[0]
    const messageId = message.id

    if (messageId) {
      const whatsappMsgKey = `whatsapp:msg:${messageId}`

      try {
        const isDuplicate = await hasProcessedMessage(whatsappMsgKey)
        if (isDuplicate) {
          logger.info(`[${requestId}] Duplicate WhatsApp message detected: ${messageId}`)
          return new NextResponse('Duplicate message', { status: 200 })
        }

        // Mark as processed BEFORE processing
        await markMessageAsProcessed(whatsappMsgKey, 60 * 60 * 24)
      } catch (error) {
        logger.error(`[${requestId}] Error in WhatsApp deduplication`, error)
        // Continue processing
      }
    }
  }

  return null
}

/**
 * Process generic deduplication using request hash
 */
export async function processGenericDeduplication(
  requestId: string,
  path: string,
  body: any
): Promise<NextResponse | null> {
  try {
    const requestHash = await generateRequestHash(path, body)
    const genericMsgKey = `generic:${requestHash}`

    const isDuplicate = await hasProcessedMessage(genericMsgKey)
    if (isDuplicate) {
      logger.info(`[${requestId}] Duplicate request detected with hash: ${requestHash}`)
      return new NextResponse('Duplicate request', { status: 200 })
    }

    // Mark as processed
    await markMessageAsProcessed(genericMsgKey, 60 * 60 * 24)
  } catch (error) {
    logger.error(`[${requestId}] Error in generic deduplication`, error)
    // Continue processing
  }

  return null
}

/**
 * Generate a hash for request deduplication
 */
export async function generateRequestHash(path: string, body: any): Promise<string> {
  try {
    const normalizedBody = normalizeBody(body)
    const requestString = `${path}:${JSON.stringify(normalizedBody)}`
    let hash = 0
    for (let i = 0; i < requestString.length; i++) {
      const char = requestString.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `request:${path}:${hash}`
  } catch (error) {
    return `request:${path}:${uuidv4()}`
  }
}

/**
 * Normalize the body for consistent hashing
 */
export function normalizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body
  const result = Array.isArray(body) ? [...body] : { ...body }
  const fieldsToRemove = [
    'timestamp',
    'random',
    'nonce',
    'requestId',
    'event_id',
    'event_time' /* Add other volatile fields */,
  ] // Made case-insensitive check below
  if (Array.isArray(result)) {
    return result.map((item) => normalizeBody(item))
  } else {
    for (const key in result) {
      // Use lowercase check for broader matching
      if (fieldsToRemove.includes(key.toLowerCase())) {
        delete result[key]
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = normalizeBody(result[key])
      }
    }
    return result
  }
}
