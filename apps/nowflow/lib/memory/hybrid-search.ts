import { sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'

const logger = createLogger('HybridSearch')

export interface HybridSearchOptions {
  query: string
  embedding?: number[]
  sessionId?: string
  agentId?: string
  userId?: string
  limit?: number
  vectorWeight?: number // 0-1, weight for vector similarity (default 0.6)
  textWeight?: number // 0-1, weight for BM25 text relevance (default 0.4)
  minScore?: number // Minimum combined score threshold
  tags?: string[]
  timeDecayFactor?: number // How much to prefer recent memories (default 0.1)
}

export interface HybridSearchResult {
  id: string
  content: any
  vectorScore: number
  textScore: number
  combinedScore: number
  recencyBoost: number
  agentId: string
  sessionId: string
  tags: string[]
  createdAt: Date
}

/**
 * Hybrid Search Engine
 * Combines vector similarity search (pgvector) with BM25-style text search
 */
export class HybridSearchEngine {
  private defaultVectorWeight = 0.6
  private defaultTextWeight = 0.4
  private defaultTimeDecay = 0.1

  /**
   * Perform hybrid search combining vector similarity and text relevance
   */
  async search(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
    const {
      query,
      embedding,
      sessionId,
      agentId,
      userId,
      limit = 10,
      vectorWeight = this.defaultVectorWeight,
      textWeight = this.defaultTextWeight,
      minScore = 0.1,
      tags,
      timeDecayFactor = this.defaultTimeDecay,
    } = options

    try {
      // Build the hybrid query
      const results = await this.executeHybridQuery({
        query,
        embedding,
        sessionId,
        agentId,
        userId,
        limit: limit * 2, // Fetch more for re-ranking
        vectorWeight,
        textWeight,
        tags,
      })

      // Apply time decay and re-rank
      const reranked = results
        .map((result) => {
          const ageHours = (Date.now() - new Date(result.createdAt).getTime()) / (1000 * 60 * 60)
          const recencyBoost = Math.exp((-timeDecayFactor * ageHours) / 24)
          const combinedScore = result.combinedScore * (1 + recencyBoost * 0.2)

          return { ...result, recencyBoost, combinedScore }
        })
        .filter((r) => r.combinedScore >= minScore)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit)

      logger.debug('Hybrid search completed', {
        query: query.slice(0, 50),
        results: reranked.length,
        topScore: reranked[0]?.combinedScore,
      })

      return reranked
    } catch (error) {
      logger.error('Hybrid search failed', { error, query: query.slice(0, 50) })
      // Fallback to text-only search
      return this.textOnlySearch(options)
    }
  }

  /**
   * Execute the hybrid SQL query using parameterized queries via Drizzle
   */
  private async executeHybridQuery(params: {
    query: string
    embedding?: number[]
    sessionId?: string
    agentId?: string
    userId?: string
    limit: number
    vectorWeight: number
    textWeight: number
    tags?: string[]
  }): Promise<HybridSearchResult[]> {
    const conditions: string[] = []
    const sqlChunks: any[] = []

    if (params.embedding && params.embedding.length > 0) {
      // Full hybrid: vector + text
      const embeddingLiteral = `[${params.embedding.join(',')}]`

      const result = await db.execute(sql`
        WITH vector_results AS (
          SELECT
            am.id,
            am.content,
            am."agentId",
            am."sessionId",
            am.tags,
            am."createdAt",
            1 - (am.embedding <=> ${embeddingLiteral}::vector) as vector_score
          FROM "agentMemory" am
          WHERE am.embedding IS NOT NULL
            ${params.userId ? sql`AND am."userId" = ${params.userId}` : sql``}
            ${params.agentId ? sql`AND am."agentId" = ${params.agentId}` : sql``}
            ${params.sessionId ? sql`AND am."sessionId" = ${params.sessionId}` : sql``}
          ORDER BY am.embedding <=> ${embeddingLiteral}::vector
          LIMIT ${params.limit * 2}
        ),
        text_results AS (
          SELECT
            am.id,
            am.content,
            am."agentId",
            am."sessionId",
            am.tags,
            am."createdAt",
            ts_rank_cd(
              to_tsvector('english', COALESCE(am.content->>'message', '')),
              plainto_tsquery('english', ${params.query})
            ) as text_score
          FROM "agentMemory" am
          WHERE to_tsvector('english', COALESCE(am.content->>'message', '')) @@ plainto_tsquery('english', ${params.query})
            ${params.userId ? sql`AND am."userId" = ${params.userId}` : sql``}
            ${params.agentId ? sql`AND am."agentId" = ${params.agentId}` : sql``}
            ${params.sessionId ? sql`AND am."sessionId" = ${params.sessionId}` : sql``}
          LIMIT ${params.limit * 2}
        )
        SELECT
          COALESCE(v.id, t.id) as id,
          COALESCE(v.content, t.content) as content,
          COALESCE(v."agentId", t."agentId") as "agentId",
          COALESCE(v."sessionId", t."sessionId") as "sessionId",
          COALESCE(v.tags, t.tags) as tags,
          COALESCE(v."createdAt", t."createdAt") as "createdAt",
          COALESCE(v.vector_score, 0) as vector_score,
          COALESCE(t.text_score, 0) as text_score,
          (COALESCE(v.vector_score, 0) * ${params.vectorWeight} + COALESCE(t.text_score, 0) * ${params.textWeight}) as combined_score
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
        ORDER BY combined_score DESC
        LIMIT ${params.limit}
      `)

      return this.mapResults(result.rows || [])
    } else {
      // Text-only search using ts_rank
      const result = await db.execute(sql`
        SELECT
          am.id,
          am.content,
          am."agentId",
          am."sessionId",
          am.tags,
          am."createdAt",
          0 as vector_score,
          ts_rank_cd(
            to_tsvector('english', COALESCE(am.content->>'message', '')),
            plainto_tsquery('english', ${params.query})
          ) as text_score,
          ts_rank_cd(
            to_tsvector('english', COALESCE(am.content->>'message', '')),
            plainto_tsquery('english', ${params.query})
          ) as combined_score
        FROM "agentMemory" am
        WHERE to_tsvector('english', COALESCE(am.content->>'message', '')) @@ plainto_tsquery('english', ${params.query})
          ${params.userId ? sql`AND am."userId" = ${params.userId}` : sql``}
          ${params.agentId ? sql`AND am."agentId" = ${params.agentId}` : sql``}
          ${params.sessionId ? sql`AND am."sessionId" = ${params.sessionId}` : sql``}
        ORDER BY combined_score DESC
        LIMIT ${params.limit}
      `)

      return this.mapResults(result.rows || [])
    }
  }

  /**
   * Map raw database rows to HybridSearchResult objects
   */
  private mapResults(rows: any[]): HybridSearchResult[] {
    return rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      vectorScore: parseFloat(row.vector_score) || 0,
      textScore: parseFloat(row.text_score) || 0,
      combinedScore: parseFloat(row.combined_score) || 0,
      recencyBoost: 0,
      agentId: row.agentId,
      sessionId: row.sessionId,
      tags: row.tags || [],
      createdAt: new Date(row.createdAt),
    }))
  }

  /**
   * Fallback: text-only search using ILIKE when full-text search is unavailable
   */
  private async textOnlySearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
    try {
      const searchTerms = options.query.split(/\s+/).filter(Boolean).slice(0, 10) // Cap terms to prevent excessive query size

      if (searchTerms.length === 0) return []

      // Build a single ILIKE pattern from the primary search term
      const primaryTerm = `%${searchTerms[0]}%`

      const result = await db.execute(sql`
        SELECT
          am.id,
          am.content,
          am."agentId",
          am."sessionId",
          am.tags,
          am."createdAt"
        FROM "agentMemory" am
        WHERE am.content->>'message' ILIKE ${primaryTerm}
          ${options.userId ? sql`AND am."userId" = ${options.userId}` : sql``}
          ${options.agentId ? sql`AND am."agentId" = ${options.agentId}` : sql``}
          ${options.sessionId ? sql`AND am."sessionId" = ${options.sessionId}` : sql``}
        ORDER BY am."createdAt" DESC
        LIMIT ${options.limit || 10}
      `)

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        content: row.content,
        vectorScore: 0,
        textScore: 0.5,
        combinedScore: 0.5,
        recencyBoost: 0,
        agentId: row.agentId,
        sessionId: row.sessionId,
        tags: row.tags || [],
        createdAt: new Date(row.createdAt),
      }))
    } catch (error) {
      logger.error('Text-only search also failed', { error })
      return []
    }
  }
}

// Singleton
let searchEngine: HybridSearchEngine | null = null

export function getHybridSearchEngine(): HybridSearchEngine {
  if (!searchEngine) {
    searchEngine = new HybridSearchEngine()
  }
  return searchEngine
}
