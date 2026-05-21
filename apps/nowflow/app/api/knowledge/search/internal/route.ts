import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SemanticSearchService } from '@/lib/knowledge/semantic-search-service'
import type { SemanticSearchQuery } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('KnowledgeSearchInternalAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SearchSchema = z.object({
  query: z.string().min(1),
  sourceIds: z.array(z.string().uuid()),
  maxResults: z.number().optional(),
  similarityThreshold: z.number().optional(),
  apiKey: z.string().optional(),
})

/**
 * POST - Perform semantic search (internal use only)
 * This endpoint is called by the agent handler during workflow execution.
 * It supports both internal API key auth and same-origin browser requests.
 */
export async function POST(request: Request) {
  try {
    // Check for internal API key or same-origin request
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    // Allow if:
    // 1. Internal key matches
    // 2. Same-origin request (browser calling from same domain)
    // 3. Development mode without internal key
    const isDevelopment = process.env.NODE_ENV === 'development'
    const hasValidKey = expectedKey && authHeader === `Bearer ${expectedKey}`
    const isSameOrigin = origin && host && origin.includes(host.split(':')[0])
    const allowDevAccess = isDevelopment

    if (!hasValidKey && !isSameOrigin && !allowDevAccess) {
      logger.warn('Unauthorized internal search attempt', {
        hasKey: !!authHeader,
        origin,
        host,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = SearchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { query, sourceIds, maxResults, similarityThreshold, apiKey } = parsed.data

    const searchQuery: SemanticSearchQuery = {
      query,
      sourceIds,
      maxResults: maxResults || 5,
      similarityThreshold: similarityThreshold || 0.7,
    }

    // Perform search
    const results = await SemanticSearchService.search(searchQuery, apiKey)

    return NextResponse.json({
      results,
      count: results.length,
      query: searchQuery.query,
    })
  } catch (error: any) {
    logger.error('Internal semantic search failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
