import { eq, inArray, sql } from 'drizzle-orm'
import 'server-only'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { knowledgeChunk, knowledgeDocument, knowledgeSource } from '@/db/schema'
import { EmbeddingService } from './embedding-service'
import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeSource,
  SemanticSearchQuery,
  SemanticSearchResult,
} from './types'

type KnowledgeChunkRow = typeof knowledgeChunk.$inferSelect
type KnowledgeDocumentRow = typeof knowledgeDocument.$inferSelect
type KnowledgeSourceRow = typeof knowledgeSource.$inferSelect

const logger = createLogger('SemanticSearchService')

/**
 * Semantic Search Service
 *
 * Provides semantic search functionality using vector embeddings.
 * Supports both pgvector (when available) and in-memory similarity search.
 */
export class SemanticSearchService {
  /**
   * Perform semantic search across knowledge sources
   */
  static async search(
    query: SemanticSearchQuery,
    apiKey?: string
  ): Promise<SemanticSearchResult[]> {
    try {
      const {
        query: searchQuery,
        sourceIds,
        maxResults = 5,
        similarityThreshold = 0.3, // Lower threshold for zero-padded Ollama embeddings
        filters,
      } = query

      // Get the embedding model from first source
      const sources = await db
        .select()
        .from(knowledgeSource)
        .where(inArray(knowledgeSource.id, sourceIds))

      if (sources.length === 0) {
        logger.warn('No sources found for semantic search', { sourceIds })
        return []
      }

      const embeddingModel = sources[0].embeddingModel as any

      // Try to generate query embedding
      let queryEmbedding: number[] | null = null
      try {
        logger.info('Generating query embedding', { model: embeddingModel })
        queryEmbedding = await EmbeddingService.generateEmbedding(
          searchQuery,
          embeddingModel,
          apiKey
        )
      } catch (embeddingError: any) {
        logger.warn('Failed to generate query embedding, falling back to text search', {
          error: embeddingError?.message || embeddingError,
        })
      }

      let results: SemanticSearchResult[]

      if (queryEmbedding && queryEmbedding.length > 0) {
        // Check if pgvector is available (by trying to use vector operations)
        const hasPgVector = await this.checkPgVectorAvailable()

        if (hasPgVector) {
          // Use hybrid search (pgvector + full-text)
          results = await this.searchWithPgVector(
            queryEmbedding,
            sourceIds,
            maxResults,
            similarityThreshold,
            filters,
            searchQuery // Pass original query for full-text search
          )
        } else {
          // Fallback to in-memory similarity search
          logger.warn('pgvector not available, using in-memory search')
          results = await this.searchInMemory(
            queryEmbedding,
            sourceIds,
            maxResults,
            similarityThreshold,
            filters,
            searchQuery // Pass original query for text fallback
          )
        }
      } else {
        // No embedding available - use text-only search
        logger.info('Using text-only search (no embedding available)')
        results = await this.searchInMemory(
          [], // Empty embedding
          sourceIds,
          maxResults,
          0.1, // Lower threshold for text matching
          filters,
          searchQuery
        )
      }

      logger.info('Semantic search completed', {
        query: searchQuery.substring(0, 50),
        resultsCount: results.length,
      })

      return results
    } catch (error: any) {
      logger.error('Semantic search failed', {
        error: error?.message || error,
        stack: error?.stack,
      })
      throw error
    }
  }

