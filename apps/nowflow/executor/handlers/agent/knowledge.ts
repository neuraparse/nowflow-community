import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('AgentBlockHandler')

/**
 * Extracted knowledge search logic.
 * Returns formatted knowledge context or null. Fail-safe: never throws.
 */
export async function searchKnowledge(
  inputs: Record<string, any>,
  searchQuery: string
): Promise<{ context: string | null; resultCount: number }> {
  try {
    const sourceIds = inputs.knowledgeSources
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0)

    if (sourceIds.length === 0) return { context: null, resultCount: 0 }

    const queryText = typeof searchQuery === 'string' ? searchQuery : String(searchQuery)
    logger.info('Performing semantic search', {
      sourceIds,
      query: queryText.substring(0, 100),
      isServerSide: typeof window === 'undefined',
    })

    let searchResults: any[] = []

    if (typeof window === 'undefined') {
      // Server-side: Direct function call
      searchResults = await performSemanticSearch(
        queryText,
        sourceIds,
        parseInt(inputs.searchMaxResults || '5'),
        parseFloat(inputs.similarityThreshold || '0.3'),
        inputs.apiKey
      )
    } else {
      // Client-side: Use API endpoint
      logger.info('Using API for semantic search (client-side)', { hasApiKey: !!inputs.apiKey })
      const response = await fetch('/api/knowledge/search/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          sourceIds,
          maxResults: parseInt(inputs.searchMaxResults || '5'),
          similarityThreshold: parseFloat(inputs.similarityThreshold || '0.3'),
          apiKey: inputs.apiKey,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        searchResults = data.results || []
        logger.info('API semantic search completed', { resultCount: searchResults.length })
      } else {
        const errorData = await response.json().catch(() => ({}))
        logger.error('API semantic search failed', {
          status: response.status,
          error: errorData.error || 'Unknown error',
        })
      }
    }

    if (searchResults && searchResults.length > 0) {
      const knowledgeContext = searchResults
        .map((result: any, index: number) => {
          return `[Source ${index + 1}: ${result.source?.name || 'Unknown'} / ${result.document?.name || 'Unknown'}]
${result.chunk?.content || result.content || ''}
(Similarity: ${((result.similarity || 0) * 100).toFixed(1)}%)`
        })
        .join('\n\n---\n\n')

      logger.info('Knowledge sources found', { resultCount: searchResults.length })
      return { context: knowledgeContext, resultCount: searchResults.length }
    }

    logger.info('No relevant knowledge found', { sourceIds })
    return { context: null, resultCount: 0 }
  } catch (error: any) {
    // Fail-safe: Don't break execution if knowledge search fails
    logger.error('Knowledge source search failed (continuing without)', {
      error: error?.message || error,
    })
    return { context: null, resultCount: 0 }
  }
}

/**
 * Perform semantic search via internal API route
 * Uses HTTP fetch to completely avoid server-only module bundling issues
 */
async function performSemanticSearch(
  query: string,
  sourceIds: string[],
  maxResults: number,
  similarityThreshold: number,
  apiKey?: string
): Promise<any[]> {
  try {
    // Use internal API URL to avoid hairpin NAT issues
    const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000'
    const url = `${baseUrl}/api/knowledge/search/internal`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add internal API key if available
    const internalKey = process.env.INTERNAL_API_KEY
    if (internalKey) {
      headers['Authorization'] = `Bearer ${internalKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        sourceIds,
        maxResults,
        similarityThreshold,
        apiKey,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  } catch (error: any) {
    logger.error('Semantic search failed', {
      error: error?.message || error,
      sourceIds,
    })
    return []
  }
}
