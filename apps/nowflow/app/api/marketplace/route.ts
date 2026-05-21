import { NextRequest } from 'next/server'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import * as schema from '@/db/schema'

const logger = createLogger('MarketplaceAPI')

// Cache for 1 minute but can be revalidated on-demand
export const revalidate = 60

// Revenue sharing configuration (for future paid features)
const REVENUE_CONFIG = {
  creatorShare: 0.8, // 80% to creator
  platformShare: 0.2, // 20% to platform
  minPrice: 0,
  maxPrice: 999.99,
  payoutThreshold: 10.0, // Minimum $10 to request payout
}

/**
 * GET /api/marketplace - List marketplace items or creator dashboard
 *
 * Query parameters:
 * - view: 'creator' for creator dashboard view
 * - category: Filter by category
 * - search: Search in name, description, and tags
 * - sort: 'popular' (default), 'newest', 'rating'
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized marketplace access attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    const userId = session.user.id
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'popular'

    // Creator dashboard view
    if (view === 'creator') {
      logger.info(`[${requestId}] Fetching creator dashboard for user: ${userId}`)

      // Fetch creator's items from database
      const myItems = await db
        .select({
          id: schema.marketplace.id,
          workflowId: schema.marketplace.workflowId,
          name: schema.marketplace.name,
          description: schema.marketplace.description,
          authorId: schema.marketplace.authorId,
          authorName: schema.marketplace.authorName,
          category: schema.marketplace.category,
          tags: schema.marketplace.tags,
          views: schema.marketplace.views,
          useCount: schema.marketplace.useCount,
          rating: schema.marketplace.rating,
          ratingCount: schema.marketplace.ratingCount,
          status: schema.marketplace.status,
          active: schema.marketplace.active,
          difficultyLevel: schema.marketplace.difficultyLevel,
          createdAt: schema.marketplace.createdAt,
          updatedAt: schema.marketplace.updatedAt,
        })
        .from(schema.marketplace)
        .where(eq(schema.marketplace.authorId, userId))
        .orderBy(desc(schema.marketplace.createdAt))

      // Calculate stats
      const publishedItems = myItems.filter((i: any) => i.status === 'approved')
      const totalDownloads = myItems.reduce((sum: any, i: any) => sum + (i.useCount || 0), 0)

      logger.info(`[${requestId}] Retrieved ${myItems.length} items for creator: ${userId}`)

      return createSuccessResponse({
        items: myItems,
        stats: {
          totalItems: myItems.length,
          publishedItems: publishedItems.length,
          totalRevenue: 0, // Revenue tracking not yet implemented
          currentBalance: 0, // Balance tracking not yet implemented
          totalDownloads,
          payoutThreshold: REVENUE_CONFIG.payoutThreshold,
        },
        transactions: [], // Transaction history not yet implemented
        revenueConfig: REVENUE_CONFIG,
      })
    }

    // Public marketplace listing
    logger.info(`[${requestId}] Fetching public marketplace listings`, {
      category,
      search,
      sort,
    })

    // Build the query conditions
    const conditions = []

    // Only show approved and active items
    conditions.push(eq(schema.marketplace.status, 'approved'))
    conditions.push(eq(schema.marketplace.active, true))

    // Filter by category if provided
    if (category) {
      conditions.push(eq(schema.marketplace.category, category))
    }

    // Search in name, description, and tags if provided
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`
      conditions.push(
        or(
          ilike(schema.marketplace.name, searchLower),
          ilike(schema.marketplace.description, searchLower),
          sql`${schema.marketplace.tags}::text ILIKE ${searchLower}`
        )
      )
    }

    // Select items based on sort order
    let query = db
      .select({
        id: schema.marketplace.id,
        workflowId: schema.marketplace.workflowId,
        name: schema.marketplace.name,
        description: schema.marketplace.description,
        authorId: schema.marketplace.authorId,
        authorName: schema.marketplace.authorName,
        category: schema.marketplace.category,
        tags: schema.marketplace.tags,
        views: schema.marketplace.views,
        useCount: schema.marketplace.useCount,
        rating: schema.marketplace.rating,
        ratingCount: schema.marketplace.ratingCount,
        difficultyLevel: schema.marketplace.difficultyLevel,
        createdAt: schema.marketplace.createdAt,
        updatedAt: schema.marketplace.updatedAt,
      })
      .from(schema.marketplace)
      .where(and(...conditions))

    // Apply sorting
    switch (sort) {
      case 'popular':
        query = query.orderBy(desc(schema.marketplace.useCount))
        break
      case 'newest':
        query = query.orderBy(desc(schema.marketplace.createdAt))
        break
      case 'rating':
        query = query.orderBy(desc(schema.marketplace.rating))
        break
      default:
        query = query.orderBy(desc(schema.marketplace.useCount))
    }

    const items = await query

    // Get unique categories for filtering
    const allCategories = await db
      .selectDistinct({ category: schema.marketplace.category })
      .from(schema.marketplace)
      .where(and(eq(schema.marketplace.status, 'approved'), eq(schema.marketplace.active, true)))

    const categories = allCategories
      .map((c: any) => c.category)
      .filter((c: any) => c !== null) as string[]

    logger.info(`[${requestId}] Retrieved ${items.length} marketplace items`)

    return createSuccessResponse({
      items,
      categories,
      total: items.length,
    })
  } catch (error: any) {
    logger.error(`[${requestId}] Marketplace listing error`, error)
    return createErrorResponse('Failed to list marketplace items', 500)
  }
}

/**
 * POST /api/marketplace - Not implemented (use specific endpoints)
 *
 * Note: This endpoint has been deprecated in favor of specific endpoints:
 * - Publishing workflows: POST /api/marketplace/publish
 * - Importing workflows: POST /api/marketplace/[id]/import
 * - Rating workflows: POST /api/marketplace/[id]/rate
 *
 * The marketplace is currently a free platform for sharing workflow templates.
 * Paid features (purchases, revenue sharing) may be added in the future.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized marketplace POST attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    logger.info(
      `[${requestId}] Deprecated POST endpoint called - redirecting to specific endpoints`
    )

    return createErrorResponse(
      'This endpoint is deprecated. Use /api/marketplace/publish to publish workflows, or /api/marketplace/[id]/import to import workflows.',
      410 // Gone status code
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Marketplace POST error`, error)
    return createErrorResponse('Failed to process marketplace request', 500)
  }
}

/**
 * PATCH /api/marketplace - Not implemented (use specific endpoints)
 *
 * Note: This endpoint has been deprecated. Use:
 * - PATCH /api/marketplace/[id] for updating marketplace entries
 * - POST /api/marketplace/[id]/unpublish for unpublishing workflows
 */
export async function PATCH(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized marketplace PATCH attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    logger.info(`[${requestId}] Deprecated PATCH endpoint called`)

    return createErrorResponse(
      'This endpoint is deprecated. Update operations are handled through specific endpoints.',
      410
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Marketplace PATCH error`, error)
    return createErrorResponse('Failed to update marketplace item', 500)
  }
}

/**
 * DELETE /api/marketplace - Not implemented (use specific endpoints)
 *
 * Note: This endpoint has been deprecated. Use:
 * - POST /api/marketplace/[id]/unpublish for removing marketplace listings
 */
export async function DELETE(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized marketplace DELETE attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    logger.info(`[${requestId}] Deprecated DELETE endpoint called`)

    return createErrorResponse(
      'This endpoint is deprecated. Use POST /api/marketplace/[id]/unpublish to remove marketplace listings.',
      410
    )
  } catch (error: any) {
    logger.error(`[${requestId}] Marketplace DELETE error`, error)
    return createErrorResponse('Failed to delete marketplace item', 500)
  }
}
