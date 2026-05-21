import { createLogger } from '@/lib/logs/console-logger'
import type {
  MemoryConfig,
  MemoryEntry,
  MemoryQuery,
  MemoryResponse,
  MemoryStorageProvider,
} from './types'

const logger = createLogger('AgentMemoryService')

/**
 * Agent Memory Service
 *
 * Agent memory management with isolated sessions and durable storage.
 *
 * Features:
 * - User/session isolation for multi-user scenarios
 * - Anonymous user support with secure session IDs
 * - Backward compatible (opt-in via configuration)
 * - Multiple storage backends (PostgreSQL, Redis, etc.)
 * - Semantic search support (optional)
 */
export class AgentMemoryService {
  private config: Required<MemoryConfig>
  private storage: MemoryStorageProvider

  constructor(config: MemoryConfig, storage: MemoryStorageProvider) {
    // Set defaults
    this.config = {
      enabled: true,
      limit: 10,
      minImportance: 0.3,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      semanticSearch: false,
      tags: [],
      userId: config.userId || '', // Default to empty string if not provided
      ...config,
    }

    this.storage = storage

    logger.info('AgentMemoryService initialized', {
      agentId: this.config.agentId,
      agentType: this.config.agentType,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      enabled: this.config.enabled,
    })
  }

  /**
   * Save a memory entry
   * Records user or assistant messages with context
   */
  async save(params: {
    role: 'user' | 'assistant' | 'system'
    message: string
    metadata?: Record<string, any>
    agentData?: Record<string, any>
    tags?: string[]
    importance?: number
    executionId: string
  }): Promise<string | null> {
    if (!this.config.enabled) {
      logger.debug('Memory disabled, skipping save')
      return null
    }

    try {
      const entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        agentId: this.config.agentId,
        agentType: this.config.agentType,
        context: {
          workflowId: this.config.workflowId,
          blockId: this.config.agentId, // Block ID = Agent ID in this context
          executionId: params.executionId,
        },
        content: {
          role: params.role,
          message: params.message,
          metadata: params.metadata,
        },
        agentData: params.agentData,
        tags: [...(this.config.tags || []), ...(params.tags || [])],
        importance: params.importance ?? 0.5,
        expiresAt: this.config.ttl ? new Date(Date.now() + this.config.ttl) : undefined,
      }

      const id = await this.storage.save(entry)

      logger.info('Memory saved', {
        id,
        sessionId: this.config.sessionId,
        role: params.role,
        messageLength: params.message.length,
      })

      return id
    } catch (error) {
      logger.error('Failed to save memory', { error })
      throw error
    }
  }

  /**
   * Save a conversation turn (user + assistant messages)
   */
  async saveConversation(params: {
    userMessage: string
    assistantMessage: string
    userMetadata?: Record<string, any>
    assistantMetadata?: Record<string, any>
    agentData?: Record<string, any>
    executionId: string
  }): Promise<{ userMemoryId: string | null; assistantMemoryId: string | null }> {
    if (!this.config.enabled) {
      return { userMemoryId: null, assistantMemoryId: null }
    }

    try {
      const userMemoryId = await this.save({
        role: 'user',
        message: params.userMessage,
        metadata: params.userMetadata,
        executionId: params.executionId,
      })

      const assistantMemoryId = await this.save({
        role: 'assistant',
        message: params.assistantMessage,
        metadata: params.assistantMetadata,
        agentData: params.agentData,
        executionId: params.executionId,
      })

      return { userMemoryId, assistantMemoryId }
    } catch (error) {
      logger.error('Failed to save conversation', { error })
      throw error
    }
  }

  /**
   * Retrieve relevant memories
   * Uses query if semantic search enabled, otherwise gets recent memories
   */
  async retrieve(params?: {
    query?: string
    limit?: number
    minImportance?: number
    tags?: string[]
    startDate?: Date
    endDate?: Date
  }): Promise<MemoryResponse> {
    if (!this.config.enabled) {
      return { success: true, memories: [], count: 0 }
    }

    try {
      const limit = params?.limit ?? this.config.limit
      const minImportance = params?.minImportance ?? this.config.minImportance

      // Semantic search if enabled and query provided
      if (this.config.semanticSearch && params?.query && this.storage.searchSemantic) {
        logger.debug('Using semantic search', { query: params.query, limit })

        const memories = await this.storage.searchSemantic(
          params.query,
          this.config.sessionId,
          limit
        )

        // Filter by importance
        const filtered = memories.filter((m) => (m.importance ?? 0) >= minImportance)

        return {
          success: true,
          memories: filtered,
          count: filtered.length,
        }
      }

      // Standard query
      const query: MemoryQuery = {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        agentId: this.config.agentId,
        agentType: this.config.agentType,
        limit,
        minImportance,
        tags: params?.tags,
        startDate: params?.startDate,
        endDate: params?.endDate,
        includeExpired: false,
      }

      let memories = await this.storage.query(query)

      logger.debug('Retrieved memories', {
        count: memories.length,
        sessionId: this.config.sessionId,
      })

      // After regular query results, enhance with hybrid search if enabled
      if (this.config.semanticSearch && params?.query && params.query.length > 0) {
        try {
          const { getHybridSearchEngine } = await import('./hybrid-search')
          const hybridEngine = getHybridSearchEngine()
          const hybridResults = await hybridEngine.search({
            query: params.query,
            sessionId: this.config.sessionId,
            agentId: this.config.agentId,
            userId: this.config.userId,
            limit,
            minScore: minImportance,
          })

          if (hybridResults.length > 0) {
            // Merge hybrid results with regular results, preferring hybrid scores
            const existingIds = new Set(memories.map((m) => m.id))
            const hybridAsMemories: MemoryEntry[] = hybridResults
              .filter((hr) => !existingIds.has(hr.id))
              .map((hr) => ({
                id: hr.id,
                sessionId: hr.sessionId,
                agentId: hr.agentId,
                agentType: this.config.agentType,
                context: {
                  workflowId: this.config.workflowId,
                  blockId: hr.agentId,
                  executionId: '',
                },
                content: hr.content,
                tags: hr.tags,
                importance: hr.combinedScore,
                createdAt: hr.createdAt,
                updatedAt: hr.createdAt,
              }))

            // Combine and sort: hybrid results first (higher relevance), then standard
            memories = [...hybridAsMemories, ...memories].slice(0, limit)

            logger.debug('Enhanced with hybrid search', {
              hybridCount: hybridResults.length,
              mergedCount: memories.length,
            })
          }
        } catch (hybridError) {
          logger.debug('Hybrid search unavailable, using standard results', { error: hybridError })
        }
      }

      return {
        success: true,
        memories,
        count: memories.length,
      }
    } catch (error) {
      logger.error('Failed to retrieve memories', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Search memories semantically (requires embeddings)
   */
  async searchSemantic(query: string, limit?: number): Promise<MemoryResponse> {
    if (!this.config.enabled) {
      return { success: true, memories: [], count: 0 }
    }

    if (!this.storage.searchSemantic) {
      return {
        success: false,
        error: 'Semantic search not supported by storage provider',
      }
    }

    try {
      const memories = await this.storage.searchSemantic(
        query,
        this.config.sessionId,
        limit ?? this.config.limit
      )

      return {
        success: true,
        memories,
        count: memories.length,
      }
    } catch (error) {
      logger.error('Semantic search failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get recent conversation history
   * Returns last N messages ordered by time
   */
  async getRecentHistory(limit?: number): Promise<MemoryResponse> {
    return this.retrieve({
      limit: limit ?? this.config.limit,
      minImportance: 0, // Include all messages
    })
  }

  /**
   * Format memories as conversation history for LLM context
   * Returns formatted string ready for system prompt injection
   */
  formatForContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) {
      return ''
    }

    let context = '\n\n# Previous Conversation History\n\n'

    // Group by conversation turns
    for (const memory of memories) {
      // Safe date formatting - handle non-Date values gracefully
      const timestamp = this.safeFormatDate(memory.createdAt)
      const role = memory.content?.role ?? 'unknown'
      const message = memory.content?.message ?? ''

      context += `[${timestamp}] ${role}: ${message}\n`

      // Add agent-specific data if available
      if (memory.agentData && Object.keys(memory.agentData).length > 0) {
        context += `  Context: ${JSON.stringify(memory.agentData, null, 2)}\n`
      }
    }

    return context
  }

  /**
   * Safely format a date value to ISO string
   * Returns fallback string if value is not a valid Date
   */
  private safeFormatDate(value: any): string {
    if (!value) return 'unknown'
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString()
    }
    // Try to parse if it's a string
    if (typeof value === 'string') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
    return 'unknown'
  }

  /**
   * Build enhanced system prompt with memory context
   * Formats memories according to agent type
   */
  buildEnhancedPrompt(basePrompt: string, memories: MemoryEntry[]): string {
    if (memories.length === 0) {
      logger.debug('No memories to add to prompt')
      return basePrompt
    }

    const memoryContext = this.formatForContext(memories)
    logger.info('Enhanced prompt with memory context', {
      memoriesCount: memories.length,
      memoryContextLength: memoryContext.length,
      basePromptLength: basePrompt.length,
      enhancedPromptLength: (basePrompt + memoryContext).length,
    })
    return basePrompt + memoryContext
  }

  /**
   * Format memories as OpenAI-compatible messages array
   * Returns array of {role, content} objects for direct use in API calls
   * This is more effective than embedding history in system prompt
   */
  formatForMessages(
    memories: MemoryEntry[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (memories.length === 0) {
      return []
    }

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const memory of memories) {
      const role = memory.content?.role
      const message = memory.content?.message

      // Only include user and assistant messages (skip system messages)
      if (role === 'user' || role === 'assistant') {
        if (message && message.trim().length > 0) {
          messages.push({
            role: role as 'user' | 'assistant',
            content: message,
          })
        }
      }
    }

    logger.info('Formatted memories as messages', {
      memoriesCount: memories.length,
      messagesCount: messages.length,
    })

    return messages
  }

  /**
   * Delete all memories for this session
   * Used for GDPR compliance and session cleanup
   */
  async clearSession(): Promise<number> {
    if (!this.config.enabled) {
      return 0
    }

    try {
      const count = await this.storage.deleteSession(this.config.sessionId)
      logger.info('Session memories cleared', { sessionId: this.config.sessionId, count })
      return count
    } catch (error) {
      logger.error('Failed to clear session', { error })
      throw error
    }
  }

  /**
   * Get memory count for current session
   */
  async count(): Promise<number> {
    if (!this.config.enabled) {
      return 0
    }

    try {
      return await this.storage.count(this.config.sessionId)
    } catch (error) {
      logger.error('Failed to count memories', { error })
      return 0
    }
  }

  /**
   * Check if session has any memories
   */
  async hasMemories(): Promise<boolean> {
    const count = await this.count()
    return count > 0
  }

  /**
   * Calculate importance score for a message
   * Higher score = more important to remember
   */
  static calculateImportance(params: {
    messageLength: number
    hasToolCalls?: boolean
    hasError?: boolean
    containsKeywords?: string[]
  }): number {
    let score = 0.5 // Base score

    // Longer messages are more important
    if (params.messageLength > 500) score += 0.2
    else if (params.messageLength > 200) score += 0.1

    // Tool calls indicate important interactions
    if (params.hasToolCalls) score += 0.2

    // Errors are important to remember
    if (params.hasError) score += 0.1

    // Keywords boost importance
    if (params.containsKeywords && params.containsKeywords.length > 0) {
      score += Math.min(params.containsKeywords.length * 0.05, 0.2)
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score))
  }

  /**
   * Extract tags from message content
   * Simple keyword-based extraction
   */
  static extractTags(message: string): string[] {
    const tags: string[] = []

    const keywords = {
      support: /support|help|issue|problem|bug|error/i,
      billing: /billing|payment|invoice|charge|subscription/i,
      technical: /technical|api|code|integration|debug/i,
      sales: /price|pricing|plan|upgrade|purchase|buy/i,
      feedback: /feedback|suggestion|feature|request|improve/i,
    }

    for (const [tag, regex] of Object.entries(keywords)) {
      if (regex.test(message)) {
        tags.push(tag)
      }
    }

    return tags
  }
}