  /**
   * Hybrid Search using pgvector + PostgreSQL full-text search
   * Combines semantic similarity (cosine) with keyword relevance (BM25-like ts_rank)
   */
  private static async searchWithPgVector(
    queryEmbedding: number[],
    sourceIds: string[],
    maxResults: number,
    similarityThreshold: number,
    filters?: any,
    searchQuery?: string
  ): Promise<SemanticSearchResult[]> {
    try {
      // Convert embedding array to PostgreSQL vector format
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      // Build parameterized source IDs filter (prevents SQL injection)
      const sourceIdPlaceholders = sourceIds
        .map((_, i) => sql`${sourceIds[i]}`)
        .reduce((acc, val, i) => (i === 0 ? sql`${val}` : sql`${acc}, ${val}`))

      // Build parameterized document filter if provided
      const hasDocFilter = filters?.documentIds?.length > 0
      const docIdPlaceholders = hasDocFilter
        ? filters.documentIds
            .map((_: string, i: number) => sql`${filters.documentIds[i]}`)
            .reduce((acc: any, val: any, i: number) =>
              i === 0 ? sql`${val}` : sql`${acc}, ${val}`
            )
        : null

      // Hybrid scoring weights (tunable)
      const VECTOR_WEIGHT = 0.7 // Semantic similarity weight
      const TEXT_WEIGHT = 0.3 // Full-text (BM25) weight

      // Build hybrid search query with fully parameterized inputs
      // - (1 - cosine_distance) gives similarity score (0-1)
      // - ts_rank gives relevance score for full-text search
      const hybridQuery = searchQuery
        ? sql`
          SELECT
            kc.id,
            kc.document_id,
            kc.source_id,
            kc.content,
            kc.chunk_index,
            kc.metadata,
            kc.token_count,
            kc.created_at,
            (1 - (kc.embedding <=> ${embeddingStr}::vector)) as vector_score,
            COALESCE(ts_rank(kc.search_vector, plainto_tsquery('english', ${searchQuery})), 0) as text_score,
            (
              (1 - (kc.embedding <=> ${embeddingStr}::vector)) * ${VECTOR_WEIGHT} +
              COALESCE(ts_rank(kc.search_vector, plainto_tsquery('english', ${searchQuery})), 0) * ${TEXT_WEIGHT}
            ) as hybrid_score
          FROM knowledge_chunk kc
          WHERE kc.source_id IN (${sourceIdPlaceholders})
            AND kc.embedding IS NOT NULL
            ${hasDocFilter ? sql`AND kc.document_id IN (${docIdPlaceholders})` : sql``}
          ORDER BY hybrid_score DESC
          LIMIT ${maxResults}
        `
        : sql`
          SELECT
            kc.id,
            kc.document_id,
            kc.source_id,
            kc.content,
            kc.chunk_index,
            kc.metadata,
            kc.token_count,
            kc.created_at,
            (1 - (kc.embedding <=> ${embeddingStr}::vector)) as vector_score,
            0 as text_score,
            (1 - (kc.embedding <=> ${embeddingStr}::vector)) as hybrid_score
          FROM knowledge_chunk kc
          WHERE kc.source_id IN (${sourceIdPlaceholders})
            AND kc.embedding IS NOT NULL
            ${hasDocFilter ? sql`AND kc.document_id IN (${docIdPlaceholders})` : sql``}
          ORDER BY hybrid_score DESC
          LIMIT ${maxResults}
        `

      const rawResults = await db.execute(hybridQuery)
      const rows = rawResults.rows as any[]

      if (rows.length === 0) {
        logger.info('No results from hybrid search')
        return []
      }

      // Filter by similarity threshold
      const filteredRows = rows.filter((row) => row.hybrid_score >= similarityThreshold)

      if (filteredRows.length === 0) {
        logger.info('No results above similarity threshold', { threshold: similarityThreshold })
        return []
      }

      // Get documents and sources for results
      const documentIds = [...new Set(filteredRows.map((row) => row.document_id))]
      const documents = await db
        .select()
        .from(knowledgeDocument)
        .where(inArray(knowledgeDocument.id, documentIds))

      const sources = await db
        .select()
        .from(knowledgeSource)
        .where(inArray(knowledgeSource.id, sourceIds))

      // Map to results
      const results: SemanticSearchResult[] = filteredRows.map((row) => {
        const doc = documents.find((d: KnowledgeDocumentRow) => d.id === row.document_id)!
        const source = sources.find((s: KnowledgeSourceRow) => s.id === row.source_id)!

        return {
          chunk: {
            id: row.id,
            documentId: row.document_id,
            sourceId: row.source_id,
            content: row.content,
            chunkIndex: row.chunk_index,
            metadata: row.metadata,
            tokenCount: row.token_count,
            createdAt: row.created_at,
          },
          document: this.mapToKnowledgeDocument(doc),
          source: this.mapToKnowledgeSource(source),
          similarity: row.hybrid_score,
          vectorScore: row.vector_score,
          textScore: row.text_score,
        }
      })

      logger.info('Hybrid search completed', {
        totalResults: results.length,
        vectorWeight: VECTOR_WEIGHT,
        textWeight: TEXT_WEIGHT,
      })

      return results
    } catch (error: any) {
      logger.error('Hybrid search with pgvector failed', {
        error: error?.message || error,
        stack: error?.stack,
      })
      // Fallback to in-memory search
      logger.warn('Falling back to in-memory search')
      return this.searchInMemory(
        queryEmbedding,
        sourceIds,
        maxResults,
        similarityThreshold,
        filters,
        searchQuery
      )
    }
  }

