import { and, desc, eq, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { marketplace } from '@/db/schema'

const logger = createLogger('TrendingCalculator')

export interface TrendingTemplate {
  id: string
  workflowId: string
  name: string
  description: string
  authorName: string
  views: number
  rating: string
  category: string
  tags: unknown
  useCount: number
  ratingAvg: number
  ratingCount: number
  difficultyLevel: string
  trendingScore: number
  isExample: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Calculates trending score for a template in memory
 * Score = (usage_weight * usage) + (rating_weight * rating) + (recency_weight * recency)
 */
function calculateTrendingScore(template: {
  useCount: number
  rating: string | null
  ratingCount: number
  createdAt: Date
}): number {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  // Usage score (normalized, max 40 points)
  const usageScore = Math.min(template.useCount / 100, 1) * 40

  // Rating score (max 30 points)
  const ratingAvg = parseFloat(template.rating || '0') || 0
  const ratingScore = (ratingAvg / 5) * 30

  // Recency score (decay over 30 days, max 30 points)
  const ageInDays = (now - template.createdAt.getTime()) / dayMs
  const recencyScore = Math.max(0, 30 - ageInDays)

  return Math.round((usageScore + ratingScore + recencyScore) * 100) / 100
}

/**
 * Maps a database template to TrendingTemplate interface
 */
function mapToTrendingTemplate(t: typeof marketplace.$inferSelect): TrendingTemplate {
  const ratingAvg = parseFloat(t.rating || '0') || 0
  return {
    id: t.id,
    workflowId: t.workflowId,
    name: t.name,
    description: t.description || '',
    authorName: t.authorName,
    views: t.views,
    rating: t.rating || '0.00',
    category: t.category || 'general',
    tags: t.tags,
    useCount: t.useCount,
    ratingAvg,
    ratingCount: t.ratingCount,
    difficultyLevel: t.difficultyLevel || 'beginner',
    trendingScore: calculateTrendingScore({
      useCount: t.useCount,
      rating: t.rating,
      ratingCount: t.ratingCount,
      createdAt: t.createdAt,
    }),
    isExample: t.isExample,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

/**
 * Gets trending templates (approved and active)
 */
export async function getTrendingTemplates(limit: number = 10): Promise<TrendingTemplate[]> {
  try {
    const templates = await db
      .select()
      .from(marketplace)
      .where(and(eq(marketplace.status, 'approved'), eq(marketplace.active, true)))
      .orderBy(desc(marketplace.useCount)) // Order by usage as proxy for trending
      .limit(limit * 2) // Get more to sort by calculated score

    const mapped: TrendingTemplate[] = templates.map(mapToTrendingTemplate)

    // Sort by calculated trending score and return top N
    return mapped
      .sort((a: TrendingTemplate, b: TrendingTemplate) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
  } catch (error) {
    logger.error('Failed to get trending templates', { error })
    throw error
  }
}

/**
 * Gets featured templates (curated examples)
 */
export async function getFeaturedTemplates(limit: number = 10): Promise<TrendingTemplate[]> {
  try {
    const templates = await db
      .select()
      .from(marketplace)
      .where(
        and(
          eq(marketplace.status, 'approved'),
          eq(marketplace.active, true),
          eq(marketplace.isExample, true)
        )
      )
      .orderBy(marketplace.exampleOrder)
      .limit(limit)

    return templates.map(mapToTrendingTemplate)
  } catch (error) {
    logger.error('Failed to get featured templates', { error })
    throw error
  }
}

/**
 * Gets templates by category with filtering
 */
export async function getTemplatesByCategory(
  category: string,
  options: {
    limit?: number
    offset?: number
    sortBy?: 'trending' | 'rating' | 'usage' | 'recent'
    minRating?: number
  } = {}
): Promise<{ templates: TrendingTemplate[]; total: number }> {
  const { limit = 20, offset = 0, sortBy = 'trending', minRating } = options

  try {
    const conditions = [
      eq(marketplace.status, 'approved'),
      eq(marketplace.active, true),
      eq(marketplace.category, category),
    ]

    let orderBy
    switch (sortBy) {
      case 'rating':
        orderBy = desc(marketplace.rating)
        break
      case 'usage':
        orderBy = desc(marketplace.useCount)
        break
      case 'recent':
        orderBy = desc(marketplace.createdAt)
        break
      default:
        orderBy = desc(marketplace.useCount) // Use useCount as proxy for trending
    }

    const templates = await db
      .select()
      .from(marketplace)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(marketplace)
      .where(and(...conditions))

    let result: TrendingTemplate[] = templates.map(mapToTrendingTemplate)

    // If sorting by trending, re-sort by calculated score
    if (sortBy === 'trending') {
      result = result.sort(
        (a: TrendingTemplate, b: TrendingTemplate) => b.trendingScore - a.trendingScore
      )
    }

    if (minRating) {
      result = result.filter((t: TrendingTemplate) => t.ratingAvg >= minRating)
    }

    return {
      templates: result,
      total: Number(count),
    }
  } catch (error) {
    logger.error('Failed to get templates by category', { category, error })
    throw error
  }
}

/**
 * Rates a template using the marketplaceRating table
 * This updates the average rating on the marketplace table
 */
export async function rateTemplate(
  templateId: string,
  rating: number
): Promise<{ newAverage: number; totalRatings: number }> {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5')
  }

  try {
    const [template] = await db
      .select()
      .from(marketplace)
      .where(eq(marketplace.id, templateId))
      .limit(1)

    if (!template) {
      throw new Error('Template not found')
    }

    // Calculate new average
    const currentAvg = parseFloat(template.rating || '0') || 0
    const currentCount = template.ratingCount
    const newCount = currentCount + 1
    const newAverage = (currentAvg * currentCount + rating) / newCount

    await db
      .update(marketplace)
      .set({
        rating: newAverage.toFixed(2),
        ratingCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, templateId))

    logger.debug('Rated template', { templateId, rating, newAverage })

    return {
      newAverage,
      totalRatings: newCount,
    }
  } catch (error) {
    logger.error('Failed to rate template', { templateId, error })
    throw error
  }
}

/**
 * Increments template usage count
 */
export async function incrementUsage(templateId: string): Promise<void> {
  try {
    await db
      .update(marketplace)
      .set({
        useCount: sql`${marketplace.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, templateId))

    logger.debug('Incremented template usage', { templateId })
  } catch (error) {
    logger.error('Failed to increment usage', { templateId, error })
    throw error
  }
}

/**
 * Sets template as featured (marks as example)
 */
export async function setFeatured(templateId: string, featured: boolean): Promise<void> {
  try {
    await db
      .update(marketplace)
      .set({
        isExample: featured,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, templateId))

    logger.info('Updated template featured status', { templateId, featured })
  } catch (error) {
    logger.error('Failed to set featured', { templateId, error })
    throw error
  }
}
