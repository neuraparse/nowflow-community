import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { KnowledgeSourceService } from '@/lib/knowledge'
import { getUserOpenAIKey } from '@/lib/knowledge/get-user-api-key'
import { SemanticSearchService } from '@/lib/knowledge/semantic-search-service'
import type { SemanticSearchQuery } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('KnowledgeSearchAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SearchSchema = z.object({
  query: z.string().min(1),
  sourceIds: z.array(z.string().uuid()),
  maxResults: z.number().optional(),
  similarityThreshold: z.number().optional(),
  filters: z
    .object({
      documentIds: z.array(z.string().uuid()).optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
})

/**
 * POST - Perform semantic search
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
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

    const searchQuery: SemanticSearchQuery = parsed.data

    // Verify user has access to all requested sources
    const service = new KnowledgeSourceService(session.user.id)

    for (const sourceId of searchQuery.sourceIds) {
      const access = await service.checkAccess(sourceId)
      if (!access.hasAccess) {
        return NextResponse.json({ error: `Access denied to source: ${sourceId}` }, { status: 403 })
      }
    }

    // Load user's API key for OpenAI embedding models
    const apiKey = await getUserOpenAIKey(session.user.id)

    // Perform search
    const results = await SemanticSearchService.search(searchQuery, apiKey)

    return NextResponse.json({
      results,
      count: results.length,
      query: searchQuery.query,
    })
  } catch (error: any) {
    logger.error('Semantic search failed', {
      error: error?.message || error,
      stack: error?.stack,
    })

    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
