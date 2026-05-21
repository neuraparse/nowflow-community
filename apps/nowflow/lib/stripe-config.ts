/**
 * Stripe Configuration Service
 *
 * Community builds read Stripe configuration from environment variables only.
 */
import Stripe from 'stripe'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('StripeConfig')

export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  priceIds: {
    starterMonthly: string
    midMonthly: string
    proMonthly: string
    teamMonthly: string
    starterYearly: string
    midYearly: string
    proYearly: string
    teamYearly: string
  }
}

export type StripeMode = 'live' | 'test' | null

/** Detect stripe mode from key prefix */
function detectMode(secretKey: string): StripeMode {
  if (!secretKey) return null
  if (secretKey.startsWith('sk_live_')) return 'live'
  if (secretKey.startsWith('sk_test_')) return 'test'
  return null
}

/**
 * Get the full Stripe configuration.
 */
export async function getStripeConfig(): Promise<StripeConfig> {
  const envSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || ''
  const envPublishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || ''
  const envWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''

  return {
    secretKey: envSecretKey && envSecretKey !== 'placeholder' ? envSecretKey : '',
    publishableKey: envPublishableKey,
    webhookSecret: envWebhookSecret,
    priceIds: {
      starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
      midMonthly: process.env.STRIPE_PRICE_MID_MONTHLY || '',
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      teamMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || '',
      starterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
      midYearly: process.env.STRIPE_PRICE_MID_YEARLY || '',
      proYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
      teamYearly: process.env.STRIPE_PRICE_TEAM_YEARLY || '',
    },
  }
}

/**
 * Check if Stripe is properly configured.
 * Returns true if a valid secret key is available (env or DB).
 */
export async function isStripeEnabled(): Promise<boolean> {
  try {
    const config = await getStripeConfig()
    const key = config.secretKey
    return !!(
      key &&
      key.trim() !== '' &&
      key !== 'placeholder' &&
      (key.startsWith('sk_live_') || key.startsWith('sk_test_'))
    )
  } catch {
    return false
  }
}

/**
 * Get the Stripe mode (live/test/null) based on configured secret key.
 */
export async function getStripeMode(): Promise<StripeMode> {
  try {
    const config = await getStripeConfig()
    return detectMode(config.secretKey)
  } catch {
    return null
  }
}

/**
 * Get an initialized Stripe client using the configured secret key.
 * Returns null if Stripe is not configured.
 */
export async function getStripeClient(): Promise<Stripe | null> {
  try {
    const config = await getStripeConfig()
    if (!config.secretKey || !detectMode(config.secretKey)) return null

    return new Stripe(config.secretKey, {
      apiVersion: '2026-02-25.clover',
    })
  } catch (error) {
    logger.error('Failed to initialize Stripe client', { error })
    return null
  }
}
