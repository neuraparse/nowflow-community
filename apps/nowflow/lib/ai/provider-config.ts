import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { ResolvedAIConfig } from './provider-types'

// ---------------------------------------------------------------------------
// Provider configuration helpers
// ---------------------------------------------------------------------------

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o'
    case 'anthropic':
      return 'claude-sonnet-4-6'
    case 'groq':
      return 'llama-4-scout-17b-16e-instruct'
    case 'together':
      return 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
    case 'google':
      return 'gemini-2.5-pro'
    case 'deepseek':
      return 'deepseek-chat'
    case 'xai':
      return 'grok-4-latest'
    case 'ollama':
      // No hardcoded fallback — providers/ollama resolves this dynamically
      // from the live model list (server picks models[0] when unset).
      return ''
    default:
      return 'gpt-4o'
  }
}

export function getEnvVarConfig(): ResolvedAIConfig | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: getDefaultModel('openai'),
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: getDefaultModel('anthropic'),
      apiKey: process.env.ANTHROPIC_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: 'groq',
      model: getDefaultModel('groq'),
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  if (process.env.TOGETHER_API_KEY) {
    return {
      provider: 'together',
      model: getDefaultModel('together'),
      apiKey: process.env.TOGETHER_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: 'deepseek',
      model: getDefaultModel('deepseek'),
      apiKey: process.env.DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  if (process.env.XAI_API_KEY) {
    return {
      provider: 'xai',
      model: getDefaultModel('xai'),
      apiKey: process.env.XAI_API_KEY,
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: '',
      source: 'env-vars',
    }
  }
  // Ollama doesn't need an API key
  if (process.env.OLLAMA_HOST) {
    return {
      provider: 'ollama',
      model: getDefaultModel('ollama'),
      apiKey: '',
      temperature: 0.7,
      maxTokens: 2000,
      ollamaHost: process.env.OLLAMA_HOST,
      source: 'env-vars',
    }
  }
  return null
}

export function getOpenAICompatibleUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return API_ENDPOINTS.openai.chat
    case 'groq':
      return API_ENDPOINTS.groq.chat
    case 'together':
      return API_ENDPOINTS.together.chat
    case 'deepseek':
      return API_ENDPOINTS.deepseek.chat
    case 'xai':
      return API_ENDPOINTS.xai.chat
    default:
      return API_ENDPOINTS.openai.chat
  }
}
