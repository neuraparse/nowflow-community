import { createLogger } from '@/lib/logs/console-logger'
import { detectOllamaConfig, getOllamaHost } from '@/lib/ollama-detection'
import { useOllamaStore } from '@/stores/ollama/store'
import { executeTool } from '@/tools'
import { ProviderConfig, ProviderRequest, ProviderResponse, TimeSegment } from '../types'
import { ModelsObject } from './types'

const logger = createLogger('OllamaProvider')

export const ollamaProvider: ProviderConfig = {
  id: 'ollama',
  name: 'Ollama',
  description: 'Local Ollama server for LLM inference',
  version: '1.0.0',
  models: [], // Will be populated dynamically
  defaultModel: '',

  // Initialize the provider - but don't auto-fetch models
  async initialize() {
    try {
      // Don't auto-initialize Ollama - only initialize when explicitly requested
      logger.debug('Ollama provider initialized (lazy loading mode)')

      // Set empty models initially - will be populated when user clicks refresh
      useOllamaStore.getState().setModels([])
      this.models = []
      this.defaultModel = ''

      return
    } catch (error) {
      logger.error('Failed to initialize Ollama provider', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      useOllamaStore.getState().setModels([])
    }
  },

  // New method for manual refresh
  async refreshModels() {
    try {
      // Check if we're running on client-side
      if (typeof window !== 'undefined') {
        // Client-side: Use API endpoint
        try {
          const response = await fetch('/api/ollama/refresh', {
            method: 'POST',
          })

          if (!response.ok) {
            useOllamaStore.getState().setModels([])
            logger.warn('Ollama API endpoint not available. The provider will be disabled.')
            return { success: false, error: 'API endpoint not available' }
          }

          const data = await response.json()
          if (data.success) {
            this.models = data.models || []
            useOllamaStore.getState().setModels(this.models)

            logger.info('Ollama models refreshed successfully (client-side)', {
              modelCount: this.models.length,
              models: this.models,
            })

            // Set default model
            if (this.models.length > 0) {
              // No hardcoded model preference — first installed model wins.
              this.defaultModel = this.models[0]
            }

            return { success: true }
          } else {
            useOllamaStore.getState().setModels([])
            logger.warn('Ollama service returned error during refresh.')
            return { success: false, error: 'Ollama service returned error' }
          }
        } catch (error) {
          useOllamaStore.getState().setModels([])
          logger.warn('Failed to connect to Ollama API endpoint during refresh.', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          return { success: false, error: 'Failed to connect to Ollama API' }
        }
      } else {
        // Server-side: Use dynamic host detection
        const config = await detectOllamaConfig()

        if (!config.isAvailable) {
          useOllamaStore.getState().setModels([])
          logger.warn('Ollama service is not available during refresh.')
          return { success: false, error: 'Ollama service not available' }
        }

        logger.info('Ollama service is available (server-side)', {
          host: config.host,
          environment: config.environment,
          version: config.version,
        })

        // Fetch models from detected host
        const response = await fetch(`${config.host}/api/tags`)
        if (!response.ok) {
          useOllamaStore.getState().setModels([])
          logger.warn(
            `Ollama model list request failed with status ${response.status} during refresh.`
          )
          return { success: false, error: `HTTP ${response.status}` }
        }

        const data = (await response.json()) as ModelsObject
        this.models = data.models.map((model) => model.name)

        // No hardcoded model preference — first installed model wins.
        if (this.models.length > 0) {
          this.defaultModel = this.models[0]
        }

        useOllamaStore.getState().setModels(this.models)

        logger.info('Ollama models refreshed successfully (server-side)', {
          modelCount: this.models.length,
          models: this.models,
          defaultModel: this.defaultModel,
        })

        return { success: true }
      }
    } catch (error) {
      useOllamaStore.getState().setModels([])
      logger.warn('Ollama model refresh failed.', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },

  executeRequest: async (request: ProviderRequest): Promise<ProviderResponse> => {
    // Remove API key from logs for security
    const { apiKey, ...logRequest } = request
    logger.debug('Ollama request', logRequest)
    logger.info('Preparing Ollama request', {
      model: request.model,
      hasSystemPrompt: !!request.systemPrompt,
      hasMessages: !!request.context,
      hasTools: !!request.tools?.length,
      toolCount: request.tools?.length || 0,
      hasResponseFormat: !!request.responseFormat,
      isClientSide: typeof window !== 'undefined',
    })

    // CLIENT-SIDE: Proxy through /api/providers to reach Ollama via server
    // Browser cannot resolve Docker hostnames like "ollama:11434"
    if (typeof window !== 'undefined') {
      logger.info('Client-side detected, proxying Ollama request through /api/providers')
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'ollama',
          model: request.model,
          systemPrompt: request.systemPrompt,
          context: request.context,
          tools: request.tools,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          apiKey: 'ollama',
          responseFormat: request.responseFormat,
          workflowId: request.workflowId,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || `Ollama proxy request failed: ${response.status}`)
      }

      return await response.json()
    }

    // SERVER-SIDE: Direct connection to Ollama
    const startTime = Date.now()
    const timeSegments: TimeSegment[] = []

    try {
      // Resolve Ollama host: prefer env/config, fallback to dynamic detection
      let ollamaHost = getOllamaHost()

      // Quick connectivity check — if static host fails, try dynamic detection
      try {
        const probe = await fetch(`${ollamaHost}/api/version`, {
          signal: AbortSignal.timeout(3000),
        })
        if (!probe.ok) throw new Error(`HTTP ${probe.status}`)
      } catch {
        logger.warn(`Static Ollama host ${ollamaHost} unreachable, trying dynamic detection...`)
        const detected = await detectOllamaConfig()
        if (detected.isAvailable) {
          ollamaHost = detected.host
          logger.info(`Detected Ollama at ${ollamaHost}`)
        }
      }

      // Use native Ollama API (not OpenAI compat) to support think:false
      const ollamaApiUrl = `${ollamaHost}/api/chat`

      // Start with an empty array for all messages
      const allMessages: any[] = []

      // Add system prompt if present
      if (request.systemPrompt) {
        allMessages.push({ role: 'system', content: request.systemPrompt })
      }

      // Add context if present
      if (request.context) {
        allMessages.push({ role: 'user', content: request.context })
      }

      // Add remaining messages
      if (request.messages) {
        allMessages.push(...request.messages)
      }

      // Build the basic payload using native Ollama API
      const payload: any = {
        model: request.model,
        messages: allMessages,
        stream: false,
        think: false, // Disable thinking mode — critical for CPU performance
      }

      // Add optional parameters via options
      const options: any = {
        num_thread: 16, // Optimal for EPYC 9355P — 16 threads = best tok/s
        num_predict: request.maxTokens || 128, // Limit output tokens for fast CPU responses
      }
      if (request.temperature !== undefined) options.temperature = request.temperature
      payload.options = options

      // Transform tools to Ollama format if provided
      if (request.tools?.length) {
        const filteredTools = request.tools
          .filter((t) => t.usageControl !== 'none')
          .map((tool) => ({
            type: 'function',
            function: {
              name: tool.id,
              description: tool.description,
              parameters: tool.parameters,
            },
          }))

        if (filteredTools.length) {
          payload.tools = filteredTools

          logger.info(`Ollama request configuration:`, {
            toolCount: filteredTools.length,
            model: request.model,
          })
        }
      }

      logger.info('Sending native Ollama API request', {
        url: ollamaApiUrl,
        model: payload.model,
        think: payload.think,
        messageCount: payload.messages?.length,
        hasTools: !!payload.tools?.length,
        probeTime: Date.now() - startTime,
      })

      const fetchStartTime = Date.now()
      let currentResponse = await fetch(ollamaApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!currentResponse.ok) {
        throw new Error(`Ollama API error: ${currentResponse.status} ${currentResponse.statusText}`)
      }

      let responseData = await currentResponse.json()
      const firstResponseTime = Date.now() - startTime
      const fetchDuration = Date.now() - fetchStartTime

      logger.info('Ollama API response received', {
        fetchDuration: `${fetchDuration}ms`,
        totalDuration: `${firstResponseTime}ms`,
        ollamaDuration: responseData.total_duration
          ? `${(responseData.total_duration / 1e6).toFixed(0)}ms`
          : 'unknown',
        evalCount: responseData.eval_count,
        hasContent: !!responseData.message?.content,
        hasThinking: !!responseData.message?.thinking,
        contentLength: responseData.message?.content?.length || 0,
      })

      let content = responseData.message?.content || ''

      // Clean up the response content if it exists
      if (content) {
        content = content.replace(/```json\n?|\n?```/g, '')
        content = content.trim()
      }

      let tokens = {
        prompt: responseData.prompt_eval_count || 0,
        completion: responseData.eval_count || 0,
        total: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
      }
      let toolCalls = []
      let toolResults = []
      let currentMessages = [...allMessages]
      let iterationCount = 0
      const MAX_ITERATIONS = 10 // Prevent infinite loops

      // Track time spent in model vs tools
      let modelTime = firstResponseTime
      let toolsTime = 0

      // Track each model and tool call segment with timestamps
      const timeSegments: TimeSegment[] = [
        {
          type: 'model',
          name: 'Initial response',
          startTime: startTime,
          endTime: startTime + firstResponseTime,
          duration: firstResponseTime,
        },
      ]

      try {
        while (iterationCount < MAX_ITERATIONS) {
          // Check for tool calls (native Ollama API format)
          const toolCallsInResponse = responseData.message?.tool_calls
          if (!toolCallsInResponse || toolCallsInResponse.length === 0) {
            break
          }

          // Track time for tool calls in this batch
          const toolsStartTime = Date.now()

          // Process each tool call
          for (const toolCall of toolCallsInResponse) {
            try {
              const toolName = toolCall.function.name
              const toolArgs = toolCall.function.arguments

              // Get the tool from the tools registry
              const tool = request.tools?.find((t) => t.id === toolName)
              if (!tool) continue

              // Execute the tool
              const toolCallStartTime = Date.now()
              const mergedArgs = {
                ...tool.params,
                ...toolArgs,
                ...(request.workflowId ? { _context: { workflowId: request.workflowId } } : {}),
              }
              const result = await executeTool(toolName, mergedArgs, true)
              const toolCallEndTime = Date.now()
              const toolCallDuration = toolCallEndTime - toolCallStartTime

              if (!result.success) continue

              // Add to time segments
              timeSegments.push({
                type: 'tool',
                name: toolName,
                startTime: toolCallStartTime,
                endTime: toolCallEndTime,
                duration: toolCallDuration,
              })

              toolResults.push(result.output)
              toolCalls.push({
                name: toolName,
                arguments: toolArgs,
                startTime: new Date(toolCallStartTime).toISOString(),
                endTime: new Date(toolCallEndTime).toISOString(),
                duration: toolCallDuration,
                result: result.output,
              })

              // Add the tool call and result to messages (native Ollama format)
              currentMessages.push({
                role: 'assistant',
                content: '',
                tool_calls: [toolCall],
              })

              currentMessages.push({
                role: 'tool',
                content: JSON.stringify(result.output),
              })
            } catch (error) {
              logger.error('Error processing tool call:', { error })
            }
          }

          // Calculate tool call time for this iteration
          const thisToolsTime = Date.now() - toolsStartTime
          toolsTime += thisToolsTime

          // Make the next request with updated messages
          const nextPayload = {
            ...payload,
            messages: currentMessages,
          }

          // Time the next model call
          const nextModelStartTime = Date.now()

          // Make the next request using native Ollama API
          const nextResponse = await fetch(ollamaApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextPayload),
          })

          if (!nextResponse.ok) {
            throw new Error(`Ollama API error: ${nextResponse.status}`)
          }

          responseData = await nextResponse.json()

          const nextModelEndTime = Date.now()
          const thisModelTime = nextModelEndTime - nextModelStartTime

          // Add to time segments
          timeSegments.push({
            type: 'model',
            name: `Model response (iteration ${iterationCount + 1})`,
            startTime: nextModelStartTime,
            endTime: nextModelEndTime,
            duration: thisModelTime,
          })

          // Add to model time
          modelTime += thisModelTime

          // Update content if we have a text response
          if (responseData.message?.content) {
            content = responseData.message.content
            // Clean up the response content
            content = content.replace(/```json\n?|\n?```/g, '')
            content = content.trim()
          }

          // Update token counts
          if (responseData.prompt_eval_count || responseData.eval_count) {
            tokens.prompt += responseData.prompt_eval_count || 0
            tokens.completion += responseData.eval_count || 0
            tokens.total += (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0)
          }

          iterationCount++
        }
      } catch (error) {
        logger.error('Error in Ollama request:', { error })
      }

      const endTime = Date.now()

      return {
        content: content,
        model: request.model,
        tokens,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        timing: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: endTime - startTime,
          modelTime: modelTime,
          toolsTime: toolsTime,
          firstResponseTime: firstResponseTime,
          iterations: iterationCount + 1,
          timeSegments,
        },
      }
    } catch (error) {
      // Check if it's a connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('Connection error') ||
        errorMessage.includes('connect failed')

      if (isConnectionError) {
        logger.error('Ollama connection error', {
          error: errorMessage,
          model: request.model,
        })

        throw new Error(
          `Ollama connection error: Could not connect to Ollama. ` +
            `Please make sure Ollama is running. Try refreshing models in Model Settings.`
        )
      } else {
        // Log other errors
        logger.error('Error in Ollama request', {
          error: errorMessage,
          model: request.model,
        })
        throw error
      }
    }
  },
}
