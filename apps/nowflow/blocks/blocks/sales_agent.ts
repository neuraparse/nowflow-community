import { TrendingUpIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface SalesAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    leadScore: number
    salesStage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase'
    nextActions: string[]
    objections: string[]
    opportunities: string[]
    recommendedProducts: string[]
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const SalesAgentBlock: BlockConfig<SalesAgentResponse> = {
  type: 'sales_agent',
  name: 'Sales Agent',
  description: 'AI-powered sales representative',
  longDescription:
    'Create an intelligent sales agent that can qualify leads, handle objections, recommend products, and guide prospects through the sales funnel with personalized approaches.',
  category: 'agents',
  bgColor: '#10B981',
  icon: TrendingUpIcon,
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
      placeholder: 'You are a professional sales representative...',
      rows: 4,
      value:
        () => `You are a professional sales representative with expertise in consultative selling. Your role is to:
1. Qualify leads and assess their needs
2. Build rapport and trust with prospects
3. Identify pain points and present solutions
4. Handle objections professionally
5. Guide prospects through the sales funnel
6. Recommend appropriate products/services
7. Close deals when appropriate

Always focus on providing value and solving customer problems rather than just selling.`,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'prospectMessage',
      title: 'Prospect Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the prospect inquiry or conversation...',
      rows: 4,
    },
    {
      id: 'prospectProfile',
      title: 'Prospect Profile',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter prospect information: company, role, industry, pain points...',
      rows: 3,
    },
    ...getModelSubBlocks(),
    {
      id: 'productCatalog',
      title: 'Product Catalog',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: `[
  {
    "name": "Product A",
    "description": "Enterprise solution for large companies",
    "price": "$999/month",
    "features": ["Feature 1", "Feature 2"],
    "targetAudience": "Enterprise",
    "useCases": ["Use case 1", "Use case 2"]
  }
]`,
    },
    {
      id: 'salesPlaybook',
      title: 'Sales Playbook',
      type: 'long-input',
      layout: 'full',
      placeholder:
        'Enter sales strategies, common objections and responses, qualification criteria...',
      rows: 4,
    },
    {
      id: 'salesGoals',
      title: 'Sales Goals',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Lead Qualification', id: 'qualification' },
        { label: 'Product Demo', id: 'demo' },
        { label: 'Proposal', id: 'proposal' },
        { label: 'Close Deal', id: 'close' },
        { label: 'Upsell/Cross-sell', id: 'upsell' },
      ],
    },
    {
      id: 'includeScoring',
      title: 'Include Lead Scoring',
      type: 'switch',
      layout: 'half',
    },
    // Tools Configuration
    {
      id: 'tools',
      title: 'Tools',
      type: 'tool-input',
      layout: 'full',
    },
    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),
    // Memory Configuration (opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'openai_chat',
      'anthropic_chat',
      'google_chat',
      'xai_chat',
      'deepseek_chat',
      // CRM integrations
      'hubspot_contacts',
      'salesforce_opportunities',
      'pipedrive_deals',
      // Email
      'gmail_send',
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
        // Parse product catalog
        const productCatalog =
          typeof params.productCatalog === 'string'
            ? JSON.parse(params.productCatalog)
            : params.productCatalog || []

        // Build enhanced system prompt
        const baseSystemPrompt = params.systemPrompt || ''
        const salesGoals = params.salesGoals || 'qualification'
        const includeScoring = params.includeScoring || false
        const prospectProfile = params.prospectProfile || ''
        const salesPlaybook = params.salesPlaybook || ''

        const instructions: string[] = []

        if (salesGoals) {
          instructions.push(`Sales Goal: ${salesGoals}`)
        }
        if (prospectProfile) {
          instructions.push(`Prospect Profile: ${prospectProfile}`)
        }
        if (salesPlaybook) {
          instructions.push(`Sales Playbook: ${salesPlaybook}`)
        }
        if (productCatalog && productCatalog.length > 0) {
          instructions.push(`Available Products: ${JSON.stringify(productCatalog, null, 2)}`)
        }
        if (includeScoring) {
          instructions.push('Include lead scoring (0-100) in your response')
        }

        const enhancedSystemPrompt = `${baseSystemPrompt}

Sales Instructions:
${instructions.join('\n')}

The user will provide a prospect message. Respond professionally based on the above instructions.`

        // Handle tools array for agent execution
        if (params.tools && Array.isArray(params.tools)) {
          const transformedTools = params.tools
            .filter((tool: any) => (tool.usageControl || 'auto') !== 'none')
            .map((tool: any) => ({
              id: tool.type === 'custom-tool' ? tool.schema?.function?.name : tool.operation,
              name: tool.title,
              description: tool.type === 'custom-tool' ? tool.schema?.function?.description : '',
              params: tool.params || {},
              parameters: tool.type === 'custom-tool' ? tool.schema?.function?.parameters : {},
              usageControl: tool.usageControl || 'auto',
            }))

          return {
            ...params,
            systemPrompt: enhancedSystemPrompt,
            context: params.prospectMessage,
            tools: transformedTools,
            productCatalog,
            salesGoals,
            includeScoring,
          }
        }

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.prospectMessage,
          productCatalog,
          salesGoals,
          includeScoring,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    prospectMessage: { type: 'string', required: true },
    prospectProfile: { type: 'string', required: false },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    temperature: { type: 'number', required: false },
    productCatalog: { type: 'json', required: false },
    salesPlaybook: { type: 'string', required: false },
    salesGoals: { type: 'string', required: false },
    includeScoring: { type: 'boolean', required: false },
    tools: { type: 'json', required: false },
    // Knowledge Sources Configuration
    ...knowledgeSourceInputs,
    // Memory Configuration (opt-in, works for all agent types)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        leadScore: 'number',
        salesStage: 'string',
        nextActions: 'json',
        objections: 'json',
        opportunities: 'json',
        recommendedProducts: 'json',
        tokens: 'json',
      },
    },
  },
}
