import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { webhook } from '@/db/schema'

const logger = createLogger('WebhookProviderVerification')

/**
 * Handle WhatsApp verification requests
 */
export async function handleWhatsAppVerification(
  requestId: string,
  path: string,
  mode: string | null,
  token: string | null,
  challenge: string | null
): Promise<NextResponse | null> {
  if (mode && token && challenge) {
    // This is a WhatsApp verification request
    logger.info(`[${requestId}] WhatsApp verification request received for path: ${path}`)

    if (mode !== 'subscribe') {
      logger.warn(`[${requestId}] Invalid WhatsApp verification mode: ${mode}`)
      return new NextResponse('Invalid mode', { status: 400 })
    }

    // Find all active WhatsApp webhooks
    const webhooks = await db
      .select()
      .from(webhook)
      .where(and(eq(webhook.provider, 'whatsapp'), eq(webhook.isActive, true)))

    // Check if any webhook has a matching verification token
    for (const wh of webhooks) {
      const providerConfig = (wh.providerConfig as Record<string, any>) || {}
      const verificationToken = providerConfig.verificationToken

      if (!verificationToken) {
        logger.debug(`[${requestId}] Webhook ${wh.id} has no verification token, skipping`)
        continue
      }

      if (token === verificationToken) {
        logger.info(`[${requestId}] WhatsApp verification successful for webhook ${wh.id}`)
        // Return ONLY the challenge as plain text (exactly as WhatsApp expects)
        return new NextResponse(challenge, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      }
    }

    logger.warn(`[${requestId}] No matching WhatsApp verification token found`)
    return new NextResponse('Verification failed', { status: 403 })
  }

  return null
}

/**
 * Handle Slack verification challenges
 */
export function handleSlackChallenge(body: any): NextResponse | null {
  if (body.type === 'url_verification' && body.challenge) {
    return NextResponse.json({ challenge: body.challenge })
  }

  return null
}

/**
 * Validates a Slack webhook request signature using HMAC SHA-256
 * @param signingSecret - Slack signing secret for validation
 * @param signature - X-Slack-Signature header value
 * @param timestamp - X-Slack-Request-Timestamp header value
 * @param body - Raw request body string
 * @returns Whether the signature is valid
 */

export async function validateSlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  try {
    // Basic validation first
    if (!signingSecret || !signature || !timestamp || !body) {
      return false
    }

    // Check if the timestamp is too old (> 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000)
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return false
    }

    // Compute the signature
    const encoder = new TextEncoder()
    const baseString = `v0:${timestamp}:${body}`

    // Create the HMAC with the signing secret
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString))

    // Convert the signature to hex
    const signatureHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Prepare the expected signature format
    const computedSignature = `v0=${signatureHex}`

    // Constant-time comparison to prevent timing attacks
    if (computedSignature.length !== signature.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
    }

    return result === 0
  } catch (error) {
    logger.error('Error validating Slack signature:', error)
    return false
  }
}

/**
 * Process webhook provider-specific verification
 */
export function verifyProviderWebhook(
  foundWebhook: any,
  request: NextRequest,
  requestId: string
): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const providerConfig = (foundWebhook.providerConfig as Record<string, any>) || {}
  // Keep existing switch statement for github, stripe, generic, default
  switch (foundWebhook.provider) {
    case 'github':
      break // No specific auth here
    case 'stripe':
      break // Stripe verification would go here
    case 'generic':
      // Generic auth logic: requireAuth, token, secretHeaderName, allowedIps
      if (providerConfig.requireAuth) {
        let isAuthenticated = false
        // Check for token in Authorization header (Bearer token)
        if (providerConfig.token) {
          const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
          if (providedToken === providerConfig.token) {
            isAuthenticated = true
          }
          // Check for token in custom header if specified
          if (!isAuthenticated && providerConfig.secretHeaderName) {
            const customHeaderValue = request.headers.get(providerConfig.secretHeaderName)
            if (customHeaderValue === providerConfig.token) {
              isAuthenticated = true
            }
          }
          // Return 401 if authentication failed
          if (!isAuthenticated) {
            logger.warn(`[${requestId}] Unauthorized webhook access attempt - invalid token`)
            return new NextResponse('Unauthorized', { status: 401 })
          }
        }
      }
      // IP restriction check
      if (
        providerConfig.allowedIps &&
        Array.isArray(providerConfig.allowedIps) &&
        providerConfig.allowedIps.length > 0
      ) {
        const clientIp =
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          request.headers.get('x-real-ip') ||
          'unknown'

        if (clientIp === 'unknown' || !providerConfig.allowedIps.includes(clientIp)) {
          logger.warn(
            `[${requestId}] Forbidden webhook access attempt - IP not allowed: ${clientIp}`
          )
          return new NextResponse('Forbidden - IP not allowed', { status: 403 })
        }
      }
      break
    default:
      if (providerConfig.token) {
        const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
        if (!providedToken || providedToken !== providerConfig.token) {
          logger.warn(`[${requestId}] Unauthorized webhook access attempt - invalid token`)
          return new NextResponse('Unauthorized', { status: 401 })
        }
      }
  }

  return null
}
