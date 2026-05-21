import { DatabaseIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface RAGAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    sources: Array<{
      title: string
      url?: string
      content: string
      relevance: number
    }>
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const RAGAgentBlock: BlockConfig<RAGAgentResponse> = {
  type: 'rag_agent',
  name: 'RAG Agent',
  description: 'Retrieval-Augmented Generation agent',
  longDescription:
    'Create a RAG (Retrieval-Augmented Generation) agent that retrieves information from document sources to provide accurate, grounded responses.',
  category: 'agents',
  bgColor: '#0EA5E9',
  icon: DatabaseIcon,
  subBlocks: [
    {
      id: 'agentProfileId',
      title: 'Agent Profile',
      type: 'agent-profile-selector',
      layout: 'full',
    },
    {
      id: 'systemPrompt',
      title: 'System Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter system prompt for the RAG agent...',
      rows: 5,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'query',
      title: 'Query',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the query to search for information...',
      rows: 3,
    },
    ...getModelSubBlocks(),
    {
      id: 'dataSource',
      title: 'Data Source',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Pinecone', id: 'pinecone' },
        { label: 'Supabase', id: 'supabase' },
        { label: 'MongoDB', id: 'mongodb' },
        { label: 'Airtable', id: 'airtable' },
        { label: 'Custom', id: 'custom' },
      ],
    },
    {
      id: 'dataSourceConfig',
      title: 'Data Source Configuration',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder:
        '{\n  "connectionString": "your-connection-string",\n  "collection": "your-collection-name"\n}',
    },
    {
      id: 'retrievalOptions',
      title: 'Retrieval Options',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "topK": 5,\n  "similarityThreshold": 0.7,\n  "includeMetadata": true\n}',
    },
    {
      id: 'citeSources',
      title: 'Cite Sources',
      type: 'switch',
      layout: 'half',
    },
    // Memory Configuration (NEW - opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'openai_chat',
      'anthropic_chat',
      'google_chat',
      'xai_chat',
      'deepseek_chat',
      'pinecone',
      'supabase',
      'mongodb',
      'airtable',
    ],
    config: {
      tool: (params: Record<string, any>) => {
        const model = params.model || getDefaultModel('openai')
        if (!model) {
          throw new Error('No model selected')
        }
        const tool = getAllModelProviders()[model]
        if (!tool) {
          throw new Error(`Invalid model selected: ${model}`)
        }
        return tool
      },
      params: (params: Record<string, any>) => {
        // Parse configurations
        const dataSourceType = params.dataSource || 'pinecone'
        const dataSourceConfig =
          typeof params.dataSourceConfig === 'string'
            ? JSON.parse(params.dataSourceConfig)
            : params.dataSourceConfig
        const retrievalOptions =
          typeof params.retrievalOptions === 'string'
            ? JSON.parse(params.retrievalOptions)
            : params.retrievalOptions || {}
        const citeSources = params.citeSources || false

        // Build enhanced system prompt
        const baseSystemPrompt = params.systemPrompt || ''
        const instructions: string[] = []

        if (baseSystemPrompt) {
          instructions.push(baseSystemPrompt)
          instructions.push('')
        }

        instructions.push('RAG Agent Instructions:')
        instructions.push(`Data Source: ${dataSourceType}`)
        instructions.push(`Top K results: ${retrievalOptions.topK || 5}`)
        instructions.push(`Similarity threshold: ${retrievalOptions.similarityThreshold || 0.7}`)
        instructions.push(`Cite sources: ${citeSources ? 'yes' : 'no'}`)

        instructions.push(
          '\nYou are a RAG (Retrieval-Augmented Generation) agent. Use the retrieved information from the data source to provide accurate, grounded responses.'
        )

        if (citeSources) {
          instructions.push(
            'Always cite your sources with proper references to the retrieved documents.'
          )
        }

        instructions.push(
          '\nThe user will provide a query. Retrieve relevant information and answer based on the retrieved context.'
        )

        const enhancedSystemPrompt = instructions.join('\n')

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.query, // Map query to context
          dataSourceType,
          dataSourceConfig,
          retrievalOptions,
          citeSources,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    query: { type: 'string', required: true },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    dataSource: { type: 'string', required: true },
    dataSourceConfig: { type: 'json', required: true },
    retrievalOptions: { type: 'json', required: false },
    temperature: { type: 'number', required: false },
    citeSources: { type: 'boolean', required: false },
    // Memory Configuration (NEW - opt-in, works for all agent types)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        sources: 'json',
        tokens: 'json',
      },
    },
  },
}
