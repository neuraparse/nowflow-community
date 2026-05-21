import { createLogger } from '@/lib/logs/console-logger'
import type { ExecutionContext } from '@/executor/types'
import { AgentMemoryService } from './agent-memory-service'
import { type SessionContext, SessionResolver } from './session-resolver'
import { getApiStorage } from './storage/api-storage'
import type { MemoryEntry, MemoryStorageProvider } from './types'

const logger = createLogger('MemoryHelper')

/**
 * Memory Helper Configuration
 */
export interface MemoryHelperConfig {
  /** Agent block ID */
  agentId: string

  /** Agent type */
  agentType: string

  /** Enable memory (opt-in, default: false) */
  enabled?: boolean

  /** Memory retrieval limit */
  limit?: number

  /** Importance threshold */
  minImportance?: number

  /** Memory tags */
  tags?: string[]

  /** TTL in milliseconds */
  ttl?: number
}

/**
 * Memory Helper Result
 */
export interface MemoryHelperResult {
  /** Memory service instance (null if disabled or failed) */
  service: AgentMemoryService | null

  /** Retrieved conversation history */
  history: MemoryEntry[]

  /** Session context */
  sessionContext: SessionContext | null

  /** Whether memory is enabled */
  enabled: boolean

  /** Error message if initialization failed */
  error?: string
}

/**
 * Memory Helper - Fail-Safe Wrapper for Agent Memory
 *
 * Key Features:
 * - **Fail-Safe**: Never breaks agent execution, even if memory fails
 * - **Opt-In**: Disabled by default, must be explicitly enabled
 * - **Backward Compatible**: Works with existing agents without changes
 * - **Graceful Degradation**: Falls back to no-memory mode on errors
 *
 * Usage:
 * ```typescript
 * const memory = await MemoryHelper.initialize({
 *   agentId: block.id,
 *   agentType: 'customer_service',
 *   enabled: inputs.memoryEnabled,
 * }, context, inputs)
 *
 * // Use memory (safe, won't throw)
 * const enhanced = memory.service?.buildEnhancedPrompt(prompt, memory.history) ?? prompt
 *
 * // Save after execution (safe, won't throw)
 * await MemoryHelper.saveConversation(memory, userMsg, assistantMsg, executionId)
 * ```
 */
