import { AnthropicIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const AnthropicBlock: BlockConfig = {
  type: 'anthropic',
  name: 'Anthropic Claude',
  description: 'Generate text with Claude AI models.',
  longDescription:
    'Connect to Anthropic Claude API to generate high-quality text using Claude 4 Opus, Sonnet, and other models.',
  category: 'tools',
  bgColor: '#D4A27F',
  icon: AnthropicIcon,
  subBlocks: [
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'API key',
      password: true,
    },
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: 'Claude Opus 4.6', id: 'claude-opus-4-6' },
        { label: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6' },
        { label: 'Claude Opus 4.5', id: 'claude-opus-4-5-20251101' },
        { label: 'Claude Sonnet 4.5', id: 'claude-sonnet-4-5-20250929' },
        { label: 'Claude Haiku 4.5', id: 'claude-haiku-4-5-20251001' },
      ],
    },
    {
      id: 'systemPrompt',
      title: 'System Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'You are a helpful assistant...',
    },
    {
      id: 'prompt',
      title: 'User Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter your prompt here...',
    },
    {
      id: 'maxTokens',
      title: 'Max Tokens',
      type: 'short-input',
      layout: 'half',
      placeholder: '1024',
    },
    {
      id: 'temperature',
      title: 'Temperature',
      type: 'short-input',
      layout: 'half',
      placeholder: '1.0 (0-1)',
    },
  ],
  tools: {
    access: ['anthropic_chat'],
    config: {
      tool: () => 'anthropic_chat',
    },
  },
  inputs: {
    apiKey: { type: 'string', required: true },
    model: { type: 'string', required: true },
    prompt: { type: 'string', required: true },
    systemPrompt: { type: 'string', required: false },
    maxTokens: { type: 'number', required: false },
    temperature: { type: 'number', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        content: 'string',
        usage: 'json',
        model: 'string',
        stopReason: 'string',
      },
    },
  },
}
