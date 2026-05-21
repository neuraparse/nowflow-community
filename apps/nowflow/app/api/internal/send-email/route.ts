import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createLogger } from '@/lib/logs/console-logger'
import { sendEmail } from '@/lib/mailer'

const logger = createLogger('InternalSendEmailAPI')

// Internal API key for service-to-service communication
// Accepts INTERNAL_API_KEY or BETTER_AUTH_SECRET (always available) as internal key
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET

/**
 * POST /api/internal/send-email
 * Internal endpoint for sending emails from services
 *
 * This endpoint is used by internal services that can't import nodemailer directly
 * (e.g., client-side imported services like hitl-service)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate internal request (check origin or API key)
    const apiKey = request.headers.get('x-internal-api-key')
    const origin = request.headers.get('origin') || ''
    const host = request.headers.get('host') || ''

    // Allow requests with valid API key (INTERNAL_API_KEY or BETTER_AUTH_SECRET)
    let hasValidKey = false
    if (apiKey) {
      const validKeys = [INTERNAL_API_KEY, BETTER_AUTH_SECRET].filter(Boolean) as string[]
      for (const key of validKeys) {
        try {
          const a = Buffer.from(apiKey)
          const b = Buffer.from(key)
          if (a.length === b.length && timingSafeEqual(a, b)) {
            hasValidKey = true
            break
          }
        } catch {
          // length mismatch, try next key
        }
      }
    }
    const isInternalRequest = hasValidKey

    if (!isInternalRequest) {
      logger.warn('Unauthorized internal email request', { origin, host })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, html, from } = body

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      )
    }

    const result = await sendEmail({ to, subject, html, from })

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message })
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 500 })
    }
  } catch (error) {
    logger.error('Failed to send internal email', { error })
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
