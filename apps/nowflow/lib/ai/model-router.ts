import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ModelRouter')

/**
 * Model tier classification
 */
export type ModelTier = 'brain' | 'muscle' | 'micro'

export interface ModelInfo {
  id: string
  provider: string
  tier: ModelTier
  costPer1kInput: number // USD per 1k input tokens
  costPer1kOutput: number // USD per 1k output tokens
  contextWindow: number
  supportsTools: boolean
  supportsVision: boolean
  supportsStreaming: boolean
  latencyMs: number // Average latency estimate
}

export interface RoutingDecision {
  selectedModel: string
  tier: ModelTier
  reason: string
  estimatedCost: number
  fallbackModel?: string
}

export interface TaskAnalysis {
  complexity: 'high' | 'medium' | 'low'
  requiresReasoning: boolean
  requiresTools: boolean
  requiresVision: boolean
  estimatedTokens: number
  taskType: TaskType
}

export type TaskType =
  | 'orchestration' // Multi-step planning -> brain
  | 'code_generation' // Complex code -> brain
  | 'analysis' // Data analysis -> brain
  | 'reasoning' // Complex reasoning -> brain
  | 'text_generation' // Simple text -> muscle
  | 'summarization' // Summarize content -> muscle
  | 'extraction' // Extract data -> muscle
  | 'classification' // Classify/categorize -> muscle
  | 'translation' // Language translation -> muscle
  | 'formatting' // Format/transform -> micro
  | 'simple_qa' // Simple Q&A -> micro
  | 'validation' // Validate data -> micro

// Model registry with cost and capability data (2026 pricing)
const MODEL_REGISTRY: ModelInfo[] = [
  // Brain tier (powerful, expensive)
  {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    tier: 'brain',
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 2000,
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    tier: 'brain',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 1000,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    tier: 'brain',
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 1500,
  },
  {
    id: 'o3',
    provider: 'openai',
    tier: 'brain',
    costPer1kInput: 0.01,
    costPer1kOutput: 0.04,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 5000,
  },

  // Muscle tier (balanced)
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    tier: 'muscle',
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 500,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'muscle',
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    latencyMs: 400,
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    tier: 'muscle',
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    contextWindow: 131072,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    latencyMs: 300,
  },

  // Micro tier (fast, cheap)
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    tier: 'micro',
    costPer1kInput: 0.00005,
    costPer1kOutput: 0.00008,
    contextWindow: 131072,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    latencyMs: 100,
  },
]

export class ModelRouter {
  private costBudget: number | null = null // Max cost per execution in USD
  private preferredProvider: string | null = null
  private availableApiKeys: Set<string> = new Set()

  constructor(options?: {
    costBudget?: number
    preferredProvider?: string
    availableApiKeys?: string[]
  }) {
    if (options?.costBudget) this.costBudget = options.costBudget
    if (options?.preferredProvider) this.preferredProvider = options.preferredProvider
    if (options?.availableApiKeys) this.availableApiKeys = new Set(options.availableApiKeys)
  }

  /**
   * Analyze a task and determine its complexity
   */
  analyzeTask(params: {
    systemPrompt?: string
    userMessage: string
    tools?: Array<{ name?: string; type?: string; function?: { name: string } }>
    hasImages?: boolean
    previousContext?: string
  }): TaskAnalysis {
    const { systemPrompt, userMessage, tools, hasImages, previousContext } = params
    const fullText = `${systemPrompt || ''} ${userMessage} ${previousContext || ''}`
    const estimatedTokens = Math.ceil(fullText.length / 4)

    // Determine task type based on content analysis
    let taskType: TaskType = 'simple_qa'
    let complexity: TaskAnalysis['complexity'] = 'low'
    let requiresReasoning = false

    const lowerMsg = userMessage.toLowerCase()

    // High complexity indicators
    const highComplexityPatterns = [
      /(?:plan|design|architect|orchestrat|strateg)/i,
      /(?:analyz|evaluat|compar|assess|review.*code)/i,
      /(?:write|create|implement|build|develop).*(?:function|class|module|system|api|service)/i,
      /(?:debug|fix|troubleshoot|diagnos)/i,
      /(?:explain.*(?:why|how|complex)|reason.*about)/i,
      /(?:multi.?step|step.?by.?step|workflow)/i,
    ]

    // Medium complexity indicators
    const mediumComplexityPatterns = [
      /(?:summariz|extract|convert|transform|format)/i,
      /(?:translate|rewrite|rephrase|simplify)/i,
      /(?:generate|draft|compose).*(?:email|message|text|response)/i,
      /(?:classify|categoriz|label|tag)/i,
    ]

    // Check patterns
    if (highComplexityPatterns.some((p) => p.test(lowerMsg))) {
      complexity = 'high'
      requiresReasoning = true

      if (/(?:plan|design|architect|orchestrat)/i.test(lowerMsg)) taskType = 'orchestration'
      else if (/(?:write|create|implement|build|develop).*(?:code|function|class)/i.test(lowerMsg))
        taskType = 'code_generation'
      else if (/(?:analyz|evaluat|compar)/i.test(lowerMsg)) taskType = 'analysis'
      else taskType = 'reasoning'
    } else if (mediumComplexityPatterns.some((p) => p.test(lowerMsg))) {
      complexity = 'medium'

      if (/(?:summariz)/i.test(lowerMsg)) taskType = 'summarization'
      else if (/(?:extract)/i.test(lowerMsg)) taskType = 'extraction'
      else if (/(?:classify|categoriz)/i.test(lowerMsg)) taskType = 'classification'
      else if (/(?:translate)/i.test(lowerMsg)) taskType = 'translation'
      else taskType = 'text_generation'
    } else {
      // Low complexity
      if (/(?:format|convert.*format|transform)/i.test(lowerMsg)) taskType = 'formatting'
      else if (/(?:valid|check|verify)/i.test(lowerMsg)) taskType = 'validation'
      else taskType = 'simple_qa'
    }

    // Tools and vision increase complexity
    if (tools && tools.length > 0) {
      if (complexity === 'low') complexity = 'medium'
    }

    return {
      complexity,
      requiresReasoning,
      requiresTools: (tools?.length || 0) > 0,
      requiresVision: hasImages || false,
      estimatedTokens,
      taskType,
    }
  }

