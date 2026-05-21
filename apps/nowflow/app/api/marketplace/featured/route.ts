import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { getFeaturedTemplates } from '@/lib/marketplace/trending-calculator'

const logger = createLogger('MarketplaceFeaturedAPI')

/**
 * GET /api/marketplace/featured
 * Get curated example templates for the marketplace landing view.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 24)
    const templates = await getFeaturedTemplates(limit)

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    logger.error('Failed to get featured templates', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to get featured templates' },
      { status: 500 }
    )
  }
}
