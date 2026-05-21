import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'
import { getOllamaHost } from '@/lib/ollama-detection'
import type { EmbeddingModel } from './types'

const logger = createLogger('EmbeddingService')

/**
 * Embedding Service
 *
 * Generates vector embeddings for text using various providers.
 * Supports OpenAI and Ollama (local) embedding models.
 */
export class EmbeddingService {
  /**
   * Generate embedding for a single text
   * Automatically falls back to Ollama if OpenAI key is not available
   */
  static async generateEmbedding(
    text: string,
    model: EmbeddingModel = 'ollama-nomic-embed-text',
    apiKey?: string
  ): Promise<number[]> {
    try {
      // Auto-fallback to Ollama if OpenAI key not available
      let effectiveModel = model
      if (model.startsWith('openai-') && !apiKey && !process.env.OPENAI_API_KEY) {
        logger.info('OpenAI API key not available, falling back to Ollama embedding model')
        effectiveModel = 'ollama-nomic-embed-text'
      }

      if (effectiveModel.startsWith('openai-')) {
        return await this.generateOpenAIEmbedding(text, effectiveModel, apiKey)
      } else if (effectiveModel.startsWith('ollama-')) {
        return await this.generateOllamaEmbedding(text, effectiveModel)
      } else {
        throw new Error(`Unsupported embedding model: ${effectiveModel}`)
      }
    } catch (error: any) {
      logger.error('Failed to generate embedding', {
        error: error?.message || error,
        model,
      })
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * Automatically falls back to Ollama if OpenAI key is not available
   */
  static async generateEmbeddings(
    texts: string[],
    model: EmbeddingModel = 'ollama-nomic-embed-text',
    apiKey?: string
  ): Promise<number[][]> {
    return this.embedBatch(texts, model, apiKey)
  }

  /**
   * Embed an array of texts in chunks, returning vectors aligned to input order.
   *
   * - OpenAI: posts up to `openAIBatchSize` inputs per call (single HTTP round-trip per chunk).
   * - Ollama: no native batch endpoint, so we issue up to `ollamaConcurrency` requests in
   *   parallel per wave to amortise per-request overhead while keeping memory bounded.
   *
   * Empty input returns an empty array without making any network calls.
   */
  static async embedBatch(
    texts: string[],
    model: EmbeddingModel = 'ollama-nomic-embed-text',
    apiKey?: string,
    options?: { openAIBatchSize?: number; ollamaConcurrency?: number }
  ): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      return []
    }

    const OPENAI_BATCH_SIZE = options?.openAIBatchSize ?? 256
    const OLLAMA_CONCURRENCY = options?.ollamaConcurrency ?? 8

    // Auto-fallback to Ollama if OpenAI key not available
    let effectiveModel = model
    if (model.startsWith('openai-') && !apiKey && !process.env.OPENAI_API_KEY) {
      logger.info('OpenAI API key not available, falling back to Ollama embedding model')
      effectiveModel = 'ollama-nomic-embed-text'
    }

    try {
      if (effectiveModel.startsWith('openai-')) {
        const out: number[][] = new Array(texts.length)
        for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
          const slice = texts.slice(i, i + OPENAI_BATCH_SIZE)
          const vectors = await this.generateOpenAIEmbeddings(slice, effectiveModel, apiKey)
          for (let j = 0; j < vectors.length; j++) {
            out[i + j] = vectors[j]
          }
        }
        return out
      } else if (effectiveModel.startsWith('ollama-')) {
        const out: number[][] = new Array(texts.length)
        for (let i = 0; i < texts.length; i += OLLAMA_CONCURRENCY) {
          const slice = texts.slice(i, i + OLLAMA_CONCURRENCY)
          const vectors = await Promise.all(
            slice.map((t) => this.generateOllamaEmbedding(t, effectiveModel))
          )
          for (let j = 0; j < vectors.length; j++) {
            out[i + j] = vectors[j]
          }
        }
        return out
      } else {
        throw new Error(`Unsupported embedding model: ${effectiveModel}`)
      }
    } catch (error: any) {
      logger.error('Failed to generate batch embeddings', {
        error: error?.message || error,
        model,
        count: texts.length,
      })
      throw error
    }
  }

  /**
   * Generate OpenAI embedding
   */
  private static async generateOpenAIEmbedding(
    text: string,
    model: EmbeddingModel,
    apiKey?: string
  ): Promise<number[]> {
    const key = apiKey || process.env.OPENAI_API_KEY

    if (!key) {
      throw new Error('OpenAI API key is required for embedding generation')
    }

    // Map our model names to OpenAI model IDs
    const modelMap: Record<string, string> = {
      'openai-ada-002': 'text-embedding-ada-002',
      'openai-text-embedding-3-small': 'text-embedding-3-small',
      'openai-text-embedding-3-large': 'text-embedding-3-large',
    }

    const openaiModel = modelMap[model] || 'text-embedding-ada-002'

    const response = await fetch(API_ENDPOINTS.openai.embeddings, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        input: text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  /**
   * Generate OpenAI embeddings (batch)
   */
  private static async generateOpenAIEmbeddings(
    texts: string[],
    model: EmbeddingModel,
    apiKey?: string
  ): Promise<number[][]> {
    const key = apiKey || process.env.OPENAI_API_KEY

    if (!key) {
      throw new Error('OpenAI API key is required for embedding generation')
    }

    const modelMap: Record<string, string> = {
      'openai-ada-002': 'text-embedding-ada-002',
      'openai-text-embedding-3-small': 'text-embedding-3-small',
      'openai-text-embedding-3-large': 'text-embedding-3-large',
    }

    const openaiModel = modelMap[model] || 'text-embedding-ada-002'

    const response = await fetch(API_ENDPOINTS.openai.embeddings, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: any) => item.embedding)
  }

  /**
   * Generate Ollama embedding (local)
   * Note: Ollama nomic-embed-text produces 768-dim vectors, but our DB expects 1536.
   * We zero-pad to match the DB schema for compatibility.
   */
  private static async generateOllamaEmbedding(
    text: string,
    model: EmbeddingModel
  ): Promise<number[]> {
    // Extract model name (e.g., 'ollama-nomic-embed-text' -> 'nomic-embed-text')
    const ollamaModel = model.replace('ollama-', '')

    // Truncate text to stay within context limits
    // nomic-embed-text has 8192 token context, but we use ~6000 chars as safe limit
    // (roughly 1500-2000 tokens with average 3-4 chars per token)
    const MAX_CHARS = 6000
    const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) : text

    if (text.length > MAX_CHARS) {
      logger.warn('Text truncated for embedding', {
        originalLength: text.length,
        truncatedLength: truncatedText.length,
      })
    }

    const ollamaUrl = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || getOllamaHost()

    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: truncatedText,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const embedding = data.embedding as number[]

    // Zero-pad to 1536 dimensions if needed (DB schema expects 1536)
    const TARGET_DIM = 1536
    if (embedding.length < TARGET_DIM) {
      const padded = new Array(TARGET_DIM).fill(0)
      for (let i = 0; i < embedding.length; i++) {
        padded[i] = embedding[i]
      }
      return padded
    }

    return embedding
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Get embedding dimensions for a model
   */
  static getEmbeddingDimensions(model: EmbeddingModel): number {
    const dimensions: Record<EmbeddingModel, number> = {
      'openai-ada-002': 1536,
      'openai-text-embedding-3-small': 1536,
      'openai-text-embedding-3-large': 3072,
      'ollama-nomic-embed-text': 768,
    }

    return dimensions[model] || 1536
  }
}
