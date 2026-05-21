/**
 * This file defines model capabilities and constraints.
 * It serves as a single source of truth for model-specific features.
 *
 * Temperature support research (March 2026):
 *
 * NO TEMPERATURE SUPPORT (reasoning models):
 *   - OpenAI: o1, o1-mini, o1-preview, o3, o3-mini, o4-mini — error if temperature != 1
 *   - OpenAI: gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.2, gpt-5.4 — error if temperature != 1
 *   - DeepSeek: deepseek-reasoner — silently ignored, has no effect
 *
 * TEMPERATURE 0-2:
 *   - OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini
 *   - Google Gemini: all models (recommended to keep at 1.0 for Gemini 3)
 *   - xAI Grok: all models
 *   - Groq: all models
 *   - DeepSeek: deepseek-chat
 *   - Cerebras: all models
 *
 * TEMPERATURE 0-1:
 *   - Anthropic Claude: all models
 */

// OpenAI Reasoning models - NO temperature support, use max_completion_tokens, developer role
export const OPENAI_REASONING_MODELS = [
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o3-pro',
  'o4-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.2',
  'gpt-5.4',
]

export function isOpenAIReasoningModel(model: string): boolean {
  const n = model.toLowerCase()
  return OPENAI_REASONING_MODELS.some((rm) => n === rm || n.startsWith(rm + '-'))
}

// Models that DO NOT support temperature at all (reasoning/thinking models)
export const MODELS_NO_TEMPERATURE = [
  // OpenAI reasoning models — API returns error if temperature != 1
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o3-pro',
  'o4-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.2',
  'gpt-5.4',
  // DeepSeek reasoning model — parameter is silently ignored
  'deepseek-reasoner',
]

// Models that support temperature with range 0-2
export const MODELS_TEMP_RANGE_0_2 = [
  // OpenAI standard models (non-reasoning)
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  // xAI Grok models (OpenAI-compatible, 0-2 range)
  'grok-4-latest',
  'grok-3',
  'grok-3-mini',
  // Google Gemini models (all support 0-2, recommended default 1.0 for Gemini 3)
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  // DeepSeek chat model (not reasoning)
  'deepseek-chat',
  // Groq-hosted models (all support 0-2)
  'llama-4-scout-17b-16e-instruct',
  'llama-4-maverick-17b-128e-instruct',
  'llama-3.3-70b-versatile',
  'qwen-qwq-32b',
  'deepseek-r1-distill-llama-70b',
  // Cerebras models
  'cerebras/llama-3.3-70b',
]

// Models that support temperature with range 0-1
export const MODELS_TEMP_RANGE_0_1 = [
  // Anthropic Claude models (all support 0-1)
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-opus-4-5-20251101',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
]

// All models that support temperature (combined list)
export const MODELS_WITH_TEMPERATURE_SUPPORT = [...MODELS_TEMP_RANGE_0_2, ...MODELS_TEMP_RANGE_0_1]

// Models and their providers that support tool usage control (force, auto, none)
export const PROVIDERS_WITH_TOOL_USAGE_CONTROL = ['openai', 'anthropic', 'deepseek', 'xai']

/**
 * Check if a model supports temperature parameter
 */
export function supportsTemperature(model: string): boolean {
  const normalizedModel = model.toLowerCase()

  // Explicitly check no-temperature list first
  if (MODELS_NO_TEMPERATURE.some((m) => m.toLowerCase() === normalizedModel)) {
    return false
  }

  // Check if model is in the supported list
  if (
    MODELS_WITH_TEMPERATURE_SUPPORT.some(
      (supportedModel) => supportedModel.toLowerCase() === normalizedModel
    )
  ) {
    return true
  }

  // Unknown models (e.g. Ollama local) — assume temperature support
  return true
}

/**
 * Get the maximum temperature value for a model
 * @returns Maximum temperature value (1 or 2) or undefined if temperature not supported
 */
export function getMaxTemperature(model: string): number | undefined {
  const normalizedModel = model.toLowerCase()

  // No temperature support for reasoning models
  if (MODELS_NO_TEMPERATURE.some((m) => m.toLowerCase() === normalizedModel)) {
    return undefined
  }

  // Check if model is in the 0-2 range
  if (MODELS_TEMP_RANGE_0_2.some((m) => m.toLowerCase() === normalizedModel)) {
    return 2
  }

  // Check if model is in the 0-1 range
  if (MODELS_TEMP_RANGE_0_1.some((m) => m.toLowerCase() === normalizedModel)) {
    return 1
  }

  // Unknown models (e.g. Ollama) — default to 0-1 range
  return 1
}

/**
 * Check if a provider supports tool usage control
 */
export function supportsToolUsageControl(provider: string): boolean {
  return PROVIDERS_WITH_TOOL_USAGE_CONTROL.includes(provider)
}