  /**
   * Select the optimal model based on task analysis
   */
  route(analysis: TaskAnalysis, overrideModel?: string): RoutingDecision {
    // If user specified a model, respect it but provide fallback
    if (overrideModel) {
      const model = MODEL_REGISTRY.find((m) => m.id === overrideModel)
      if (model) {
        return {
          selectedModel: model.id,
          tier: model.tier,
          reason: 'User-specified model override',
          estimatedCost: this.estimateCost(model, analysis.estimatedTokens),
        }
      }
    }

    // Determine target tier
    let targetTier: ModelTier
    switch (analysis.complexity) {
      case 'high':
        targetTier = 'brain'
        break
      case 'medium':
        targetTier = 'muscle'
        break
      case 'low':
        targetTier = 'micro'
        break
    }

    // If task requires tools but micro doesn't support them, upgrade
    if (analysis.requiresTools && targetTier === 'micro') targetTier = 'muscle'

    // If task requires vision, filter accordingly
    const candidates = MODEL_REGISTRY.filter((m) => {
      if (m.tier !== targetTier) return false
      if (analysis.requiresVision && !m.supportsVision) return false
      if (analysis.requiresTools && !m.supportsTools) return false
      if (this.preferredProvider && m.provider !== this.preferredProvider) return false
      return true
    })

    // Fallback: if no candidates with preferred provider, try all providers
    const finalCandidates =
      candidates.length > 0
        ? candidates
        : MODEL_REGISTRY.filter((m) => {
            if (m.tier !== targetTier) return false
            if (analysis.requiresVision && !m.supportsVision) return false
            if (analysis.requiresTools && !m.supportsTools) return false
            return true
          })

    // Sort by cost (cheapest first) then by latency
    const sorted = finalCandidates.sort((a, b) => {
      const costA = a.costPer1kInput + a.costPer1kOutput
      const costB = b.costPer1kInput + b.costPer1kOutput
      if (costA !== costB) return costA - costB
      return a.latencyMs - b.latencyMs
    })

    const selected = sorted[0] || MODEL_REGISTRY[0] // Ultimate fallback
    const estimatedCost = this.estimateCost(selected, analysis.estimatedTokens)

    // Check budget
    if (this.costBudget && estimatedCost > this.costBudget) {
      // Try cheaper tier
      const cheaper = MODEL_REGISTRY.filter(
        (m) => this.estimateCost(m, analysis.estimatedTokens) <= this.costBudget!
      ).sort((a, b) => b.contextWindow - a.contextWindow)[0]

      if (cheaper) {
        return {
          selectedModel: cheaper.id,
          tier: cheaper.tier,
          reason: `Budget constraint: downgraded from ${targetTier} to ${cheaper.tier}`,
          estimatedCost: this.estimateCost(cheaper, analysis.estimatedTokens),
          fallbackModel: selected.id,
        }
      }
    }

    // Find fallback (next tier down)
    const fallbackTier: ModelTier =
      targetTier === 'brain' ? 'muscle' : targetTier === 'muscle' ? 'micro' : 'micro'
    const fallback = MODEL_REGISTRY.find(
      (m) => m.tier === fallbackTier && m.supportsTools === analysis.requiresTools
    )

    logger.info('Model routing decision', {
      taskType: analysis.taskType,
      complexity: analysis.complexity,
      selectedModel: selected.id,
      tier: selected.tier,
      estimatedCost: estimatedCost.toFixed(6),
    })

    return {
      selectedModel: selected.id,
      tier: selected.tier,
      reason: `Task type: ${analysis.taskType}, complexity: ${analysis.complexity} -> ${targetTier} tier`,
      estimatedCost,
      fallbackModel: fallback?.id,
    }
  }

  /**
   * Get model info by ID
   */
  getModelInfo(modelId: string): ModelInfo | undefined {
    return MODEL_REGISTRY.find((m) => m.id === modelId)
  }

  /**
   * Get all models in a tier
   */
  getModelsByTier(tier: ModelTier): ModelInfo[] {
    return MODEL_REGISTRY.filter((m) => m.tier === tier)
  }

  /**
   * Estimate cost for a given model and token count
   */
  private estimateCost(model: ModelInfo, estimatedTokens: number): number {
    // Assume 70% input, 30% output ratio
    const inputTokens = estimatedTokens * 0.7
    const outputTokens = estimatedTokens * 0.3
    return (
      (inputTokens / 1000) * model.costPer1kInput + (outputTokens / 1000) * model.costPer1kOutput
    )
  }
}

// Singleton for consistent routing across the application
let routerInstance: ModelRouter | null = null

export function getModelRouter(
  options?: ConstructorParameters<typeof ModelRouter>[0]
): ModelRouter {
  if (!routerInstance || options) {
    routerInstance = new ModelRouter(options)
  }
  return routerInstance
}
