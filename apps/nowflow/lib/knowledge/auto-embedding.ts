import { createLogger } from '@/lib/logs/console-logger'
import { getOllamaHost } from '@/lib/ollama-detection'
import type { EmbeddingModel } from './types'

const logger = createLogger('AutoEmbedding')

/**
 * Auto-configure embedding service
 * Prefers local Ollama over OpenAI to avoid costs
 */

const OLLAMA_URL = process.env.OLLAMA_URL || getOllamaHost()
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text'

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2s timeout
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Check if embedding model is installed in Ollama
 */
export async function isEmbeddingModelInstalled(model = DEFAULT_EMBEDDING_MODEL): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return false

    const data = await response.json()
    const models = data.models || []

    return models.some((m: any) => m.name === model || m.name.startsWith(`${model}:`))
  } catch {
    return false
  }
}

/**
 * Pull embedding model from Ollama
 */
export async function pullEmbeddingModel(model = DEFAULT_EMBEDDING_MODEL): Promise<boolean> {
  try {
    logger.info(`Pulling embedding model: ${model}`)

    const response = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: model,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Failed to pull model:', error)
      return false
    }

    logger.info(`Model ${model} pulled successfully`)
    return true
  } catch (error) {
    logger.error('Error pulling model:', error)
    return false
  }
}

/**
 * Get the best available embedding model
 * Prefers Ollama (free) over OpenAI (paid)
 */
export async function getBestEmbeddingModel(): Promise<EmbeddingModel> {
  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable()

  if (ollamaAvailable) {
    // Check if nomic-embed-text is installed
    const modelInstalled = await isEmbeddingModelInstalled()

    if (modelInstalled) {
      logger.info('Using Ollama nomic-embed-text for embeddings')
      return 'ollama-nomic-embed-text'
    }

    // Try to pull the model
    logger.info('Ollama available but nomic-embed-text not installed, attempting to pull...')
    const pulled = await pullEmbeddingModel()

    if (pulled) {
      return 'ollama-nomic-embed-text'
    }
  }

  // Fallback to OpenAI if OPENAI_API_KEY is set
  if (process.env.OPENAI_API_KEY) {
    logger.info('Using OpenAI text-embedding-3-small for embeddings')
    return 'openai-text-embedding-3-small'
  }

  // Default fallback
  logger.warn('No embedding provider available! Using OpenAI ada-002 (will fail without API key)')
  return 'openai-ada-002'
}

/**
 * Initialize embedding service (call on app startup)
 */
export async function initializeEmbedding(): Promise<{
  model: EmbeddingModel
  provider: 'ollama' | 'openai'
  ready: boolean
}> {
  const model = await getBestEmbeddingModel()
  const provider = model.startsWith('ollama-') ? 'ollama' : 'openai'

  // Verify it works
  let ready = false
  try {
    if (provider === 'ollama') {
      ready = await isEmbeddingModelInstalled()
    } else {
      ready = !!process.env.OPENAI_API_KEY
    }
  } catch {
    ready = false
  }

  logger.info('Embedding service initialized', { model, provider, ready })

  return { model, provider, ready }
}

// Export constants
export { OLLAMA_URL, DEFAULT_EMBEDDING_MODEL }
