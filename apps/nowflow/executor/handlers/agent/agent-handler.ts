import { recordAgentMetrics } from '@/lib/agents/metrics'
import { getModelRouter } from '@/lib/ai/model-router'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { createLogger } from '@/lib/logs/console-logger'
import { MemoryHelper } from '@/lib/memory'
import { withSpan } from '@/lib/observability'
import { isProPlan } from '@/lib/subscription'
import { getAllBlocks } from '@/blocks'
import { BlockOutput } from '@/blocks/types'
import { executeProviderRequest } from '@/providers'
import { supportsTemperature } from '@/providers/model-capabilities'
import { getApiKey, getProviderFromModel, transformBlockTool } from '@/providers/utils'
import { SerializedBlock } from '@/serializer/types'
import { executeTool } from '@/tools'
import { getTool, getToolAsync } from '@/tools/utils'
import { BlockHandler, ExecutionContext, StreamingExecution } from '../../types'
import { normalizeContextValue, resolveAgentContextValue } from './context-utils'
import { searchKnowledge } from './knowledge'
// Extracted modules
import { resolveAgentProfileForBlock } from './profile'
import { composeSystemPrompt, detectActiveFeatures } from './prompt-composition'

// Re-export for external consumers
export { buildPersonaSystemPrompt } from './profile'
export type { ResolvedProfile } from './profile'
export type { ActiveFeatures } from './prompt-composition'

const logger = createLogger('AgentBlockHandler')

export function stripCustomToolPrefix(name: string) {
  return name.startsWith('custom_') ? name.replace('custom_', '') : name
}

/**
 * Handler for Agent blocks that process LLM requests with optional tools.
 */
export class AgentBlockHandler implements BlockHandler {
  canHandle(block: SerializedBlock): boolean {
    // Handle all agent blocks
    const agentBlockIds = [
      'agent',
      'content_creation_agent',
      'customer_service_agent',
      'data_analysis_agent',
      'function_calling_agent',
      'rag_agent',
      'reasoning_agent',
      'sales_agent',
      'human_agent',
    ]
    return agentBlockIds.includes(block.metadata?.id || '')
  }

