import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { agentMemory } from '@/db/schema'
import type { MemoryEntry, MemoryQuery, MemoryStorageProvider } from '../types'

const logger = createLogger('PostgresMemoryStorage')

/**
 * PostgreSQL Memory Storage Provider
 *
 * Implements persistent memory storage using PostgreSQL with Drizzle ORM.
 *
 * Features:
 * - Session-based isolation for multi-user support
 * - Efficient querying with proper indexes
 * - Automatic cleanup of expired memories
 * - Transaction support for batch operations
 * - Type-safe queries with Drizzle ORM
 */
export class PostgresMemoryStorage implements MemoryStorageProvider {
  /**
   * Save a single memory entry
   */
  async save(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const result = await db
        .insert(agentMemory)
        .values({
          sessionId: entry.sessionId,
          userId: entry.userId,
          agentId: entry.agentId,
          agentType: entry.agentType,
          workflowId: entry.context.workflowId,
          blockId: entry.context.blockId,
          executionId: entry.context.executionId,
          content: entry.content,
          agentData: entry.agentData,
          tags: entry.tags,
          importance: entry.importance ?? 0.5,
          expiresAt: entry.expiresAt,
        })
        .returning({ id: agentMemory.id })

      const id = result[0].id

      logger.debug('Memory saved', {
        id,
        sessionId: entry.sessionId,
        agentType: entry.agentType,
      })

      return id
    } catch (error: any) {
      logger.error('Failed to save memory', {
        error: error?.message || error,
        stack: error?.stack,
        sessionId: entry.sessionId,
        agentId: entry.agentId,
      })
      throw error
    }
  }

  /**
   * Save multiple memory entries in a transaction
   */
  async saveBatch(
    entries: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    if (entries.length === 0) {
      return []
    }

    try {
      const values = entries.map((entry) => ({
        sessionId: entry.sessionId,
        userId: entry.userId,
        agentId: entry.agentId,
        agentType: entry.agentType,
        workflowId: entry.context.workflowId,
        blockId: entry.context.blockId,
        executionId: entry.context.executionId,
        content: entry.content,
        agentData: entry.agentData,
        tags: entry.tags,
        importance: entry.importance ?? 0.5,
        expiresAt: entry.expiresAt,
      }))

      const result = await db.insert(agentMemory).values(values).returning({ id: agentMemory.id })

      const ids = result.map((r: { id: string }) => r.id)

      logger.debug('Batch memories saved', { count: ids.length })

      return ids
    } catch (error) {
      logger.error('Failed to save batch memories', { error })
      throw error
    }
  }

  /**
   * Get memory by ID (with session isolation check)
   */
  async get(id: string, sessionId: string): Promise<MemoryEntry | null> {
    try {
      const result = await db
        .select()
        .from(agentMemory)
        .where(and(eq(agentMemory.id, id), eq(agentMemory.sessionId, sessionId)))
        .limit(1)

      if (result.length === 0) {
        return null
      }

      return this.mapToMemoryEntry(result[0])
    } catch (error) {
      logger.error('Failed to get memory', { error, id, sessionId })
      throw error
    }
  }

  /**
   * Query memories with filters
   */
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    try {
      const conditions = [eq(agentMemory.sessionId, query.sessionId)]

      // Filter by user ID
      if (query.userId) {
        conditions.push(eq(agentMemory.userId, query.userId))
      }

      // Filter by agent ID
      if (query.agentId) {
        conditions.push(eq(agentMemory.agentId, query.agentId))
      }

      // Filter by agent type
      if (query.agentType) {
        conditions.push(eq(agentMemory.agentType, query.agentType))
      }

      // Filter by importance
      if (query.minImportance !== undefined) {
        conditions.push(gte(agentMemory.importance, query.minImportance))
      }

      // Filter by date range
      if (query.startDate) {
        conditions.push(gte(agentMemory.createdAt, query.startDate))
      }

      if (query.endDate) {
        conditions.push(lte(agentMemory.createdAt, query.endDate))
      }

      // Filter by expiration
      if (!query.includeExpired) {
        // Only include non-expired or null expiry
        conditions.push(sql`${agentMemory.expiresAt} IS NULL OR ${agentMemory.expiresAt} > NOW()`)
      }

      // Filter by tags (all tags must be present - AND condition)
      if (query.tags && query.tags.length > 0) {
        // Check if array contains all tags
        const tagParams = query.tags.map((tag) => sql`${tag}`)
        conditions.push(sql`${agentMemory.tags} @> ARRAY[${sql.join(tagParams, sql`, `)}]::text[]`)
      }

      // Execute query
      const result = await db
        .select()
        .from(agentMemory)
        .where(and(...conditions))
        .orderBy(desc(agentMemory.createdAt))
        .limit(query.limit ?? 10)

      return result.map((row: typeof agentMemory.$inferSelect) => this.mapToMemoryEntry(row))
    } catch (error) {
      logger.error('Failed to query memories', { error, query })
      throw error
    }
  }

  /**
   * Semantic search (placeholder - requires pgvector extension)
   * When pgvector is installed, this will perform vector similarity search
   */
  async searchSemantic(query: string, sessionId: string, limit: number): Promise<MemoryEntry[]> {
    try {
      const { getHybridSearchEngine } = await import('../hybrid-search')
      const hybridEngine = getHybridSearchEngine()
      const hybridResults = await hybridEngine.search({
        query,
        sessionId,
        limit,
        minScore: 0.1,
      })

      if (hybridResults.length > 0) {
        logger.debug('Semantic search via hybrid engine', {
          query: query.slice(0, 50),
          results: hybridResults.length,
        })
        return hybridResults.map((hr) => this.mapHybridToMemoryEntry(hr))
      }

      // Fallback to ILIKE if hybrid returns no results
      logger.debug('Hybrid search returned no results, falling back to keyword search')
      const result = await db
        .select()
        .from(agentMemory)
        .where(
          and(
            eq(agentMemory.sessionId, sessionId),
            sql`${agentMemory.content}->>'message' ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
        .limit(limit)

      return result.map((row: typeof agentMemory.$inferSelect) => this.mapToMemoryEntry(row))
    } catch (error) {
      logger.error('Semantic search failed, falling back to keyword search', { error })

      // Fallback: Search in content.message using ILIKE
      try {
        const result = await db
          .select()
          .from(agentMemory)
          .where(
            and(
              eq(agentMemory.sessionId, sessionId),
              sql`${agentMemory.content}->>'message' ILIKE ${`%${query}%`}`
            )
          )
          .orderBy(desc(agentMemory.importance), desc(agentMemory.createdAt))
          .limit(limit)

        return result.map((row: typeof agentMemory.$inferSelect) => this.mapToMemoryEntry(row))
      } catch (fallbackError) {
        logger.error('Semantic search fallback also failed', { error: fallbackError })
        return []
      }
    }
  }

  /**
   * Update memory entry
   */
  async update(id: string, sessionId: string, updates: Partial<MemoryEntry>): Promise<void> {
    try {
      const updateData: Record<string, any> = {}

      if (updates.content) updateData.content = updates.content
      if (updates.agentData) updateData.agentData = updates.agentData
      if (updates.tags) updateData.tags = updates.tags
      if (updates.importance !== undefined) updateData.importance = updates.importance
      if (updates.expiresAt !== undefined) updateData.expiresAt = updates.expiresAt

      updateData.updatedAt = new Date()

      await db
        .update(agentMemory)
        .set(updateData)
        .where(and(eq(agentMemory.id, id), eq(agentMemory.sessionId, sessionId)))

      logger.debug('Memory updated', { id, sessionId })
    } catch (error) {
      logger.error('Failed to update memory', { error, id })
      throw error
    }
  }

  /**
   * Delete memory by ID (with session isolation)
   */
  async delete(id: string, sessionId: string): Promise<void> {
    try {
      await db
        .delete(agentMemory)
        .where(and(eq(agentMemory.id, id), eq(agentMemory.sessionId, sessionId)))

      logger.debug('Memory deleted', { id, sessionId })
    } catch (error) {
      logger.error('Failed to delete memory', { error, id })
      throw error
    }
  }

  /**
   * Delete all memories for a session (GDPR compliance)
   */
  async deleteSession(sessionId: string): Promise<number> {
    try {
      const result = await db
        .delete(agentMemory)
        .where(eq(agentMemory.sessionId, sessionId))
        .returning({ id: agentMemory.id })

      const count = result.length

      logger.info('Session memories deleted', { sessionId, count })

      return count
    } catch (error) {
      logger.error('Failed to delete session memories', { error, sessionId })
      throw error
    }
  }

  /**
   * Delete expired memories (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    try {
      const result = await db
        .delete(agentMemory)
        .where(
          and(sql`${agentMemory.expiresAt} IS NOT NULL`, lt(agentMemory.expiresAt, new Date()))
        )
        .returning({ id: agentMemory.id })

      const count = result.length

      if (count > 0) {
        logger.info('Expired memories deleted', { count })
      }

      return count
    } catch (error) {
      logger.error('Failed to delete expired memories', { error })
      throw error
    }
  }

  /**
   * Get memory count for session
   */
  async count(sessionId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(agentMemory)
        .where(eq(agentMemory.sessionId, sessionId))

      return Number(result[0].count)
    } catch (error) {
      logger.error('Failed to count memories', { error, sessionId })
      return 0
    }
  }

  /**
   * Map HybridSearchResult to MemoryEntry type
   */
  private mapHybridToMemoryEntry(hr: any): MemoryEntry {
    return {
      id: hr.id,
      sessionId: hr.sessionId,
      agentId: hr.agentId,
      agentType: '',
      context: { workflowId: '', blockId: hr.agentId, executionId: '' },
      content: hr.content as {
        role: 'user' | 'assistant' | 'system'
        message: string
        metadata?: Record<string, any>
      },
      tags: hr.tags,
      importance: hr.combinedScore,
      createdAt: hr.createdAt,
      updatedAt: hr.createdAt,
    }
  }

  /**
   * Map database row to MemoryEntry type
   */
  private mapToMemoryEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      agentId: row.agentId,
      agentType: row.agentType,
      context: {
        workflowId: row.workflowId,
        blockId: row.blockId,
        executionId: row.executionId,
      },
      content: row.content as {
        role: 'user' | 'assistant' | 'system'
        message: string
        metadata?: Record<string, any>
      },
      agentData: row.agentData,
      tags: row.tags,
      importance: row.importance,
      embedding: undefined, // Not implemented yet
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
    }
  }
}

/**
 * Create a PostgreSQL memory storage instance
 * Singleton pattern for efficiency
 */
let postgresStorageInstance: PostgresMemoryStorage | null = null

export function getPostgresStorage(): PostgresMemoryStorage {
  if (!postgresStorageInstance) {
    postgresStorageInstance = new PostgresMemoryStorage()
  }
  return postgresStorageInstance
}
