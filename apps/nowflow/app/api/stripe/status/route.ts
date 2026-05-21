import { NextRequest, NextResponse } from 'next/server'
import { getStripeMode, isStripeEnabled } from '@/lib/stripe-config'

/**
 * GET /api/stripe/status
 * Public endpoint — returns whether Stripe payment is enabled.
 * Used by frontend to show/hide upgrade buttons.
 */
export async function GET(_request: NextRequest) {
  try {
    const [enabled, mode] = await Promise.all([isStripeEnabled(), getStripeMode()])
    return NextResponse.json({ enabled, mode })
  } catch {
    return NextResponse.json({ enabled: false, mode: null })
  }
}
