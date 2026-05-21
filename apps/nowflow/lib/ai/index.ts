/**
 * Barrel export for the AI provider stack.
 *
 * Consolidates the public surface of `lib/ai/` so callers can import provider
 * service, model router, credit manager, encryption helpers, and lightweight
 * analysis utilities from a single entry point. Existing nested-path imports
 * keep working unchanged.
 */

// Core provider service (resolved config, call/stream, encryption pass-through).
export {
  callAIProvider,
  callAIProviderStreaming,
  decryptApiKey,
  encryptApiKey,
  getResolvedAIConfig,
  invalidateAIConfigCache,
} from './provider-service'
export type { AIProviderCallParams, ResolvedAIConfig } from './provider-service'

// Provider configuration (default model, env var detection, OpenAI-compatible URL).
export { getDefaultModel, getEnvVarConfig, getOpenAICompatibleUrl } from './provider-config'

// Streaming helpers (OpenAI-compatible / Anthropic / Google / Ollama).
export {
  buildAnthropicRequestBody,
  streamAnthropic,
  streamGoogle,
  streamOllama,
  streamOpenAICompatible,
} from './provider-streaming'
export type { AnthropicCacheHint, StreamAnthropicOptions } from './provider-streaming'

// Provider types (input/output shapes shared between callers + helpers).
export type {
  AIAction,
  AIProviderResult,
  AnthropicContentBlock,
  OpenAIFunctionTool,
  OpenAIToolCall,
} from './provider-types'

// Model router + registry (tier-based routing for brain/muscle/micro models).
export { ModelRouter, getModelRouter } from './model-router'
export type { ModelInfo, ModelTier, RoutingDecision, TaskAnalysis, TaskType } from './model-router'
export { ModelRegistry } from './model-registry'

// Credit accounting.
export {
  addCredits,
  deductCredits,
  getCreditHistory,
  getOrCreateAccount,
  hasCredits,
} from './credit-manager'
export type { CreditBalance } from './credit-manager'

// Per-user request rate-limit / quota guards.
export { AIRequestLimitError, enforceAIRequestAccess } from './request-guards'

// Sentiment analysis (lightweight, no external API call).
export {
  analyzeConversationSentiment,
  analyzeSentiment,
  summarizeConversation,
} from './sentiment-analyzer'
export type { ConversationSummary, EmotionScore, SentimentResult } from './sentiment-analyzer'
