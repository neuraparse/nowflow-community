import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { invalidateSubscriptionCache } from '@/hooks/use-subscription'

const logger = createLogger('SubscriptionWebhook')

/**
 * Webhook to invalidate subscription cache when Stripe updates
 * This ensures UI reflects subscription changes immediately
 */
export async function POST(request: NextRequest) {
  try {
    // Better-auth already handles Stripe webhooks
    // This is just for cache invalidation

    // Invalidate subscription cache for all users
    // (since we don't know which user updated)
    invalidateSubscriptionCache()

    logger.info('Subscription cache invalidated after webhook')

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
