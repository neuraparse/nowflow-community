import { beforeEach, describe, expect, it } from 'vitest'
import { ModelRouter } from '../model-router'

describe('ModelRouter', () => {
  let router: ModelRouter

  beforeEach(() => {
    router = new ModelRouter()
  })

  describe('analyzeTask', () => {
    it('should classify orchestration tasks as high complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Plan and design a multi-step workflow for data processing',
      })
      expect(analysis.complexity).toBe('high')
      expect(analysis.taskType).toBe('orchestration')
      expect(analysis.requiresReasoning).toBe(true)
    })

    it('should classify code generation as high complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Write a function that implements binary search in TypeScript',
      })
      expect(analysis.complexity).toBe('high')
      expect(analysis.taskType).toBe('code_generation')
    })

    it('should classify analysis tasks as high complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Analyze the performance data and compare these two approaches',
      })
      expect(analysis.complexity).toBe('high')
      expect(analysis.taskType).toBe('analysis')
      expect(analysis.requiresReasoning).toBe(true)
    })

    it('should classify debugging tasks as high complexity reasoning', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Debug this error in the authentication module',
      })
      expect(analysis.complexity).toBe('high')
      expect(analysis.taskType).toBe('reasoning')
      expect(analysis.requiresReasoning).toBe(true)
    })

    it('should classify summarization as medium complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Summarize this article about machine learning',
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.taskType).toBe('summarization')
    })

    it('should classify extraction as medium complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Extract the key dates and names from this document',
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.taskType).toBe('extraction')
    })

    it('should classify classification as medium complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Classify these customer reviews by sentiment',
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.taskType).toBe('classification')
    })

    it('should classify translation as medium complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Translate this paragraph to French',
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.taskType).toBe('translation')
    })

    it('should classify text generation as medium complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Generate a draft email response to the client',
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.taskType).toBe('text_generation')
    })

    it('should classify simple questions as low complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'What time is it?',
      })
      expect(analysis.complexity).toBe('low')
      expect(analysis.taskType).toBe('simple_qa')
    })

    it('should classify validation as low complexity', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Validate this JSON payload',
      })
      expect(analysis.complexity).toBe('low')
      expect(analysis.taskType).toBe('validation')
    })

    it('should upgrade complexity when tools are present', () => {
      const analysis = router.analyzeTask({
        userMessage: 'What is the weather?',
        tools: [{ name: 'weather_api' }],
      })
      expect(analysis.complexity).toBe('medium')
      expect(analysis.requiresTools).toBe(true)
    })

    it('should not upgrade already-high complexity when tools are present', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Plan a deployment strategy for this service',
        tools: [{ name: 'deploy_tool' }],
      })
      expect(analysis.complexity).toBe('high')
      expect(analysis.requiresTools).toBe(true)
    })

    it('should detect vision requirement', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Describe this image',
        hasImages: true,
      })
      expect(analysis.requiresVision).toBe(true)
    })

    it('should set requiresVision to false when no images', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Describe something',
      })
      expect(analysis.requiresVision).toBe(false)
    })

    it('should estimate tokens from message length', () => {
      const analysis = router.analyzeTask({
        userMessage: 'A'.repeat(400), // ~100 tokens (400 chars / 4)
      })
      expect(analysis.estimatedTokens).toBeGreaterThan(90)
      expect(analysis.estimatedTokens).toBeLessThan(110)
    })

    it('should include systemPrompt and previousContext in token estimate', () => {
      const analysisShort = router.analyzeTask({
        userMessage: 'Hello',
      })
      const analysisLong = router.analyzeTask({
        userMessage: 'Hello',
        systemPrompt: 'A'.repeat(400),
        previousContext: 'B'.repeat(400),
      })
      expect(analysisLong.estimatedTokens).toBeGreaterThan(analysisShort.estimatedTokens)
    })

    it('should set requiresTools to false when no tools provided', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Hello world',
      })
      expect(analysis.requiresTools).toBe(false)
    })

    it('should set requiresTools to true when tools are provided', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Hello world',
        tools: [{ name: 'tool1' }, { name: 'tool2' }],
      })
      expect(analysis.requiresTools).toBe(true)
    })
  })

  describe('route', () => {
    it('should select brain tier model for high complexity', () => {
      const decision = router.route({
        complexity: 'high',
        requiresReasoning: true,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 1000,
        taskType: 'orchestration',
      })
      expect(decision.tier).toBe('brain')
      expect(decision.selectedModel).toBeTruthy()
    })

    it('should select muscle tier for medium complexity', () => {
      const decision = router.route({
        complexity: 'medium',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 500,
        taskType: 'summarization',
      })
      expect(decision.tier).toBe('muscle')
    })

    it('should select micro tier for low complexity', () => {
      const decision = router.route({
        complexity: 'low',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 100,
        taskType: 'simple_qa',
      })
      expect(decision.tier).toBe('micro')
    })

    it('should upgrade micro to muscle when tools required', () => {
      const decision = router.route({
        complexity: 'low',
        requiresReasoning: false,
        requiresTools: true,
        requiresVision: false,
        estimatedTokens: 100,
        taskType: 'simple_qa',
      })
      expect(decision.tier).toBe('muscle')
    })

    it('should respect override model', () => {
      const decision = router.route(
        {
          complexity: 'low',
          requiresReasoning: false,
          requiresTools: false,
          requiresVision: false,
          estimatedTokens: 100,
          taskType: 'simple_qa',
        },
        'claude-opus-4-6'
      )
      expect(decision.selectedModel).toBe('claude-opus-4-6')
      expect(decision.reason).toContain('override')
    })

    it('should ignore unknown override model and route normally', () => {
      const decision = router.route(
        {
          complexity: 'low',
          requiresReasoning: false,
          requiresTools: false,
          requiresVision: false,
          estimatedTokens: 100,
          taskType: 'simple_qa',
        },
        'nonexistent-model-xyz'
      )
      // Should fall through to normal routing
      expect(decision.tier).toBe('micro')
    })

    it('should respect cost budget and downgrade', () => {
      // With 10000 tokens, brain tier (claude-sonnet-4-6) costs ~0.066
      // micro tier (llama-3.1-8b-instant) costs ~0.00059
      // Set budget between these values to force a downgrade
      const budgetRouter = new ModelRouter({ costBudget: 0.001 })
      const decision = budgetRouter.route({
        complexity: 'high',
        requiresReasoning: true,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 10000,
        taskType: 'orchestration',
      })
      // Should downgrade due to budget constraint
      expect(decision.reason).toContain('Budget')
      // Should select a cheaper tier model
      expect(decision.tier).not.toBe('brain')
    })

    it('should prefer specified provider', () => {
      const providerRouter = new ModelRouter({ preferredProvider: 'anthropic' })
      const decision = providerRouter.route({
        complexity: 'medium',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 500,
        taskType: 'text_generation',
      })
      expect(decision.selectedModel).toContain('claude')
    })

    it('should fall back to any provider if preferred has no match', () => {
      const providerRouter = new ModelRouter({ preferredProvider: 'nonexistent-provider' })
      const decision = providerRouter.route({
        complexity: 'medium',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 500,
        taskType: 'text_generation',
      })
      // Should still return a model from any provider
      expect(decision.selectedModel).toBeTruthy()
      expect(decision.tier).toBe('muscle')
    })

    it('should provide fallback model for brain tier with tool usage', () => {
      const decision = router.route({
        complexity: 'high',
        requiresReasoning: true,
        requiresTools: true,
        requiresVision: false,
        estimatedTokens: 1000,
        taskType: 'orchestration',
      })
      // Brain -> muscle fallback, requiresTools=true matches muscle models with supportsTools=true
      expect(decision.fallbackModel).toBeTruthy()
    })

    it('should include reason with task type and complexity', () => {
      const decision = router.route({
        complexity: 'medium',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 500,
        taskType: 'extraction',
      })
      expect(decision.reason).toContain('extraction')
      expect(decision.reason).toContain('medium')
    })

    it('should include estimated cost in decision', () => {
      const decision = router.route({
        complexity: 'high',
        requiresReasoning: true,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 1000,
        taskType: 'code_generation',
      })
      expect(decision.estimatedCost).toBeGreaterThan(0)
      expect(typeof decision.estimatedCost).toBe('number')
    })

    it('should sort candidates by cost then latency (cheapest first)', () => {
      // For brain tier, the cheapest model should be selected
      const decision = router.route({
        complexity: 'high',
        requiresReasoning: true,
        requiresTools: false,
        requiresVision: false,
        estimatedTokens: 100,
        taskType: 'reasoning',
      })
      // claude-sonnet-4-6 is cheapest brain model (0.003 + 0.015 = 0.018)
      expect(decision.selectedModel).toBe('claude-sonnet-4-6')
    })

    it('should filter by vision support when required', () => {
      const decision = router.route({
        complexity: 'medium',
        requiresReasoning: false,
        requiresTools: false,
        requiresVision: true,
        estimatedTokens: 500,
        taskType: 'summarization',
      })
      const modelInfo = router.getModelInfo(decision.selectedModel)
      expect(modelInfo?.supportsVision).toBe(true)
    })
  })

  describe('getModelInfo', () => {
    it('should return model info for known model', () => {
      const info = router.getModelInfo('claude-opus-4-6')
      expect(info).toBeTruthy()
      expect(info?.provider).toBe('anthropic')
      expect(info?.tier).toBe('brain')
    })

    it('should return correct capabilities for claude-opus-4-6', () => {
      const info = router.getModelInfo('claude-opus-4-6')
      expect(info?.supportsTools).toBe(true)
      expect(info?.supportsVision).toBe(true)
      expect(info?.supportsStreaming).toBe(true)
      expect(info?.contextWindow).toBe(200000)
    })

    it('should return model info for groq model', () => {
      const info = router.getModelInfo('llama-3.1-8b-instant')
      expect(info).toBeTruthy()
      expect(info?.provider).toBe('groq')
      expect(info?.tier).toBe('micro')
      expect(info?.supportsTools).toBe(false)
    })

    it('should return undefined for unknown model', () => {
      const info = router.getModelInfo('nonexistent-model')
      expect(info).toBeUndefined()
    })
  })

  describe('getModelsByTier', () => {
    it('should return brain tier models', () => {
      const models = router.getModelsByTier('brain')
      expect(models.length).toBeGreaterThan(0)
      expect(models.every((m) => m.tier === 'brain')).toBe(true)
    })

    it('should return muscle tier models', () => {
      const models = router.getModelsByTier('muscle')
      expect(models.length).toBeGreaterThan(0)
      expect(models.every((m) => m.tier === 'muscle')).toBe(true)
    })

    it('should return micro tier models', () => {
      const models = router.getModelsByTier('micro')
      expect(models.length).toBeGreaterThan(0)
      expect(models.every((m) => m.tier === 'micro')).toBe(true)
    })

    it('should return all known brain models', () => {
      const models = router.getModelsByTier('brain')
      const ids = models.map((m) => m.id)
      expect(ids).toContain('claude-opus-4-6')
      expect(ids).toContain('claude-sonnet-4-6')
      expect(ids).toContain('gpt-4o')
      expect(ids).toContain('o3')
    })
  })

  describe('end-to-end routing', () => {
    it('should route a complex planning task to brain tier', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Design an architecture for a distributed caching system',
      })
      const decision = router.route(analysis)
      expect(decision.tier).toBe('brain')
    })

    it('should route a summarization task to muscle tier', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Summarize the meeting notes from today',
      })
      const decision = router.route(analysis)
      expect(decision.tier).toBe('muscle')
    })

    it('should route a simple greeting to micro tier', () => {
      const analysis = router.analyzeTask({
        userMessage: 'Hello, how are you?',
      })
      const decision = router.route(analysis)
      expect(decision.tier).toBe('micro')
    })

    it('should upgrade simple task with tools to muscle tier', () => {
      const analysis = router.analyzeTask({
        userMessage: 'What is the weather today?',
        tools: [{ name: 'weather_api' }],
      })
      const decision = router.route(analysis)
      expect(decision.tier).toBe('muscle')
    })
  })
})
