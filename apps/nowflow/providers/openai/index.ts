import OpenAI from 'openai'
import { createLogger } from '@/lib/logs/console-logger'
import { StreamingExecution } from '@/executor/types'
import { executeTool } from '@/tools'
import { isOpenAIReasoningModel } from '../model-capabilities'
import { ProviderConfig, ProviderRequest, ProviderResponse, TimeSegment } from '../types'
import { prepareToolsWithUsageControl, trackForcedToolUsage } from '../utils'

const logger = createLogger('OpenAIProvider')

const DEFAULT_MODEL = 'gpt-4o'

// Helper function to get tier requirement for models
function getTierRequirement(model: string): string {
  const tierRequirements: Record<string, string> = {
    'gpt-5': 'requires Tier 4+',
    'gpt-5-mini': 'requires Tier 4+',
    'gpt-5-nano': 'requires Tier 3+',
    'gpt-5.2': 'requires Tier 4+',
    'gpt-5.4': 'requires Tier 4+',
    'gpt-4.1': 'requires Tier 2+',
    'gpt-4.1-mini': 'requires Tier 1+',
    'o1-preview': 'requires Tier 5',
    'o1-mini': 'requires Tier 5',
    'o3-mini': 'requires Tier 3+',
    o3: 'requires Tier 4+',
    'o4-mini': 'requires Tier 3+',
  }
  return tierRequirements[model] || 'may require higher tier'
}

/**
 * Helper function to convert an OpenAI stream to a standard ReadableStream
 * and collect completion metrics
 */