  async execute(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput | StreamingExecution> {
    return withSpan(
      'executor.handler.agent',
      async () => this.executeInternal(block, inputs, context),
      { blockId: block.id, workflowId: context.workflowId }
    )
  }

  private async executeInternal(
    block: SerializedBlock,
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<BlockOutput | StreamingExecution> {
    logger.info(`Executing agent block: ${block.id}`)
    const metricsStartTime = Date.now()

    // ─── Parse Response Format ────────────────────────────────────────────────
    const responseFormat = this.parseResponseFormat(inputs)

    let model = inputs.model || getDefaultModel('openai')
    let providerId = getProviderFromModel(model)
    logger.info(`Using provider: ${providerId}, model: ${model}`)

    // Gate Ollama models to Pro+ plans
    if (providerId === 'ollama' && context.userId) {
      const userIsPro = await isProPlan(context.userId)
      if (!userIsPro) {
        throw new Error('Local models require a Pro plan. Please upgrade to use Ollama models.')
      }
    }

    const resolvedContextValue = resolveAgentContextValue(inputs, context)
    const normalizedContext = normalizeContextValue(resolvedContextValue)

    // Resolve agent profile (no longer overrides inputs.systemPrompt directly)
    const resolvedProfile = await resolveAgentProfileForBlock(inputs.agentProfileId)

    // Merge memory configuration from context extensions (for deployment mode)
    const effectiveMemoryEnabled =
      (context as any).memoryEnabled !== undefined
        ? (context as any).memoryEnabled
        : inputs.memoryEnabled

    const effectiveSessionMetadata = (context as any).sessionMetadata

    const memoryInputs = {
      ...(resolvedContextValue === undefined
        ? inputs
        : { ...inputs, context: resolvedContextValue }),
      sessionMetadata: effectiveSessionMetadata,
    }

    // ─── Format Tools ─────────────────────────────────────────────────────────
    const formattedTools = await this.formatTools(inputs, context)

    // ─── Smart Model Routing ──────────────────────────────────────────────────
    if (!inputs.model) {
      try {
        const modelRouter = getModelRouter()
        const taskAnalysis = modelRouter.analyzeTask({
          systemPrompt: inputs.systemPrompt || '',
          userMessage: normalizedContext || '',
          tools: formattedTools,
          hasImages: false,
        })
        const routingDecision = modelRouter.route(taskAnalysis)
        model = routingDecision.selectedModel
        providerId = getProviderFromModel(model)
        logger.info('Model routing decision', {
          taskType: taskAnalysis.taskType,
          complexity: taskAnalysis.complexity,
          selectedModel: routingDecision.selectedModel,
          tier: routingDecision.tier,
          reason: routingDecision.reason,
          estimatedCost: routingDecision.estimatedCost.toFixed(6),
        })
      } catch (routingError) {
        logger.warn('Model routing failed, using default', { error: routingError })
      }
    }

    // ─── Smart Feature Detection ─────────────────────────────────────────────
    const features = detectActiveFeatures(inputs, resolvedProfile, formattedTools, responseFormat)
    logger.info('Active features detected', {
      hasProfile: !!features.profile,
      hasKnowledge: features.knowledge,
      hasMemory: features.memory,
      hasTools: features.tools,
      hasResponseFormat: features.responseFormat,
    })

    // Determine search query for knowledge (before parallel phase)
    const baseSearchQuery = normalizedContext || inputs.systemPrompt
    const searchQuery =
      resolvedProfile?.goal && baseSearchQuery
        ? `${resolvedProfile.goal}: ${baseSearchQuery}`
        : baseSearchQuery

    // ─── Phase 1: Parallel Pre-processing (Memory + Knowledge) ───────────────
    const memoryConfig = {
      agentId: block.id,
      agentType: block.metadata?.id || 'agent',
      enabled: effectiveMemoryEnabled,
      limit: inputs.memoryLimit,
      minImportance: inputs.memoryImportance,
      tags: inputs.memoryTags
        ? inputs.memoryTags
            .split(',')
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0)
        : undefined,
    }

    const [memory, knowledgeResult] = await Promise.all([
      MemoryHelper.initialize(memoryConfig, context, memoryInputs),
      features.knowledge && searchQuery
        ? searchKnowledge(inputs, searchQuery)
        : Promise.resolve({ context: null, resultCount: 0 }),
    ])

    if (memory.enabled) {
      logger.info('Memory enabled for agent', {
        agentId: block.id,
        sessionId: memory.sessionContext?.sessionId,
        historyCount: memory.history.length,
      })
    }

    if (knowledgeResult.resultCount > 0) {
      logger.info('Knowledge sources integrated', { resultCount: knowledgeResult.resultCount })
    }

    // ─── Streaming Detection ─────────────────────────────────────────────────
    const shouldUseStreaming = this.shouldStream(block, context)

    if (shouldUseStreaming) {
      logger.info(
        `Block ${block.id} will use streaming response (selected for output with no outgoing connections)`
      )
    }

    // Format memory history as messages array
    const conversationHistory = MemoryHelper.formatForMessages(memory)
    logger.info('Conversation history formatted', {
      messagesCount: conversationHistory.length,
      memoryEnabled: memory.enabled,
    })

    // ─── Phase 2: Smart System Prompt Composition ────────────────────────────
    const enhancedSystemPrompt = composeSystemPrompt(features, knowledgeResult.context)

    logger.info('System prompt composed', {
      promptLength: enhancedSystemPrompt.length,
      activeFeatures: [
        features.profile ? 'profile' : null,
        features.knowledge ? 'knowledge' : null,
        features.memory ? 'memory' : null,
        features.tools ? 'tools' : null,
        features.responseFormat ? 'responseFormat' : null,
      ]
        .filter(Boolean)
        .join(', '),
    })

    // Validate assembled provider request before sending
    if (!enhancedSystemPrompt && !normalizedContext) {
      logger.warn(
        `Agent block "${block.metadata?.name || block.id}" has no system prompt and no context. The model will receive no instructions.`
      )
    }
    if (!inputs.apiKey && providerId !== 'ollama') {
      throw new Error(
        `API key is missing for model "${model}" (provider: ${providerId}). Set an API key or use an environment variable.`
      )
    }

    // ─── Phase 3: Build & Execute Provider Request ──────────────────────────
    const providerRequest = {
      provider: providerId,
      model,
      systemPrompt: enhancedSystemPrompt,
      context: normalizedContext,
      messages: conversationHistory.length > 0 ? conversationHistory : undefined,
      tools: formattedTools.length > 0 ? formattedTools : undefined,
      temperature: supportsTemperature(model) ? inputs.temperature : undefined,
      maxTokens: inputs.maxTokens,
      apiKey: inputs.apiKey,
      responseFormat,
      workflowId: context.workflowId,
      stream: shouldUseStreaming,
    }

    logger.info(`Provider request prepared`, {
      model: providerRequest.model,
      hasSystemPrompt: !!providerRequest.systemPrompt,
      hasContext: !!providerRequest.context,
      hasMessages: !!providerRequest.messages,
      messagesCount: providerRequest.messages?.length || 0,
      hasTools: !!providerRequest.tools,
      hasApiKey: !!providerRequest.apiKey,
      workflowId: providerRequest.workflowId,
      stream: shouldUseStreaming,
      isBlockSelectedForOutput: this.isBlockSelectedForOutput(block, context),
      hasOutgoingConnections: context.edges?.some((edge) => edge.source === block.id) ?? false,
    })

    // CRITICAL FIX: Call provider directly instead of via HTTP to avoid hairpin NAT issues
    logger.info(`Calling provider directly (bypassing HTTP)`, {
      provider: providerRequest.provider,
      model: providerRequest.model,
      note: 'Direct call avoids hairpin NAT and Better Auth redirect issues',
    })

    try {
      // Get the API key using the same logic as the API route
      let finalApiKey: string
      try {
        finalApiKey = getApiKey(
          providerRequest.provider,
          providerRequest.model,
          providerRequest.apiKey
        )
      } catch (error) {
        logger.error('Failed to get API key:', error)
        throw new Error(error instanceof Error ? error.message : 'API key error')
      }

      // Execute provider request directly (same as /api/providers route)
      const response = await executeProviderRequest(providerRequest.provider, {
        model: providerRequest.model,
        systemPrompt: providerRequest.systemPrompt,
        context: providerRequest.context,
        messages: providerRequest.messages,
        tools: providerRequest.tools,
        temperature: providerRequest.temperature,
        maxTokens: providerRequest.maxTokens,
        apiKey: finalApiKey,
        responseFormat: providerRequest.responseFormat,
        workflowId: providerRequest.workflowId,
        stream: shouldUseStreaming,
      })

      // ─── Phase 4: Process Response ──────────────────────────────────────────
      // Handle StreamingExecution response
      if (
        response &&
        typeof response === 'object' &&
        'stream' in response &&
        'execution' in response
      ) {
        return this.handleStreamingExecution(response as StreamingExecution, block)
      }

      // Handle ReadableStream (legacy streaming format)
      if (response instanceof ReadableStream) {
        return this.handleReadableStream(response, block)
      }

      // Non-streaming response
      const result = response as any

      logger.info(`Provider response received`, {
        contentLength: result.content ? result.content.length : 0,
        model: result.model,
        hasTokens: !!result.tokens,
        hasToolCalls: !!result.toolCalls,
        toolCallsCount: result.toolCalls?.length || 0,
      })

      // Record agent metrics (non-blocking)
      recordAgentMetrics({
        workflowId: context.workflowId || '',
        executionId: context.executionId || '',
        blockId: block.id,
        agentName: block.metadata?.name || block.metadata?.id,
        agentProfileId: inputs.agentProfileId || null,
        agentType: 'ai',
        model: result.model || inputs.model || null,
        status: 'success',
        durationMs: Date.now() - metricsStartTime,
        promptTokens: result.tokens?.prompt || null,
        completionTokens: result.tokens?.completion || null,
        totalTokens: result.tokens?.total || null,
        cost: result.cost || null,
      })

      // Save conversation to memory (FAIL-SAFE: non-blocking, never throws)
      await MemoryHelper.saveConversation(
        memory,
        resolvedContextValue ?? inputs.context ?? '',
        result.content || '',
        context.executionId,
        {
          model: result.model,
          tokens: result.tokens,
          toolCalls: result.toolCalls,
        }
      )

      // Get memory statistics (FAIL-SAFE: non-blocking, never throws)
      const memoryStats = await MemoryHelper.getStats(memory)

      return this.buildResponseOutput(result, responseFormat, memoryStats, memory)
    } catch (error: any) {
      logger.error(`Error executing provider request:`, {
        error: error?.message || error,
        errorName: error?.name,
        stack: error?.stack,
        blockId: block.id,
        model: inputs.model,
      })

      // Record failed metrics
      recordAgentMetrics({
        workflowId: context.workflowId || '',
        executionId: context.executionId || '',
        blockId: block.id,
        agentName: block.metadata?.name || block.metadata?.id,
        agentProfileId: inputs.agentProfileId || null,
        agentType: 'ai',
        model: inputs.model || null,
        status: 'failed',
        durationMs: Date.now() - metricsStartTime,
        error: error?.message || String(error),
      })

      throw error
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private parseResponseFormat(inputs: Record<string, any>): any {
    let responseFormat: any = undefined

    if (inputs.responseFormat) {
      if (typeof inputs.responseFormat === 'string') {
        if (inputs.responseFormat.trim() === '') {
          responseFormat = undefined
        } else {
          try {
            responseFormat = JSON.parse(inputs.responseFormat)
          } catch (error: any) {
            logger.error(`Failed to parse response format:`, { error })
            logger.warn(`Continuing without response format due to parsing error`)
            responseFormat = undefined
          }
        }
      } else if (typeof inputs.responseFormat === 'object' && inputs.responseFormat !== null) {
        responseFormat = inputs.responseFormat
      } else {
        responseFormat = undefined
      }

      if (responseFormat) {
        try {
          if (responseFormat && typeof responseFormat === 'object') {
            if (!responseFormat.schema && !responseFormat.name) {
              if (
                responseFormat.type === 'object' &&
                responseFormat.additionalProperties === undefined
              ) {
                responseFormat.additionalProperties = false
              }
              responseFormat = {
                name: 'response_schema',
                schema: responseFormat,
                strict: true,
              }
            } else if (
              responseFormat.schema &&
              responseFormat.schema.type === 'object' &&
              responseFormat.schema.additionalProperties === undefined
            ) {
              responseFormat.schema.additionalProperties = false
            }
          }
        } catch (error: any) {
          logger.error(`Failed to process response format:`, { error })
          logger.warn(`Continuing without response format due to processing error`)
          responseFormat = undefined
        }
      }
    }

    return responseFormat
  }

  private async formatTools(
    inputs: Record<string, any>,
    context: ExecutionContext
  ): Promise<any[]> {
    return Array.isArray(inputs.tools)
      ? (
          await Promise.all(
            inputs.tools
              .filter((tool: any) => {
                const usageControl = tool.usageControl || 'auto'
                if (usageControl === 'none') {
                  logger.info(`Filtering out tool set to 'none': ${tool.title || tool.type}`)
                  return false
                }
                return true
              })
              .map(async (tool: any) => {
                // Handle custom tools
                if (tool.type === 'custom-tool' && tool.schema) {
                  if (tool.code) {
                    const toolName = tool.schema.function.name
                    const params = tool.params || {}
                    return {
                      id: `custom_${tool.title}`,
                      name: toolName,
                      description: tool.schema.function.description || '',
                      params: params,
                      parameters: {
                        type: tool.schema.function.parameters.type,
                        properties: tool.schema.function.parameters.properties,
                        required: tool.schema.function.parameters.required || [],
                      },
                      usageControl: tool.usageControl || 'auto',
                      executeFunction: async (callParams: Record<string, any>) => {
                        try {
                          const result = await withSpan(
                            `executor.tool.${toolName}`,
                            async () =>
                              executeTool('function_execute', {
                                code: tool.code,
                                ...params,
                                ...callParams,
                                timeout: tool.timeout || 5000,
                              }),
                            { toolId: toolName, workflowId: context.workflowId }
                          )
                          if (!result.success) {
                            throw new Error(result.error || 'Function execution failed')
                          }
                          return result.output
                        } catch (error: any) {
                          logger.error(`Error executing custom tool ${toolName}:`, error)
                          throw new Error(`Error in ${toolName}: ${error.message}`)
                        }
                      },
                    }
                  }

                  return {
                    id: `custom_${tool.title}`,
                    name: tool.schema.function.name,
                    description: tool.schema.function.description || '',
                    params: tool.params || {},
                    parameters: {
                      type: tool.schema.function.parameters.type,
                      properties: tool.schema.function.parameters.properties,
                      required: tool.schema.function.parameters.required || [],
                    },
                    usageControl: tool.usageControl || 'auto',
                  }
                }

                // Handle regular block tools with operation selection
                const transformedTool = await transformBlockTool(tool, {
                  selectedOperation: tool.operation,
                  getAllBlocks,
                  getToolAsync: (toolId: string) => getToolAsync(toolId, context.workflowId),
                  getTool,
                })
                if (transformedTool) {
                  transformedTool.usageControl = tool.usageControl || 'auto'
                }
                return transformedTool
              })
          )
        ).filter((t: any): t is NonNullable<typeof t> => t !== null)
      : []
  }

  private isBlockSelectedForOutput(block: SerializedBlock, context: ExecutionContext): boolean {
    return (
      context.selectedOutputIds?.some((outputId) => {
        if (outputId === block.id) return true
        const firstUnderscoreIndex = outputId.indexOf('_')
        if (firstUnderscoreIndex !== -1) {
          const blockId = outputId.substring(0, firstUnderscoreIndex)
          return blockId === block.id
        }
        return false
      }) ?? false
    )
  }

  private shouldStream(block: SerializedBlock, context: ExecutionContext): boolean {
    const isBlockSelectedForOutput = this.isBlockSelectedForOutput(block, context)
    const hasOutgoingConnections = context.edges?.some((edge) => edge.source === block.id) ?? false
    return !!(context.stream && isBlockSelectedForOutput && !hasOutgoingConnections)
  }

  private handleStreamingExecution(
    streamingExec: StreamingExecution,
    block: SerializedBlock
  ): StreamingExecution {
    logger.info(`Received StreamingExecution from provider (direct call)`)

    if (streamingExec.execution) {
      if (streamingExec.execution.logs) {
        for (const log of streamingExec.execution.logs) {
          if (!log.blockId) log.blockId = block.id
          if (!log.blockName && block.metadata?.name) log.blockName = block.metadata.name
          if (!log.blockType && block.metadata?.id) log.blockType = block.metadata.id
        }
      }

      if (streamingExec.execution.output?.response) {
        if (block.metadata?.name && !streamingExec.execution.blockName) {
          streamingExec.execution.blockName = block.metadata.name
        }
        if (block.metadata?.id && !streamingExec.execution.blockType) {
          streamingExec.execution.blockType = block.metadata.id
        }
        if (!streamingExec.execution.blockId) {
          streamingExec.execution.blockId = block.id
        }
        streamingExec.execution.isStreaming = true
      }
    }

    return streamingExec
  }

  private handleReadableStream(
    response: ReadableStream,
    block: SerializedBlock
  ): StreamingExecution {
    logger.info(`Received ReadableStream from provider (direct call)`)
    return {
      stream: response,
      execution: {
        success: true,
        output: { response: {} },
        logs: [],
        metadata: {
          duration: 0,
          startTime: new Date().toISOString(),
        },
        blockId: block.id,
        blockName: block.metadata?.name,
        blockType: block.metadata?.id,
        isStreaming: true,
      },
    }
  }

  private formatToolCalls(toolCalls: any[]): any[] {
    return toolCalls.map((tc: any) => ({
      ...tc,
      name: stripCustomToolPrefix(tc.name),
      startTime: tc.startTime,
      endTime: tc.endTime,
      duration: tc.duration,
      input: tc.arguments || tc.input,
      output: tc.result || tc.output,
    }))
  }

  private buildResponseOutput(
    result: any,
    responseFormat: any,
    memoryStats: any,
    memory: any
  ): BlockOutput {
    // If structured responses, try to parse the content
    if (responseFormat) {
      try {
        const parsedContent = JSON.parse(result.content)

        return {
          response: {
            ...parsedContent,
            tokens: result.tokens || { prompt: 0, completion: 0, total: 0 },
            toolCalls: result.toolCalls
              ? {
                  list: this.formatToolCalls(result.toolCalls),
                  count: result.toolCalls.length,
                }
              : undefined,
            providerTiming: result.timing || undefined,
            cost: result.cost || undefined,
            ...MemoryHelper.formatStatsForOutput(memory, memoryStats),
          },
        }
      } catch (error) {
        logger.error(`Failed to parse response content:`, { error })
        logger.info(`Falling back to standard response format`)

        return {
          response: {
            content: result.content,
            model: result.model,
            tokens: result.tokens || { prompt: 0, completion: 0, total: 0 },
            toolCalls: {
              list: result.toolCalls ? this.formatToolCalls(result.toolCalls) : [],
              count: result.toolCalls?.length || 0,
            },
            providerTiming: result.timing || undefined,
            cost: result.cost || undefined,
            ...MemoryHelper.formatStatsForOutput(memory, memoryStats),
          },
        }
      }
    }

    // Return standard response if no responseFormat
    return {
      response: {
        content: result.content,
        model: result.model,
        tokens: result.tokens || { prompt: 0, completion: 0, total: 0 },
        toolCalls: {
          list: result.toolCalls ? this.formatToolCalls(result.toolCalls) : [],
          count: result.toolCalls?.length || 0,
        },
        providerTiming: result.timing || undefined,
        cost: result.cost || undefined,
        ...MemoryHelper.formatStatsForOutput(memory, memoryStats),
      },
    }
  }
}
