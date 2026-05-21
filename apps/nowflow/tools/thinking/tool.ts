import { ToolConfig } from '../types'
import { ThinkingToolParams, ThinkingToolResponse } from './types'

export const thinkingTool: ToolConfig<ThinkingToolParams, ThinkingToolResponse> = {
  id: 'thinking_tool',
  name: 'Thinking Tool',
  description:
    'Performs extended reasoning using Claude (claude-sonnet-4-6, claude-opus-4) or OpenAI reasoning models (o3, o4-mini). Returns both the internal thought process and the final response.',
  version: '2.0.0',

  params: {
    prompt: {
      type: 'string',
      required: false,
      description: 'The question or task for the model to reason about.',
    },
    systemPrompt: {
      type: 'string',
      required: false,
      description: 'Optional system prompt to guide reasoning behavior.',
    },
    model: {
      type: 'string',
      required: false,
      description: 'Model to use: claude-sonnet-4-6, claude-opus-4-20250514, o3, o4-mini, etc.',
    },
    apiKey: {
      type: 'string',
      required: false,
      description: 'API key for the selected model provider.',
    },
    thinkingBudget: {
      type: 'number',
      required: false,
      description: 'Token budget for extended thinking (1024–16000). Anthropic only.',
    },
    showThinkingProcess: {
      type: 'boolean',
      required: false,
      description: 'Whether to include the thinking process in the output.',
    },
    // Legacy param kept for backward compatibility
    thought: {
      type: 'string',
      required: false,
      description: 'Legacy: thought process text (deprecated, use prompt instead).',
    },
  },

  request: {
    url: '/api/ai/thinking',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params: ThinkingToolParams) => {
      // If only legacy "thought" is provided (no model/apiKey), use simple acknowledgment mode
      if (params.thought && !params.model && !params.apiKey) {
        return {
          prompt: params.thought,
          model: '__legacy__',
          apiKey: '__legacy__',
          legacyMode: true,
        }
      }
      return {
        prompt: params.prompt || params.thought || '',
        systemPrompt: params.systemPrompt,
        model: params.model || '',
        apiKey: params.apiKey || '',
        thinkingBudget: params.thinkingBudget ?? 5000,
        showThinkingProcess: params.showThinkingProcess !== false,
      }
    },
    isInternalRoute: true,
  },

  transformResponse: async (response: Response) => {
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        output: {
          thinkingContent: undefined,
          response: '',
          model: '',
        },
        error: data.error || `Thinking request failed with status ${response.status}`,
      } as ThinkingToolResponse
    }

    return {
      success: true,
      output: {
        thinkingContent: data.thinkingContent,
        response: data.response || '',
        model: data.model || '',
        tokens: data.tokens,
        // Legacy compat for blocks that reference acknowledgedThought
        acknowledgedThought: data.response || data.thinkingContent || '',
      },
    }
  },
}