  /**
   * In-memory similarity search (fallback)
   * Uses cosine similarity when embeddings exist, falls back to keyword matching
   */
  private static async searchInMemory(
    queryEmbedding: number[],
    sourceIds: string[],
    maxResults: number,
    similarityThreshold: number,
    filters?: any,
    searchQuery?: string
  ): Promise<SemanticSearchResult[]> {
    // Get all chunks from sources (this is not efficient for large datasets)
    let chunksQuery = db
      .select()
      .from(knowledgeChunk)
      .where(inArray(knowledgeChunk.sourceId, sourceIds))

    // Apply document filter if provided
    if (filters?.documentIds) {
      chunksQuery = chunksQuery.where(inArray(knowledgeChunk.documentId, filters.documentIds))
    }

    const chunks = await chunksQuery

    if (chunks.length === 0) {
      return []
    }

    // Check if chunks have embeddings
    const hasEmbeddings = chunks.some(
      (c: KnowledgeChunkRow) => c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0
    )

    let scoredChunks: { chunk: KnowledgeChunkRow; score: number }[]

    if (hasEmbeddings && queryEmbedding && queryEmbedding.length > 0) {
      // Use cosine similarity with embeddings
      logger.info('Using cosine similarity for in-memory search', {
        chunkCount: chunks.length,
        queryEmbeddingLength: queryEmbedding.length,
        threshold: similarityThreshold,
      })

      type ScoredChunk = { chunk: KnowledgeChunkRow; score: number; embeddingLength: number }
      const allScores: ScoredChunk[] = chunks.map((chunk: KnowledgeChunkRow) => {
        if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
          return { chunk, score: 0, embeddingLength: 0 }
        }
        const chunkEmbedding = chunk.embedding as number[]
        const score = this.cosineSimilarity(queryEmbedding, chunkEmbedding)
        return { chunk, score, embeddingLength: chunkEmbedding.length }
      })

      // Log all scores for debugging
      logger.info('Cosine similarity scores', {
        scores: allScores.map((s: ScoredChunk) => ({
          chunkId: s.chunk.id,
          score: s.score.toFixed(4),
          embeddingLength: s.embeddingLength,
          contentPreview: s.chunk.content.substring(0, 50),
        })),
        threshold: similarityThreshold,
      })

      scoredChunks = allScores
        .filter((item: ScoredChunk) => item.score >= similarityThreshold)
        .sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score)
        .slice(0, maxResults)
    } else {
      // Fallback to keyword matching
      logger.warn('In-memory search using basic text matching (no embeddings)', {
        chunkCount: chunks.length,
        hasQuery: !!searchQuery,
      })

      // Use the original search query for text matching
      const queryText = searchQuery || ''
      // Extract meaningful search terms (min 2 chars, remove common words)
      const searchTerms = queryText
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= 2)
        .filter(
          (term) =>
            ![
              'the',
              'a',
              'an',
              'is',
              'are',
              'was',
              'were',
              'what',
              'how',
              'why',
              'when',
              'where',
            ].includes(term)
        )

      logger.info('Text search terms', { searchTerms })

      type KeywordScored = { chunk: KnowledgeChunkRow; score: number }
      scoredChunks = (chunks as KnowledgeChunkRow[])
        .map((chunk: KnowledgeChunkRow) => {
          const content = chunk.content.toLowerCase()
          let score = 0
          let matchedTerms = 0

          // Score based on term frequency and exact phrase matching
          for (const term of searchTerms) {
            if (content.includes(term)) {
              matchedTerms++
              // Count occurrences of the term
              const regex = new RegExp(term, 'gi')
              const matches = content.match(regex)
              score += matches ? matches.length : 0
            }
          }

          // Boost score if multiple terms match
          if (matchedTerms > 1) {
            score *= 1 + matchedTerms / searchTerms.length
          }

          // Normalize score to 0-1 range (approximate)
          const normalizedScore =
            searchTerms.length > 0
              ? Math.min(
                  1,
                  (matchedTerms / searchTerms.length) * 0.5 +
                    (score / (searchTerms.length * 3)) * 0.5
                )
              : 0

          return { chunk, score: normalizedScore }
        })
        .filter((item: KeywordScored) => item.score > 0) // Accept any match for keyword search
        .sort((a: KeywordScored, b: KeywordScored) => b.score - a.score)
        .slice(0, maxResults)
    }

    if (scoredChunks.length === 0) {
      return []
    }

    // Get documents and sources
    const documentIds = [...new Set(scoredChunks.map((item) => item.chunk.documentId))]
    const documents = await db
      .select()
      .from(knowledgeDocument)
      .where(inArray(knowledgeDocument.id, documentIds))

    const sources = await db
      .select()
      .from(knowledgeSource)
      .where(inArray(knowledgeSource.id, sourceIds))

    // Map to results
    const results: SemanticSearchResult[] = scoredChunks.map((item) => {
      const doc = documents.find((d: KnowledgeDocumentRow) => d.id === item.chunk.documentId)!
      const source = sources.find((s: KnowledgeSourceRow) => s.id === item.chunk.sourceId)!

      return {
        chunk: this.mapToKnowledgeChunk(item.chunk),
        document: this.mapToKnowledgeDocument(doc),
        source: this.mapToKnowledgeSource(source),
        similarity: item.score,
      }
    })

    return results
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Check if pgvector extension is available
   */
  private static async checkPgVectorAvailable(): Promise<boolean> {
    try {
      // Try to check if pgvector extension exists
      const result = await db.execute(
        sql`SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as available`
      )

      return (result.rows[0] as any)?.available || false
    } catch (error) {
      logger.debug('pgvector check failed', { error })
      return false
    }
  }

  /**
   * Generate and store embeddings for all chunks in a source
   */
  static async generateEmbeddingsForSource(sourceId: string, apiKey?: string): Promise<void> {
    try {
      // Get source
      const sources = await db
        .select()
        .from(knowledgeSource)
        .where(eq(knowledgeSource.id, sourceId))
        .limit(1)

      if (sources.length === 0) {
        throw new Error('Source not found')
      }

      const source = sources[0]
      const embeddingModel = source.embeddingModel as any

      // Get all chunks for this source
      const chunks = await db
        .select()
        .from(knowledgeChunk)
        .where(eq(knowledgeChunk.sourceId, sourceId))

      if (chunks.length === 0) {
        logger.warn('No chunks found for source', { sourceId })
        return
      }

      logger.info('Generating embeddings for chunks', {
        sourceId,
        chunkCount: chunks.length,
        model: embeddingModel,
      })

      // Generate embeddings in batches
      const batchSize = 100
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const texts = batch.map((chunk: KnowledgeChunkRow) => chunk.content)

        const embeddings = await EmbeddingService.generateEmbeddings(texts, embeddingModel, apiKey)

        // Update chunks with embeddings
        // Note: This requires the embedding column to be uncommented in schema
        // For now, we'll just log
        logger.info('Generated embeddings for batch', {
          batchStart: i,
          batchSize: batch.length,
        })

        // TODO: Update chunks with embeddings when column is available
        // await db.update(knowledgeChunk)
        //   .set({ embedding: embeddings[j] })
        //   .where(eq(knowledgeChunk.id, batch[j].id))
      }

      logger.info('Embeddings generation completed', {
        sourceId,
        totalChunks: chunks.length,
      })
    } catch (error: any) {
      logger.error('Failed to generate embeddings for source', {
        sourceId,
        error: error?.message || error,
      })
      throw error
    }
  }

  /**
   * Map database row to KnowledgeChunk
   */
  private static mapToKnowledgeChunk(row: any): KnowledgeChunk {
    return {
      id: row.id,
      documentId: row.documentId,
      sourceId: row.sourceId,
      content: row.content,
      chunkIndex: row.chunkIndex,
      embedding: row.embedding,
      metadata: row.metadata,
      tokenCount: row.tokenCount,
      createdAt: row.createdAt,
    }
  }

  /**
   * Map database row to KnowledgeDocument
   */
  private static mapToKnowledgeDocument(row: any): KnowledgeDocument {
    return {
      id: row.id,
      sourceId: row.sourceId,
      name: row.name,
      type: row.type,
      filePath: row.filePath,
      fileUrl: row.fileUrl,
      fileType: row.fileType,
      fileSize: row.fileSize,
      rawContent: row.rawContent,
      processedContent: row.processedContent,
      status: row.status,
      errorMessage: row.errorMessage,
      metadata: row.metadata,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
      updatedAt: row.updatedAt,
    }
  }

  /**
   * Map database row to KnowledgeSource
   */
  private static mapToKnowledgeSource(row: any): KnowledgeSource {
    return {
      id: row.id,
      userId: row.userId,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      icon: row.icon,
      visibility: row.visibility,
      allowedUserIds: row.allowedUserIds,
      documentCount: row.documentCount,
      totalSize: row.totalSize,
      usageCount: row.usageCount,
      embeddingModel: row.embeddingModel,
      chunkSize: row.chunkSize,
      chunkOverlap: row.chunkOverlap,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
