import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig } from '../types'
import { AnthropicOutput, AnthropicParams } from './types'

const logger = createLogger('Anthropic Claude Tool')

export const anthropicChatTool: ToolConfig<AnthropicParams, AnthropicOutput> = {
  id: 'anthropic_chat',
  name: 'Anthropic Claude',
  description: 'Generate text with Anthropic Claude AI models including Claude 4 Opus and Sonnet.',
  version: '1.0.0',

  params: {
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Anthropic API Key',
    },
    model: {
      type: 'string',
      required: true,
      description: 'Claude model to use',
    },
    prompt: {
      type: 'string',
      required: true,
      description: 'User prompt/message',
    },
    systemPrompt: {
      type: 'string',
      required: false,
      description: 'System prompt to set context and behavior',
    },
    maxTokens: {
      type: 'number',
      required: false,
      description: 'Maximum tokens in response (default: 1024)',
    },
    temperature: {
      type: 'number',
      required: false,
      description: 'Sampling temperature 0-1 (default: 1)',
    },
    topP: {
      type: 'number',
      required: false,
      description: 'Nucleus sampling parameter',
    },
    topK: {
      type: 'number',
      required: false,
      description: 'Top-k sampling parameter',
    },
    stopSequences: {
      type: 'array',
      required: false,
      description: 'Sequences that stop generation',
    },
  },

  request: {
    url: () => API_ENDPOINTS.anthropic.messages,
    method: 'POST',
    headers: (params) => ({
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }),
    body: (params) => {
      const body: any = {
        model: params.model,
        max_tokens: params.maxTokens || 1024,
        messages: [
          {
            role: 'user',
            content: params.prompt,
          },
        ],
      }

      if (params.systemPrompt) {
        body.system = params.systemPrompt
      }

      if (params.temperature !== undefined) {
        body.temperature = params.temperature
      }

      if (params.topP !== undefined) {
        body.top_p = params.topP
      }

      if (params.topK !== undefined) {
        body.top_k = params.topK
      }

      if (params.stopSequences && params.stopSequences.length > 0) {
        body.stop_sequences = params.stopSequences
      }

      return body
    },
  },

  transformResponse: async (response) => {
    const data = await response.json()

    if (!response.ok) {
      logger.error('Anthropic API error:', data)
      throw new Error(data.error?.message || `Anthropic API error: ${response.status}`)
    }

    // Extract text content from response
    const textContent = data.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    return {
      success: true,
      content: textContent,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      model: data.model,
      stopReason: data.stop_reason,
    }
  },

  transformError: (error) => {
    logger.error('Anthropic tool error:', error)
    return `Anthropic Claude failed: ${error.message || 'Unknown error'}`
  },
}
