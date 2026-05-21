import { BrainIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface ThinkingToolResponse extends ToolResponse {
  output: {
    thinkingContent?: string
    response: string
    model: string
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
    // Legacy compat
    acknowledgedThought?: string
  }
}

export const ThinkingBlock: BlockConfig<ThinkingToolResponse> = {
  type: 'thinking',
  name: 'Thinking',
  description: 'Extended reasoning with step-by-step thought process.',
  longDescription:
    "Uses extended thinking to show the model's internal reasoning process before producing a final answer. Supports Anthropic Claude (claude-sonnet-4-6, claude-opus-4) with native extended thinking tokens, and OpenAI o-series reasoning models (o3, o4-mini). The thinking process and final response are both available as outputs.",
  category: 'blocks',
  bgColor: '#181C1E',
  icon: BrainIcon,

  subBlocks: [
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6' },
        { label: 'Claude Opus 4', id: 'claude-opus-4-20250514' },
        { label: 'Claude Sonnet 4', id: 'claude-sonnet-4-20250514' },
        { label: 'OpenAI o4-mini', id: 'o4-mini' },
        { label: 'OpenAI o3', id: 'o3' },
      ],
    },
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'half',
      placeholder: 'API key',
      password: true,
    },
    {
      id: 'thinkingBudget',
      title: 'Thinking Budget (tokens)',
      type: 'slider',
      layout: 'half',
      min: 1024,
      max: 16000,
      condition: {
        field: 'model',
        value: ['claude-sonnet-4-6', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514'],
      },
    },
    {
      id: 'showThinkingProcess',
      title: 'Show Thinking Process',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'prompt',
      title: 'Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'What should the model reason about? Ask a question or describe a task...',
    },
    {
      id: 'systemPrompt',
      title: 'System Prompt (optional)',
      type: 'long-input',
      layout: 'full',
      placeholder: "Optional instructions to guide the model's reasoning style...",
      hidden: true,
    },
  ],

  inputs: {
    model: {
      type: 'string',
      required: true,
      description: 'Model to use for extended thinking',
    },
    apiKey: {
      type: 'string',
      required: true,
      description: 'API key for the selected provider',
    },
    prompt: {
      type: 'string',
      required: true,
      description: 'The question or task to reason about',
    },
    systemPrompt: {
      type: 'string',
      required: false,
      description: 'Optional system prompt',
    },
    thinkingBudget: {
      type: 'number',
      required: false,
      description: 'Extended thinking token budget (Anthropic only)',
    },
    showThinkingProcess: {
      type: 'boolean',
      required: false,
      description: 'Whether to include reasoning steps in the output',
    },
  },

  outputs: {
    response: {
      type: {
        thinkingContent: 'string',
        response: 'string',
        model: 'string',
        tokens: 'json',
        acknowledgedThought: 'string',
      },
    },
  },

  tools: {
    access: ['thinking_tool'],
    config: {
      tool: () => 'thinking_tool',
      params: (params) => ({
        prompt: params.prompt,
        systemPrompt: params.systemPrompt,
        model: params.model,
        apiKey: params.apiKey,
        thinkingBudget: params.thinkingBudget ? parseInt(String(params.thinkingBudget)) : 5000,
        showThinkingProcess: params.showThinkingProcess !== false,
      }),
    },
  },
}
