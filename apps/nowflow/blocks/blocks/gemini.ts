import { GoogleIcon } from '@/components/icons'
import { createParamTransformer } from '../helpers'
import { BlockConfig } from '../types'

export const GeminiBlock: BlockConfig = {
  type: 'gemini',
  name: 'Google Gemini',
  description: 'Access Google Gemini AI for multimodal generation',
  longDescription:
    'Integrate with Google Gemini AI to generate text, analyze images, create code, and access multimodal AI capabilities. Use Gemini Pro for advanced reasoning and Gemini Flash for fast responses with live web data integration.',
  category: 'tools',
  bgColor: '#4285F4',
  icon: GoogleIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Google Account',
      type: 'oauth-input',
      layout: 'full',
      provider: 'google',
      serviceId: 'google-gemini',
      requiredScopes: ['https://www.googleapis.com/auth/generative-language.retriever'],
      placeholder: 'Select Google account',
    },
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { id: 'gemini-pro', label: 'Gemini Pro' },
        { id: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
      ],
      value: () => 'gemini-2.0-flash-exp',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'generate_text', label: 'Generate Text' },
        { id: 'analyze_image', label: 'Analyze Image' },
        { id: 'generate_code', label: 'Generate Code' },
        { id: 'chat', label: 'Chat Completion' },
        { id: 'embed_text', label: 'Embed Text' },
      ],
      value: () => 'generate_text',
    },
    {
      id: 'prompt',
      title: 'Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter your prompt here',
      condition: { field: 'operation', value: ['generate_text', 'generate_code', 'chat'] },
    },
    {
      id: 'imageUrl',
      title: 'Image URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://example.com/image.jpg',
      condition: { field: 'operation', value: 'analyze_image' },
    },
    {
      id: 'imagePrompt',
      title: 'Image Analysis Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Describe this image in detail',
      condition: { field: 'operation', value: 'analyze_image' },
    },
    {
      id: 'temperature',
      title: 'Temperature',
      type: 'short-input',
      layout: 'half',
      placeholder: '0.7',
      condition: { field: 'operation', value: ['generate_text', 'generate_code', 'chat'] },
    },
    {
      id: 'maxTokens',
      title: 'Max Tokens',
      type: 'short-input',
      layout: 'half',
      placeholder: '2048',
      condition: { field: 'operation', value: ['generate_text', 'generate_code', 'chat'] },
    },
  ],
  tools: {
    access: ['gemini_api'],
    config: {
      tool: () => 'gemini_api',
      params: createParamTransformer({
        temperature: 'number',
        maxTokens: 'number',
      }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    model: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    prompt: { type: 'string', required: false },
    imageUrl: { type: 'string', required: false },
    imagePrompt: { type: 'string', required: false },
    temperature: { type: 'string', required: false },
    maxTokens: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
