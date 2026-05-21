import { MetadataRoute } from 'next'
import { and, eq, isNotNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { blogPost } from '@/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Sitemap for NowFlow Community.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const currentDate = new Date()

  const entries: MetadataRoute.Sitemap = [
    // ============================================
    // MAIN PAGES - Highest Priority
    // ============================================
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    // ============================================
    // AUTHENTICATION & USER ACQUISITION
    // ============================================
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },

    // ============================================
    // LEGAL & COMPLIANCE PAGES
    // ============================================
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/dpa`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ]

  try {
    const now = new Date()
    const posts = await db
      .select({
        slug: blogPost.slug,
        updatedAt: blogPost.updatedAt,
        publishedAt: blogPost.publishedAt,
      })
      .from(blogPost)
      .where(
        and(
          eq(blogPost.status, 'published'),
          isNotNull(blogPost.publishedAt),
          lte(blogPost.publishedAt, now)
        )
      )

    for (const post of posts) {
      entries.push({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt ?? post.publishedAt ?? currentDate,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })
    }
  } catch (error) {
    console.error('Failed to load blog posts for sitemap:', error)
  }

  return entries
}

/**
 * Note: User-specific workflows (/w/*) are intentionally excluded
 * from the sitemap as they are private and should not be indexed.
 *
 * API routes (/api/*) are also excluded
 * as per robots.txt directives.
 */