export class MemoryHelper {
  /**
   * Initialize memory system for an agent execution
   *
   * FAIL-SAFE: Returns disabled memory on any error, never throws
   */
  static async initialize(
    config: MemoryHelperConfig,
    context: ExecutionContext,
    inputs: Record<string, any>
  ): Promise<MemoryHelperResult> {
    // Default result (disabled memory)
    const disabledResult: MemoryHelperResult = {
      service: null,
      history: [],
      sessionContext: null,
      enabled: false,
    }

    try {
      // Check if memory is explicitly enabled (opt-in)
      const enabled = config.enabled ?? inputs.memoryEnabled ?? false

      if (!enabled) {
        logger.debug('Memory disabled for agent', { agentId: config.agentId })
        return disabledResult
      }

      logger.info('Initializing memory for agent', {
        agentId: config.agentId,
        agentType: config.agentType,
      })

      // Resolve session with fallback strategy
      // Note: For deployment sessions (chat interfaces), the API route
      // should resolve the session and pass it via context.sessionId and inputs.sessionMetadata
      const sessionContext = SessionResolver.resolve({
        userId: context.userId || inputs.userId,
        sessionId: context.sessionId || inputs.sessionId,
        sessionToken: context.sessionToken || inputs.sessionToken,
        workflowId: context.workflowId,
        ttl: config.ttl,
        metadata: inputs.sessionMetadata, // Deployment session metadata (IP, fingerprint, etc.)
      })

      logger.debug('Session resolved', {
        sessionId: sessionContext.sessionId,
        userId: sessionContext.userId,
        isAnonymous: sessionContext.isAnonymous,
        source: sessionContext.source,
        hasDeploymentMetadata: !!sessionContext.metadata,
      })

      // Initialize storage
      const storage = getApiStorage()

      // Create memory service
      const service = new AgentMemoryService(
        {
          agentId: config.agentId,
          agentType: config.agentType,
          sessionId: sessionContext.sessionId,
          userId: sessionContext.userId,
          workflowId: context.workflowId,
          enabled: true,
          limit: config.limit ?? inputs.memoryLimit ?? 10,
          minImportance: config.minImportance ?? inputs.memoryImportance ?? 0.3,
          tags: config.tags ?? this.parseTags(inputs.memoryTags),
          ttl: config.ttl,
        },
        storage
      )

      // Retrieve conversation history (safe)
      let history: MemoryEntry[] = []
      try {
        const query = this.normalizeText(inputs.context ?? inputs.systemPrompt ?? '')
        const response = await service.retrieve({
          query: query.substring(0, 500), // Limit query length
          limit: config.limit ?? inputs.memoryLimit ?? 10,
        })

        if (response.success && response.memories) {
          history = response.memories
          logger.info('Retrieved conversation history', {
            count: history.length,
            sessionId: sessionContext.sessionId,
          })
        }
      } catch (error) {
        logger.error('Failed to retrieve memory history (non-fatal)', { error })
        // Continue with empty history
      }

      return {
        service,
        history,
        sessionContext,
        enabled: true,
      }
    } catch (error) {
      logger.error('Memory initialization failed (falling back to disabled)', { error })

      // Return disabled result with error
      return {
        ...disabledResult,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Save conversation turn to memory
   *
   * FAIL-SAFE: Logs errors but never throws
   */
  static async saveConversation(
    memory: MemoryHelperResult,
    userMessage: string,
    assistantMessage: string,
    executionId?: string,
    metadata?: {
      model?: string
      tokens?: any
      toolCalls?: any
      agentData?: Record<string, any>
    }
  ): Promise<boolean> {
    if (!memory.enabled || !memory.service) {
      return false
    }

    // Include session metadata (deployment context, IP, fingerprint, etc.)
    const sessionMetadata = memory.sessionContext?.metadata || {}

    try {
      const execId = executionId || this.generateExecutionId()
      const safeUserMessage = this.normalizeText(userMessage)
      const safeAssistantMessage = this.normalizeText(assistantMessage)

      // Enrich agent data with session context (deployment info, IP, fingerprint, etc.)
      const enrichedAgentData = {
        ...(metadata?.agentData || {}),
        sessionContext: sessionMetadata, // Deployment session metadata
      }

      await memory.service.saveConversation({
        userMessage: safeUserMessage,
        assistantMessage: safeAssistantMessage,
        userMetadata: {
          timestamp: new Date().toISOString(),
        },
        assistantMetadata: {
          model: metadata?.model,
          tokens: metadata?.tokens,
          toolCalls: metadata?.toolCalls,
          timestamp: new Date().toISOString(),
        },
        agentData: enrichedAgentData, // Include session metadata
        executionId: execId,
      })

      logger.info('Conversation saved to memory', {
        sessionId: memory.sessionContext?.sessionId,
        executionId: execId,
      })

      return true
    } catch (error) {
      logger.error('Failed to save conversation (non-fatal)', { error })
      return false
    }
  }

  /**
   * Build enhanced system prompt with memory context
   *
   * FAIL-SAFE: Returns original prompt on any error
   */
  static buildEnhancedPrompt(memory: MemoryHelperResult, basePrompt: string): string {
    logger.info('buildEnhancedPrompt called', {
      enabled: memory.enabled,
      hasService: !!memory.service,
      historyLength: memory.history.length,
    })

    if (!memory.enabled || !memory.service || memory.history.length === 0) {
      logger.info('Skipping memory enhancement', {
        reason: !memory.enabled ? 'memory disabled' : !memory.service ? 'no service' : 'no history',
      })
      return basePrompt
    }

    try {
      return memory.service.buildEnhancedPrompt(basePrompt, memory.history)
    } catch (error) {
      logger.error('Failed to build enhanced prompt (using base prompt)', { error })
      return basePrompt
    }
  }

  /**
   * Format memory history as OpenAI-compatible messages array
   * This is more effective than embedding history in system prompt
   *
   * FAIL-SAFE: Returns empty array on any error
   */
  static formatForMessages(
    memory: MemoryHelperResult
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    logger.info('formatForMessages called', {
      enabled: memory.enabled,
      hasService: !!memory.service,
      historyLength: memory.history.length,
    })

    if (!memory.enabled || !memory.service || memory.history.length === 0) {
      logger.info('Skipping messages formatting', {
        reason: !memory.enabled ? 'memory disabled' : !memory.service ? 'no service' : 'no history',
      })
      return []
    }

    try {
      return memory.service.formatForMessages(memory.history)
    } catch (error) {
      logger.error('Failed to format messages (returning empty array)', { error })
      return []
    }
  }

  /**
   * Get memory statistics
   */
  static async getStats(memory: MemoryHelperResult): Promise<{
    enabled: boolean
    historyCount: number
    totalCount: number
    hasMemories: boolean
  }> {
    if (!memory.enabled || !memory.service) {
      return {
        enabled: false,
        historyCount: 0,
        totalCount: 0,
        hasMemories: false,
      }
    }

    try {
      const totalCount = await memory.service.count()
      return {
        enabled: true,
        historyCount: memory.history.length,
        totalCount,
        hasMemories: totalCount > 0,
      }
    } catch (error) {
      logger.error('Failed to get memory stats', { error })
      return {
        enabled: true,
        historyCount: memory.history.length,
        totalCount: 0,
        hasMemories: false,
      }
    }
  }

  /**
   * Clear session memory (GDPR compliance)
   *
   * FAIL-SAFE: Logs errors but never throws
   */
  static async clearSession(memory: MemoryHelperResult): Promise<number> {
    if (!memory.enabled || !memory.service) {
      return 0
    }

    try {
      return await memory.service.clearSession()
    } catch (error) {
      logger.error('Failed to clear session', { error })
      return 0
    }
  }

  /**
   * Parse tags from string input
   */
  private static parseTags(tagsInput?: string): string[] {
    if (!tagsInput || typeof tagsInput !== 'string') {
      return []
    }

    return tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  }

  private static normalizeText(value: unknown): string {
    if (value === undefined || value === null) {
      return ''
    }

    if (typeof value === 'string') {
      return value
    }

    try {
      return JSON.stringify(value, null, 2)
    } catch (error) {
      return String(value)
    }
  }

  private static generateExecutionId(): string {
    if (typeof globalThis !== 'undefined') {
      const cryptoObj = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
      if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID()
      }
    }

    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  /**
   * Check if memory is available and healthy
   */
  static async healthCheck(): Promise<{
    available: boolean
    error?: string
  }> {
    try {
      const storage = getApiStorage()
      // Try to count memories (lightweight operation)
      await storage.count('health-check-session')
      return { available: true }
    } catch (error) {
      logger.error('Memory health check failed', { error })
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Format memory statistics for block output
   */
  static formatStatsForOutput(
    memory: MemoryHelperResult,
    stats?: {
      enabled: boolean
      historyCount: number
      totalCount: number
      hasMemories: boolean
    }
  ): Record<string, any> {
    return {
      memoryEnabled: memory.enabled,
      memoryHistoryUsed: memory.history.length,
      memoryTotalCount: stats?.totalCount ?? 0,
      memorySessionId: memory.sessionContext?.sessionId,
      memoryIsAnonymous: memory.sessionContext?.isAnonymous ?? true,
      memoryError: memory.error,
    }
  }
}
