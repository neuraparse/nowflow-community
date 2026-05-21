import { createLogger } from '@/lib/logs/console-logger'
import type { ModelInfo, ModelTier } from './model-router'

const logger = createLogger('ModelRegistry')

/**
 * Dynamic model registry that can be updated at runtime
 * Supports custom/self-hosted models (Ollama etc.)
 */
export class ModelRegistry {
  private models: Map<string, ModelInfo> = new Map()
  private customModels: Map<string, ModelInfo> = new Map()

  constructor(defaultModels: ModelInfo[]) {
    for (const model of defaultModels) {
      this.models.set(model.id, model)
    }
  }

  /**
   * Register a custom model (e.g., Ollama self-hosted)
   */
  registerModel(model: ModelInfo): void {
    this.customModels.set(model.id, model)
    logger.info('Custom model registered', {
      modelId: model.id,
      provider: model.provider,
      tier: model.tier,
    })
  }

  /**
   * Remove a custom model
   */
  unregisterModel(modelId: string): void {
    this.customModels.delete(modelId)
    logger.info('Custom model unregistered', { modelId })
  }

  /**
   * Get all available models (built-in + custom)
   */
  getAllModels(): ModelInfo[] {
    return [...this.models.values(), ...this.customModels.values()]
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.customModels.get(modelId) || this.models.get(modelId)
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): ModelInfo[] {
    return this.getAllModels().filter((m) => m.provider === provider)
  }

  /**
   * Get models by tier
   */
  getModelsByTier(tier: ModelTier): ModelInfo[] {
    return this.getAllModels().filter((m) => m.tier === tier)
  }

  /**
   * Auto-detect Ollama models and register them
   */
  async detectOllamaModels(ollamaUrl: string = 'http://localhost:11434'): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`)
      if (!response.ok) return []

      const data = await response.json()
      const detected: ModelInfo[] = []

      for (const model of data.models || []) {
        const modelInfo: ModelInfo = {
          id: `ollama/${model.name}`,
          provider: 'ollama',
          tier: this.inferOllamaTier(model.name),
          costPer1kInput: 0, // Self-hosted, no API cost
          costPer1kOutput: 0,
          contextWindow: 8192, // Conservative default
          supportsTools: model.name.includes('llama') || model.name.includes('qwen'),
          supportsVision: model.name.includes('llava') || model.name.includes('vision'),
          supportsStreaming: true,
          latencyMs: 500, // Local inference
        }

        this.registerModel(modelInfo)
        detected.push(modelInfo)
      }

      logger.info(`Detected ${detected.length} Ollama models`, {
        models: detected.map((m) => m.id),
      })
      return detected
    } catch (error) {
      logger.debug('Ollama not available for model detection', { ollamaUrl })
      return []
    }
  }

  private inferOllamaTier(modelName: string): ModelTier {
    // Large models -> brain
    if (/70b|72b|llama.*3\.3|qwen.*72|mixtral/i.test(modelName)) return 'brain'
    // Medium models -> muscle
    if (/13b|14b|32b|34b/i.test(modelName)) return 'muscle'
    // Small models -> micro
    return 'micro'
  }
}
