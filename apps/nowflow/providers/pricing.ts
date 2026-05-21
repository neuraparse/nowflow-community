import { ModelPricingMap } from './types'

/**
 * Model pricing information per million tokens
 *
 * Prices are in USD per 1M tokens
 * All prices should be regularly updated to reflect current market rates
 */
const modelPricing: ModelPricingMap = {
  // OpenAI Models (March 2026)
  'gpt-5': {
    input: 1.25,
    cachedInput: 0.31,
    output: 10.0,
    updatedAt: '2026-03-06',
  },
  'gpt-5-mini': {
    input: 0.25,
    cachedInput: 0.06,
    output: 2.0,
    updatedAt: '2026-03-06',
  },
  'gpt-5-nano': {
    input: 0.1,
    cachedInput: 0.025,
    output: 0.4,
    updatedAt: '2026-03-06',
  },
  'gpt-5.2': {
    input: 1.75,
    cachedInput: 0.175,
    output: 14.0,
    updatedAt: '2026-03-06',
  },
  'gpt-5.4': {
    input: 2.5,
    cachedInput: 0.625,
    output: 15.0,
    updatedAt: '2026-03-06',
  },
  'gpt-4o': {
    input: 2.5,
    cachedInput: 1.25,
    output: 10.0,
    updatedAt: '2025-12-09',
  },
  'gpt-4o-mini': {
    input: 0.15,
    cachedInput: 0.075,
    output: 0.6,
    updatedAt: '2025-12-09',
  },
  'gpt-4.1': {
    input: 2.0,
    cachedInput: 0.5,
    output: 8.0,
    updatedAt: '2026-03-06',
  },
  'gpt-4.1-mini': {
    input: 0.4,
    cachedInput: 0.1,
    output: 1.6,
    updatedAt: '2026-03-06',
  },
  o3: {
    input: 2.0,
    cachedInput: 0.5,
    output: 8.0,
    updatedAt: '2026-03-06',
  },
  'o3-mini': {
    input: 1.1,
    cachedInput: 0.28,
    output: 4.4,
    updatedAt: '2026-03-06',
  },
  'o4-mini': {
    input: 1.1,
    cachedInput: 0.28,
    output: 4.4,
    updatedAt: '2026-03-06',
  },
  'o1-preview': {
    input: 15.0,
    cachedInput: 3.75,
    output: 60.0,
    updatedAt: '2025-12-09',
  },
  'o1-mini': {
    input: 3.0,
    cachedInput: 0.75,
    output: 12.0,
    updatedAt: '2025-12-09',
  },
  'gpt-4-turbo': {
    input: 10.0,
    cachedInput: 2.5,
    output: 30.0,
    updatedAt: '2025-12-09',
  },
  'gpt-4': {
    input: 30.0,
    cachedInput: 7.5,
    output: 60.0,
    updatedAt: '2025-12-09',
  },
  'gpt-3.5-turbo': {
    input: 0.5,
    cachedInput: 0.125,
    output: 1.5,
    updatedAt: '2025-12-09',
  },

  // Anthropic Claude Models (March 2026)
  'claude-opus-4-6': {
    input: 5.0,
    cachedInput: 0.5,
    output: 25.0,
    updatedAt: '2026-03-06',
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    cachedInput: 0.3,
    output: 15.0,
    updatedAt: '2026-03-06',
  },
  'claude-opus-4-5-20251101': {
    input: 5.0,
    cachedInput: 0.5,
    output: 25.0,
    updatedAt: '2026-03-06',
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.0,
    cachedInput: 0.3,
    output: 15.0,
    updatedAt: '2026-03-06',
  },
  'claude-opus-4-1-20250805': {
    input: 15.0,
    cachedInput: 1.5,
    output: 75.0,
    updatedAt: '2026-03-06',
  },
  'claude-sonnet-4-20250514': {
    input: 3.0,
    cachedInput: 0.3,
    output: 15.0,
    updatedAt: '2025-12-09',
  },
  'claude-opus-4-20250514': {
    input: 15.0,
    cachedInput: 1.5,
    output: 75.0,
    updatedAt: '2025-12-09',
  },
  'claude-haiku-4-5-20251001': {
    input: 1.0,
    cachedInput: 0.1,
    output: 5.0,
    updatedAt: '2025-12-09',
  },

  // Google Gemini Models (March 2026)
  'gemini-3.1-pro-preview': {
    input: 2.0,
    cachedInput: 0.5,
    output: 18.0,
    updatedAt: '2026-03-06',
  },
  'gemini-3-flash-preview': {
    input: 0.5,
    cachedInput: 0.13,
    output: 3.0,
    updatedAt: '2026-03-06',
  },
  'gemini-3.1-flash-lite-preview': {
    input: 0.25,
    cachedInput: 0.06,
    output: 1.5,
    updatedAt: '2026-03-06',
  },
  'gemini-2.5-pro': {
    input: 1.25,
    cachedInput: 0.3125,
    output: 10.0,
    updatedAt: '2026-03-06',
  },
  'gemini-2.5-flash': {
    input: 0.3,
    cachedInput: 0.08,
    output: 2.5,
    updatedAt: '2026-03-06',
  },
  'gemini-2.5-flash-lite': {
    input: 0.075,
    cachedInput: 0.01875,
    output: 0.3,
    updatedAt: '2026-03-06',
  },
  'gemini-2.0-flash': {
    input: 0.1,
    cachedInput: 0.025,
    output: 0.4,
    updatedAt: '2025-12-01',
  },
  'gemini-2.0-flash-lite': {
    input: 0.075,
    cachedInput: 0.01875,
    output: 0.3,
    updatedAt: '2025-12-01',
  },

  // DeepSeek Models (December 2025)
  'deepseek-chat': {
    input: 0.27,
    cachedInput: 0.07,
    output: 1.1,
    updatedAt: '2025-12-01',
  },
  'deepseek-reasoner': {
    input: 0.55,
    cachedInput: 0.14,
    output: 2.19,
    updatedAt: '2025-12-01',
  },

  // xAI Grok Models (March 2026)
  'grok-4-latest': {
    input: 3.0,
    cachedInput: 0.75,
    output: 15.0,
    updatedAt: '2026-03-06',
  },
  'grok-3': {
    input: 3.0,
    cachedInput: 0.75,
    output: 15.0,
    updatedAt: '2026-03-06',
  },
  'grok-3-mini': {
    input: 0.3,
    cachedInput: 0.08,
    output: 0.5,
    updatedAt: '2026-03-06',
  },

  // Cerebras Models
  'cerebras/llama-3.3-70b': {
    input: 0.94,
    cachedInput: 0.47,
    output: 0.94,
    updatedAt: '2025-12-01',
  },

  // Groq Models (December 2025)
  'llama-4-scout-17b-16e-instruct': {
    input: 0.11,
    cachedInput: 0.055,
    output: 0.34,
    updatedAt: '2025-12-01',
  },
  'llama-4-maverick-17b-128e-instruct': {
    input: 0.2,
    cachedInput: 0.1,
    output: 0.6,
    updatedAt: '2025-12-01',
  },
  'deepseek-r1-distill-llama-70b': {
    input: 0.75,
    cachedInput: 0.38,
    output: 0.99,
    updatedAt: '2025-12-01',
  },
  'qwen-qwq-32b': {
    input: 0.29,
    cachedInput: 0.145,
    output: 0.39,
    updatedAt: '2025-12-01',
  },
  'llama-3.3-70b-versatile': {
    input: 0.59,
    cachedInput: 0.295,
    output: 0.79,
    updatedAt: '2025-12-01',
  },
}

/**
 * Get pricing for a specific model
 * Returns default pricing if model not found
 */
export function getModelPricing(model: string) {
  const normalizedModel = model.toLowerCase()

  // Exact match
  if (normalizedModel in modelPricing) {
    return modelPricing[normalizedModel]
  }

  // Partial match (for models with prefixes/versions)
  for (const [pricingModel, pricing] of Object.entries(modelPricing)) {
    if (normalizedModel.includes(pricingModel.toLowerCase())) {
      return pricing
    }
  }

  // Default pricing if model not found
  return {
    input: 1.0,
    cachedInput: 0.5,
    output: 5.0,
    updatedAt: '2025-03-21',
  }
}

export default modelPricing
