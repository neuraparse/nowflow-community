/**
 * Agent Memory System
 *
 * Scoped memory management for multi-user AI agents.
 *
 * @example
 * ```typescript
 * import { MemoryHelper } from '@/lib/memory'
 *
 * // Initialize memory (fail-safe, opt-in)
 * const memory = await MemoryHelper.initialize({
 *   agentId: block.id,
 *   agentType: 'customer_service',
 *   enabled: inputs.memoryEnabled,
 * }, context, inputs)
 *
 * // Build enhanced prompt with history
 * const enhanced = MemoryHelper.buildEnhancedPrompt(memory, systemPrompt)
 *
 * // Save conversation after execution
 * await MemoryHelper.saveConversation(
 *   memory,
 *   userMessage,
 *   assistantResponse,
 *   executionId
 * )
 * ```
 */

// Main helper (recommended for most use cases)
export { MemoryHelper } from './memory-helper'
export type { MemoryHelperConfig, MemoryHelperResult } from './memory-helper'

// Core service (advanced use cases)
export { AgentMemoryService } from './agent-memory-service'

// Session management
export { SessionResolver } from './session-resolver'
export type { SessionContext, SessionResolverInput } from './session-resolver'

// Storage providers (API-backed is safe for client usage)
export { ApiMemoryStorage, getApiStorage } from './storage/api-storage'

// Types
export type {
  MemoryEntry,
  MemoryQuery,
  MemoryConfig,
  MemoryResponse,
  MemoryStorageProvider,
} from './types'

/**
 * Quick Start Guide
 *
 * 1. Enable memory in agent block configuration:
 *    - Add toggle: memoryEnabled
 *    - Add slider: memoryLimit (default: 10)
 *    - Add slider: memoryImportance (default: 0.3)
 *    - Add text: memoryTags (optional)
 *
 * 2. In agent handler, initialize memory:
 *    ```typescript
 *    const memory = await MemoryHelper.initialize({
 *      agentId: block.id,
 *      agentType: block.metadata?.id || 'agent',
 *      enabled: inputs.memoryEnabled,
 *    }, context, inputs)
 *    ```
 *
 * 3. Enhance system prompt with memory:
 *    ```typescript
 *    const enhanced = MemoryHelper.buildEnhancedPrompt(
 *      memory,
 *      inputs.systemPrompt
 *    )
 *    ```
 *
 * 4. Save conversation after execution:
 *    ```typescript
 *    await MemoryHelper.saveConversation(
 *      memory,
 *      inputs.context,
 *      result.content,
 *      context.executionId
 *    )
 *    ```
 *
 * 5. Include memory stats in output:
 *    ```typescript
 *    return {
 *      response: {
 *        ...result,
 *        ...MemoryHelper.formatStatsForOutput(memory),
 *      }
 *    }
 *    ```
 */
