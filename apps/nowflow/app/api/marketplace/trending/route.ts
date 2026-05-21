import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { getTemplatesByCategory, getTrendingTemplates } from '@/lib/marketplace/trending-calculator'

const logger = createLogger('MarketplaceTrendingAPI')

/**
 * GET /api/marketplace/trending
 * Get trending templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const category = searchParams.get('category')
    const sortBy = searchParams.get('sortBy') as
      | 'trending'
      | 'rating'
      | 'usage'
      | 'recent'
      | undefined
    const minRating = searchParams.get('minRating')
      ? parseFloat(searchParams.get('minRating')!)
      : undefined
    const offset = parseInt(searchParams.get('offset') || '0')

    if (category) {
      const { templates, total } = await getTemplatesByCategory(category, {
        limit,
        offset,
        sortBy,
        minRating,
      })

      return NextResponse.json({
        success: true,
        data: templates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      })
    }

    const templates = await getTrendingTemplates(limit)

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    logger.error('Failed to get trending templates', { error })
    return NextResponse.json({ error: 'Failed to get trending templates' }, { status: 500 })
  }
}

/**
 * POST /api/marketplace/trending
 * Recalculate trending scores (admin/cron)
 * Note: Scores are now calculated on-the-fly, this endpoint is for backwards compatibility
 */
export async function POST(request: NextRequest) {
  // Trending scores are now calculated in real-time, no batch update needed
  return NextResponse.json({
    success: true,
    message: 'Trending scores are calculated on-the-fly',
  })
}
