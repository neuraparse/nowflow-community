import { CohereIcon } from '@/components/icons'
import { createOperationDropdown, createParamTransformer, defineBlock } from '../helpers'

export const CohereBlock = defineBlock({
  type: 'cohere',
  name: 'Cohere',
  description: 'Enterprise-grade NLP and text generation AI',
  longDescription:
    'Integrate with Cohere for advanced natural language processing, text generation, embeddings, semantic search, and content classification. Perfect for enterprise RAG applications with API key authentication.',
  category: 'tools',
  bgColor: '#39594D',
  icon: CohereIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Cohere API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Cohere API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'generate', label: 'Generate Text' },
        { id: 'chat', label: 'Chat Completion' },
        { id: 'embed', label: 'Create Embeddings' },
        { id: 'classify', label: 'Classify Text' },
        { id: 'summarize', label: 'Summarize Text' },
        { id: 'rerank', label: 'Rerank Results' },
        { id: 'detect_language', label: 'Detect Language' },
      ],
      defaultValue: 'generate',
    }),
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'command', label: 'Command (Latest)' },
        { id: 'command-light', label: 'Command Light' },
        { id: 'command-r', label: 'Command R' },
        { id: 'command-r-plus', label: 'Command R+' },
      ],
      value: () => 'command',
      condition: { field: 'operation', value: ['generate', 'chat', 'summarize'] },
    },
    {
      id: 'prompt',
      title: 'Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter your prompt or text to process',
      condition: {
        field: 'operation',
        value: ['generate', 'chat', 'classify', 'summarize', 'detect_language'],
      },
    },
    {
      id: 'texts',
      title: 'Texts to Embed (JSON Array)',
      type: 'long-input',
      layout: 'full',
      placeholder: '["Text 1", "Text 2", "Text 3"]',
      condition: { field: 'operation', value: 'embed' },
    },
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter search query for reranking',
      condition: { field: 'operation', value: 'rerank' },
    },
    {
      id: 'documents',
      title: 'Documents to Rerank (JSON Array)',
      type: 'long-input',
      layout: 'full',
      placeholder: '[{"text": "doc1"}, {"text": "doc2"}]',
      condition: { field: 'operation', value: 'rerank' },
    },
    {
      id: 'max_tokens',
      title: 'Max Tokens',
      type: 'short-input',
      layout: 'half',
      placeholder: '1000',
      condition: { field: 'operation', value: ['generate', 'chat', 'summarize'] },
    },
    {
      id: 'temperature',
      title: 'Temperature',
      type: 'short-input',
      layout: 'half',
      placeholder: '0.7',
      condition: { field: 'operation', value: ['generate', 'chat'] },
    },
  ],
  tools: {
    access: ['cohere_api'],
    config: {
      tool: () => 'cohere_api',
      params: createParamTransformer({
        texts: 'json',
        documents: 'json',
        max_tokens: 'number',
        temperature: 'number',
      }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    model: { type: 'string', required: false },
    prompt: { type: 'string', required: false },
    texts: { type: 'string', required: false },
    query: { type: 'string', required: false },
    documents: { type: 'string', required: false },
    max_tokens: { type: 'string', required: false },
    temperature: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