function createReadableStreamFromOpenAIStream(
  openaiStream: any,
  onComplete?: (content: string, usage?: any) => void
): ReadableStream {
  let fullContent = ''
  let usageData: any = null

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          // Check for usage data in the final chunk
          if (chunk.usage) {
            usageData = chunk.usage
          }

          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            controller.enqueue(new TextEncoder().encode(content))
          }
        }

        // Once stream is complete, call the completion callback with the final content and usage
        if (onComplete) {
          onComplete(fullContent, usageData)
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

/**
 * OpenAI provider configuration
 */
export const openaiProvider: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  description: "OpenAI's GPT models",
  version: '1.0.0',
  models: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-5.2',
    'gpt-5.4',
    'o3-mini',
    'o4-mini',
    'o3',
    'o1-mini',
    'o1-preview',
  ],
  defaultModel: DEFAULT_MODEL,

  executeRequest: async (
    request: ProviderRequest
  ): Promise<ProviderResponse | ReadableStream<any> | StreamingExecution> => {
    logger.info('Preparing OpenAI request', {
      model: request.model || DEFAULT_MODEL,
      hasSystemPrompt: !!request.systemPrompt,
      hasMessages: !!request.messages?.length,
      hasTools: !!request.tools?.length,
      toolCount: request.tools?.length || 0,
      hasResponseFormat: !!request.responseFormat,
      stream: !!request.stream,
    })

    // API key is now handled server-side before this function is called
    const openai = new OpenAI({
      apiKey: request.apiKey,
      dangerouslyAllowBrowser: true, // Safe: This code runs server-side only
    })

    // Start with an empty array for all messages
    const allMessages = []

    // Add system prompt if present
    if (request.systemPrompt) {
      const modelName = request.model || DEFAULT_MODEL
      allMessages.push({
        role: isOpenAIReasoningModel(modelName) ? 'developer' : 'system',
        content: request.systemPrompt,
      })
    }

    // Add conversation history messages BEFORE the current context
    // This ensures proper conversation flow: system -> history -> current message
    if (request.messages && request.messages.length > 0) {
      allMessages.push(...request.messages)
    }

    // Add current user message (context) AFTER history
    if (request.context) {
      allMessages.push({
        role: 'user',
        content: request.context,
      })
    }

    // Transform tools to OpenAI format if provided
    const tools = request.tools?.length
      ? request.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.id,
            description: tool.description,
            parameters: tool.parameters,
          },
        }))
      : undefined

    // Build the request payload
    const payload: any = {
      model: request.model || DEFAULT_MODEL,
      messages: allMessages,
    }

    // Add optional parameters - reasoning models don't support temperature
    const payloadModel = request.model || DEFAULT_MODEL
    if (request.temperature !== undefined && !isOpenAIReasoningModel(payloadModel)) {
      payload.temperature = request.temperature
    }

    // Reasoning models use max_completion_tokens instead of max_tokens
    if (request.maxTokens !== undefined) {
      if (isOpenAIReasoningModel(payloadModel)) {
        payload.max_completion_tokens = request.maxTokens
      } else {
        payload.max_tokens = request.maxTokens
      }
    }

    // Add response format for structured output if specified
    if (request.responseFormat) {
      // Use OpenAI's JSON schema format
      payload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: request.responseFormat.name || 'response_schema',
          schema: request.responseFormat.schema || request.responseFormat,
          strict: request.responseFormat.strict !== false,
        },
      }

      logger.info('Added JSON schema response format to request')
    }

    // Handle tools and tool usage control
    let preparedTools: ReturnType<typeof prepareToolsWithUsageControl> | null = null

    if (tools?.length) {
      preparedTools = prepareToolsWithUsageControl(tools, request.tools, logger, 'openai')
      const { tools: filteredTools, toolChoice } = preparedTools

      if (filteredTools?.length && toolChoice) {
        payload.tools = filteredTools
        payload.tool_choice = toolChoice

        logger.info(`OpenAI request configuration:`, {
          toolCount: filteredTools.length,
          toolChoice:
            typeof toolChoice === 'string'
              ? toolChoice
              : toolChoice.type === 'function'
                ? `force:${toolChoice.function.name}`
                : toolChoice.type === 'tool'
                  ? `force:${toolChoice.name}`
                  : toolChoice.type === 'any'
                    ? `force:${toolChoice.any?.name || 'unknown'}`
                    : 'unknown',
          model: request.model || DEFAULT_MODEL,
        })
      }
    }

    // Start execution timer for the entire provider execution
    const providerStartTime = Date.now()
    const providerStartTimeISO = new Date(providerStartTime).toISOString()

    try {
      // Check if we can stream directly (no tools required)
      if (request.stream && (!tools || tools.length === 0)) {
        logger.info('Using streaming response for OpenAI request')

        // Create a streaming request with token usage tracking
        const streamResponse = await openai.chat.completions.create({
          ...payload,
          stream: true,
          stream_options: { include_usage: true },
        })

        // Start collecting token usage from the stream
        let tokenUsage = {
          prompt: 0,
          completion: 0,
          total: 0,
        }

        let streamContent = ''

        // Create a StreamingExecution response with a callback to update content and tokens
        const streamingResult = {
          stream: createReadableStreamFromOpenAIStream(streamResponse, (content, usage) => {
            // Update the execution data with the final content and token usage
            streamContent = content
            streamingResult.execution.output.response.content = content

            // Update the timing information with the actual completion time
            const streamEndTime = Date.now()
            const streamEndTimeISO = new Date(streamEndTime).toISOString()

            if (streamingResult.execution.output.response.providerTiming) {
              streamingResult.execution.output.response.providerTiming.endTime = streamEndTimeISO
              streamingResult.execution.output.response.providerTiming.duration =
                streamEndTime - providerStartTime

              // Update the time segment as well
              if (streamingResult.execution.output.response.providerTiming.timeSegments?.[0]) {
                streamingResult.execution.output.response.providerTiming.timeSegments[0].endTime =
                  streamEndTime
                streamingResult.execution.output.response.providerTiming.timeSegments[0].duration =
                  streamEndTime - providerStartTime
              }
            }

            // Update token usage if available from the stream
            if (usage) {
              const newTokens = {
                prompt: usage.prompt_tokens || tokenUsage.prompt,
                completion: usage.completion_tokens || tokenUsage.completion,
                total: usage.total_tokens || tokenUsage.total,
              }

              streamingResult.execution.output.response.tokens = newTokens
            }
            // We don't need to estimate tokens here as execution-logger.ts will handle that
          }),
          execution: {
            success: true,
            output: {
              response: {
                content: '', // Will be filled by the stream completion callback
                model: request.model,
                tokens: tokenUsage,
                toolCalls: undefined,
                providerTiming: {
                  startTime: providerStartTimeISO,
                  endTime: new Date().toISOString(),
                  duration: Date.now() - providerStartTime,
                  timeSegments: [
                    {
                      type: 'model',
                      name: 'Streaming response',
                      startTime: providerStartTime,
                      endTime: Date.now(),
                      duration: Date.now() - providerStartTime,
                    },
                  ],
                },
                // Cost will be calculated in execution-logger.ts
              },
            },
            logs: [], // No block logs for direct streaming
            metadata: {
              startTime: providerStartTimeISO,
              endTime: new Date().toISOString(),
              duration: Date.now() - providerStartTime,
            },
          },
        } as StreamingExecution

        // Return the streaming execution object with explicit casting
        return streamingResult as StreamingExecution
      }

      // Make the initial API request
      const initialCallTime = Date.now()

      // Track the original tool_choice for forced tool tracking
      const originalToolChoice = payload.tool_choice

      // Track forced tools and their usage
      const forcedTools = preparedTools?.forcedTools || []
      let usedForcedTools: string[] = []

      // Helper function to check for forced tool usage in responses
      const checkForForcedToolUsage = (
        response: any,
        toolChoice: string | { type: string; function?: { name: string }; name?: string; any?: any }
      ) => {
        if (typeof toolChoice === 'object' && response.choices[0]?.message?.tool_calls) {
          const toolCallsResponse = response.choices[0].message.tool_calls
          const result = trackForcedToolUsage(
            toolCallsResponse,
            toolChoice,
            logger,
            'openai',
            forcedTools,
            usedForcedTools
          )
          hasUsedForcedTool = result.hasUsedForcedTool
          usedForcedTools = result.usedForcedTools
        }
      }

      let currentResponse = await openai.chat.completions.create(payload)
      const firstResponseTime = Date.now() - initialCallTime

      let content = currentResponse.choices[0]?.message?.content || ''
      // Collect token information but don't calculate costs - that will be done in execution-logger.ts
      let tokens = {
        prompt: currentResponse.usage?.prompt_tokens || 0,
        completion: currentResponse.usage?.completion_tokens || 0,
        total: currentResponse.usage?.total_tokens || 0,
      }
      let toolCalls = []
      let toolResults = []
      let currentMessages = [...allMessages]
      let iterationCount = 0
      const MAX_ITERATIONS = 10 // Prevent infinite loops

      // Track time spent in model vs tools
      let modelTime = firstResponseTime
      let toolsTime = 0

      // Track if a forced tool has been used
      let hasUsedForcedTool = false

      // Track each model and tool call segment with timestamps
      const timeSegments: TimeSegment[] = [
        {
          type: 'model',
          name: 'Initial response',
          startTime: initialCallTime,
          endTime: initialCallTime + firstResponseTime,
          duration: firstResponseTime,
        },
      ]

      // Check if a forced tool was used in the first response
      checkForForcedToolUsage(currentResponse, originalToolChoice)

      while (iterationCount < MAX_ITERATIONS) {
        // Check for tool calls
        const toolCallsInResponse = currentResponse.choices[0]?.message?.tool_calls
        if (!toolCallsInResponse || toolCallsInResponse.length === 0) {
          break
        }

        logger.info(
          `Processing ${toolCallsInResponse.length} tool calls (iteration ${iterationCount + 1}/${MAX_ITERATIONS})`
        )

        // Track time for tool calls in this batch
        const toolsStartTime = Date.now()

        // Add the assistant message with ALL tool calls first (OpenAI requires this format)
        currentMessages.push({
          role: 'assistant',
          content: currentResponse.choices[0]?.message?.content || null,
          tool_calls: toolCallsInResponse.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        })

        // Process each tool call and add results
        for (const toolCall of toolCallsInResponse) {
          if (toolCall?.type !== 'function') {
            // Still need to add a tool result for non-function calls
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: 'Unsupported tool call type' }),
            })
            continue
          }
          try {
            const toolName = toolCall.function.name
            const toolArgs = JSON.parse(toolCall.function.arguments)

            // Get the tool from the tools registry
            const tool = request.tools?.find((t) => t.id === toolName)
            if (!tool) {
              logger.warn(`Tool not found: ${toolName}`)
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: `Tool "${toolName}" not found` }),
              })
              continue
            }

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

            if (!result.success) {
              logger.warn(`Tool ${toolName} failed:`, result.error)
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: result.error || 'Tool execution failed' }),
              })
              continue
            }

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

            // Add tool result message
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result.output),
            })
          } catch (error) {
            logger.error('Error processing tool call:', {
              error,
              toolName: (toolCall as any)?.function?.name,
            })
            // Always add a tool result even on error — OpenAI API requires it
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
              }),
            })
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

        // Update tool_choice based on which forced tools have been used
        if (typeof originalToolChoice === 'object' && hasUsedForcedTool && forcedTools.length > 0) {
          // If we have remaining forced tools, get the next one to force
          const remainingTools = forcedTools.filter((tool) => !usedForcedTools.includes(tool))

          if (remainingTools.length > 0) {
            // Force the next tool
            nextPayload.tool_choice = {
              type: 'function',
              function: { name: remainingTools[0] },
            }
            logger.info(`Forcing next tool: ${remainingTools[0]}`)
          } else {
            // All forced tools have been used, switch to auto
            nextPayload.tool_choice = 'auto'
            logger.info('All forced tools have been used, switching to auto tool_choice')
          }
        }

        // Time the next model call
        const nextModelStartTime = Date.now()

        // Make the next request
        currentResponse = await openai.chat.completions.create(nextPayload)

        // Check if any forced tools were used in this response
        checkForForcedToolUsage(currentResponse, nextPayload.tool_choice)

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
        if (currentResponse.choices[0]?.message?.content) {
          content = currentResponse.choices[0].message.content
        }

        // Update token counts
        if (currentResponse.usage) {
          tokens.prompt += currentResponse.usage.prompt_tokens || 0
          tokens.completion += currentResponse.usage.completion_tokens || 0
          tokens.total += currentResponse.usage.total_tokens || 0
        }

        iterationCount++
      }

      // After all tool processing complete, if streaming was requested and we have messages, use streaming for the final response
      if (request.stream && iterationCount > 0) {
        logger.info('Using streaming for final response after tool calls')

        // When streaming after tool calls with forced tools, make sure tool_choice is set to 'auto'
        // This prevents OpenAI API from trying to force tool usage again in the final streaming response
        const streamingPayload = {
          ...payload,
          messages: currentMessages,
          tool_choice: 'auto', // Always use 'auto' for the streaming response after tool calls
          stream: true,
          stream_options: { include_usage: true },
        }

        const streamResponse = await openai.chat.completions.create(streamingPayload)

        // Create the StreamingExecution object with all collected data
        let streamContent = ''

        const streamingResult = {
          stream: createReadableStreamFromOpenAIStream(streamResponse, (content, usage) => {
            // Update the execution data with the final content and token usage
            streamContent = content
            streamingResult.execution.output.response.content = content

            // Update token usage if available from the stream
            if (usage) {
              const newTokens = {
                prompt: usage.prompt_tokens || tokens.prompt,
                completion: usage.completion_tokens || tokens.completion,
                total: usage.total_tokens || tokens.total,
              }

              streamingResult.execution.output.response.tokens = newTokens
            }
          }),
          execution: {
            success: true,
            output: {
              response: {
                content: '', // Will be filled by the callback
                model: request.model,
                tokens: {
                  prompt: tokens.prompt,
                  completion: tokens.completion,
                  total: tokens.total,
                },
                toolCalls:
                  toolCalls.length > 0
                    ? {
                        list: toolCalls,
                        count: toolCalls.length,
                      }
                    : undefined,
                providerTiming: {
                  startTime: providerStartTimeISO,
                  endTime: new Date().toISOString(),
                  duration: Date.now() - providerStartTime,
                  modelTime: modelTime,
                  toolsTime: toolsTime,
                  firstResponseTime: firstResponseTime,
                  iterations: iterationCount + 1,
                  timeSegments: timeSegments,
                },
                // Cost will be calculated in execution-logger.ts
              },
            },
            logs: [], // No block logs at provider level
            metadata: {
              startTime: providerStartTimeISO,
              endTime: new Date().toISOString(),
              duration: Date.now() - providerStartTime,
            },
          },
        } as StreamingExecution

        // Return the streaming execution object with explicit casting
        return streamingResult as StreamingExecution
      }

      // Calculate overall timing
      const providerEndTime = Date.now()
      const providerEndTimeISO = new Date(providerEndTime).toISOString()
      const totalDuration = providerEndTime - providerStartTime

      return {
        content,
        model: request.model,
        tokens,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        timing: {
          startTime: providerStartTimeISO,
          endTime: providerEndTimeISO,
          duration: totalDuration,
          modelTime: modelTime,
          toolsTime: toolsTime,
          firstResponseTime: firstResponseTime,
          iterations: iterationCount + 1,
          timeSegments: timeSegments,
        },
        // We're not calculating cost here as it will be handled in execution-logger.ts
      }
    } catch (error) {
      // Include timing information even for errors
      const providerEndTime = Date.now()
      const providerEndTimeISO = new Date(providerEndTime).toISOString()
      const totalDuration = providerEndTime - providerStartTime

      logger.error('Error in OpenAI request:', {
        error,
        duration: totalDuration,
        model: request.model,
      })

      // Check if this is a model access error (403) and try fallback
      const errorMessage = error instanceof Error ? error.message : String(error)
      const is403Error =
        errorMessage.includes('403') || errorMessage.includes('does not have access')
      const isModelError = errorMessage.includes('model')

      if (is403Error && isModelError && request.model !== DEFAULT_MODEL) {
        // Provide specific tier requirement information
        const tierInfo = getTierRequirement(request.model)
        logger.warn(
          `Model ${request.model} not accessible (${tierInfo}), falling back to ${DEFAULT_MODEL}. Please check your OpenAI API tier/access.`
        )

        // Retry with fallback model
        try {
          return await openaiProvider.executeRequest({
            ...request,
            model: DEFAULT_MODEL,
          })
        } catch (fallbackError) {
          logger.error(`Fallback to ${DEFAULT_MODEL} also failed:`, fallbackError)
          // Continue to throw the original error
        }
      }

      // Create a new error with timing information
      const enhancedError = new Error(errorMessage)
      // @ts-ignore - Adding timing property to the error
      enhancedError.timing = {
        startTime: providerStartTimeISO,
        endTime: providerEndTimeISO,
        duration: totalDuration,
      }

      throw enhancedError
    }
  },
}
