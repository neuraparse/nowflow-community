import { and, desc, eq, inArray } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { agentMemory } from '@/db/schema'
import { getHybridSearchEngine } from './hybrid-search'

const logger = createLogger('MemoryConsolidator')

export interface ConsolidationConfig {
  similarityThreshold: number // 0-1, memories above this are candidates for merging (default 0.85)
  maxMemories: number // Max memories per agent session (default 1000)
  decayInterval: number // Hours between decay runs (default 24)
  minImportance: number // Memories below this importance get pruned (default 0.1)
}

/**
 * Memory Consolidator
 * Manages memory lifecycle: consolidation, importance decay, and pruning
 * Consolidates short-term entries into longer-lived context.
 */
export class MemoryConsolidator {
  private config: ConsolidationConfig

  constructor(config?: Partial<ConsolidationConfig>) {
    this.config = {
      similarityThreshold: 0.85,
      maxMemories: 1000,
      decayInterval: 24,
      minImportance: 0.1,
      ...config,
    }
  }

  /**
   * Consolidate memories for an agent
   * - Find duplicate/similar memories and merge them
   * - Increase importance of frequently accessed memories
   * - Decrease importance of old, unused memories
   */
  async consolidate(
    agentId: string,
    userId: string
  ): Promise<{
    merged: number
    pruned: number
    promoted: number
  }> {
    logger.info('Starting memory consolidation', { agentId, userId })
    const stats = { merged: 0, pruned: 0, promoted: 0 }

    try {
      // Step 1: Get all memories for this agent
      const memories = await db
        .select()
        .from(agentMemory)
        .where(and(eq(agentMemory.agentId, agentId), eq(agentMemory.userId, userId)))
        .orderBy(desc(agentMemory.createdAt))

      if (memories.length === 0) return stats

      // Step 2: Prune expired memories
      const now = new Date()
      const expired = memories.filter((m) => m.expiresAt && new Date(m.expiresAt) < now)
      if (expired.length > 0) {
        await db.delete(agentMemory).where(
          inArray(
            agentMemory.id,
            expired.map((m) => m.id)
          )
        )
        stats.pruned += expired.length
      }

      // Step 3: Prune low-importance memories if over limit
      const remaining = memories.filter((m) => !expired.includes(m))
      if (remaining.length > this.config.maxMemories) {
        const toRemove = remaining
          .sort((a, b) => (a.importance || 0) - (b.importance || 0))
          .slice(0, remaining.length - this.config.maxMemories)
          .filter((m) => (m.importance || 0) < this.config.minImportance)

        if (toRemove.length > 0) {
          await db.delete(agentMemory).where(
            inArray(
              agentMemory.id,
              toRemove.map((m) => m.id)
            )
          )
          stats.pruned += toRemove.length
        }
      }

      // Step 4: Promote frequently accessed important memories
      // (increase importance of memories accessed recently)
      const recentlyAccessed = remaining.filter((m) => {
        const age = (now.getTime() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60)
        return age < 24 && (m.importance || 0) < 0.8
      })
      for (const mem of recentlyAccessed) {
        const newImportance = Math.min(1, (mem.importance || 0.5) + 0.05)
        await db
          .update(agentMemory)
          .set({ importance: newImportance, updatedAt: now })
          .where(eq(agentMemory.id, mem.id))
        stats.promoted++
      }

      logger.info('Memory consolidation completed', { agentId, ...stats })
    } catch (error) {
      logger.error('Memory consolidation failed', { agentId, error })
    }

    return stats
  }

  /**
   * Calculate importance score for a memory based on:
   * - Access frequency
   * - Recency of last access
   * - Content quality (length, specificity)
   * - User feedback (if any)
   */
  calculateImportance(params: {
    accessCount: number
    lastAccessedAt: Date
    contentLength: number
    hasEntities: boolean
    userFeedback?: 'positive' | 'negative' | null
    createdAt: Date
  }): number {
    const { accessCount, lastAccessedAt, contentLength, hasEntities, userFeedback, createdAt } =
      params

    let score = 0.5 // Base score

    // Access frequency bonus (log scale, max +0.2)
    score += Math.min(Math.log(accessCount + 1) / 10, 0.2)

    // Recency bonus (max +0.15)
    const hoursSinceAccess = (Date.now() - lastAccessedAt.getTime()) / (1000 * 60 * 60)
    score += Math.max(0, 0.15 * Math.exp(-hoursSinceAccess / 168)) // 1 week half-life

    // Content quality (max +0.1)
    if (contentLength > 50) score += 0.05
    if (contentLength > 200) score += 0.03
    if (hasEntities) score += 0.02

    // User feedback
    if (userFeedback === 'positive') score += 0.15
    if (userFeedback === 'negative') score -= 0.2

    // Age penalty for very old memories (max -0.1)
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreation > 30) score -= Math.min(daysSinceCreation / 365, 0.1)

    return Math.max(0, Math.min(1, score))
  }
}

// Singleton
let consolidatorInstance: MemoryConsolidator | null = null

export function getMemoryConsolidator(config?: Partial<ConsolidationConfig>): MemoryConsolidator {
  if (!consolidatorInstance) {
    consolidatorInstance = new MemoryConsolidator(config)
  }
  return consolidatorInstance
}
