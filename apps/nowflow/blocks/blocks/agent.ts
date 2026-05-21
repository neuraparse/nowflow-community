import { AgentIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { createLogger } from '@/lib/logs/console-logger'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

const logger = createLogger('AgentBlock')

interface AgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
    toolCalls?: {
      list: Array<{
        name: string
        arguments: Record<string, any>
      }>
      count: number
    }
  }
}

// Helper function to get the tool ID from a block type
const getToolIdFromBlock = (blockType: string): string | undefined => {
  try {
    const { getAllBlocks } = require('@/blocks/registry')
    const blocks = getAllBlocks()
    const block = blocks.find(
      (b: { type: string; tools?: { access?: string[] } }) => b.type === blockType
    )
    return block?.tools?.access?.[0]
  } catch (error) {
    logger.error('Error getting tool ID from block', { error })
    return undefined
  }
}

export const AgentBlock: BlockConfig<AgentResponse> = {
  type: 'agent',
  name: 'Agent',
  description: 'Build an agent',
  longDescription:
    'Create powerful AI agents using any LLM provider with customizable system prompts and tool integrations.',
  category: 'agents',
  bgColor: '#802FFF',
  icon: AgentIcon,
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
      placeholder: 'You are a helpful AI assistant. Be concise and professional.',
      rows: 5,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'context',
      title: 'User Prompt',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter user message here. Use %input% for variables.',
      rows: 3,
    },
    ...getModelSubBlocks(),
    {
      id: 'tools',
      title: 'Tools',
      type: 'tool-input',
      layout: 'full',
    },
    {
      id: 'responseFormat',
      title: 'Response Format (Optional)',
      type: 'code',
      layout: 'full',
      placeholder: `Leave empty for natural language response, or define JSON schema:
{
  "type": "object",
  "properties": {
    "answer": {"type": "string"}
  },
  "additionalProperties": false
}`,
      language: 'json',
      generationType: 'json-schema',
    },

    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),

    // Memory Configuration (opt-in, works across all use cases)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'openai_chat',
      'anthropic_chat',
      'google_chat',
      'xai_chat',
      'deepseek_chat',
      'deepseek_reasoner',
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
        // If tools array is provided, handle tool usage control
        if (params.tools && Array.isArray(params.tools)) {
          // Transform tools to include usageControl
          const transformedTools = params.tools
            // Filter out tools set to 'none' - they should never be passed to the provider
            .filter((tool: any) => {
              const usageControl = tool.usageControl || 'auto'
              return usageControl !== 'none'
            })
            .map((tool: any) => {
              // Get the base tool configuration
              const toolConfig = {
                id:
                  tool.type === 'custom-tool'
                    ? tool.schema?.function?.name
                    : tool.operation || getToolIdFromBlock(tool.type),
                name: tool.title,
                description: tool.type === 'custom-tool' ? tool.schema?.function?.description : '',
                params: tool.params || {},
                parameters: tool.type === 'custom-tool' ? tool.schema?.function?.parameters : {}, // We'd need to get actual parameters for non-custom tools
                usageControl: tool.usageControl || 'auto',
              }
              return toolConfig
            })

          // Log which tools are being passed and which are filtered out
          const filteredOutTools = params.tools
            .filter((tool: any) => (tool.usageControl || 'auto') === 'none')
            .map((tool: any) => tool.title)

          if (filteredOutTools.length > 0) {
            logger.info('Filtered out tools set to none', { tools: filteredOutTools.join(', ') })
          }

          logger.info('Transformed tools', { tools: transformedTools })
          if (transformedTools.length === 0) {
            logger.info('No tools will be passed to the provider after filtering')
          } else {
            logger.info('Tools passed to provider', { count: transformedTools.length })
          }

          return { ...params, tools: transformedTools }
        }
        return params
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    context: { type: 'json', required: false },
    model: { type: 'string', required: true },
    apiKey: {
      type: 'string',
      required: false, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    },
    responseFormat: {
      type: 'json',
      required: false,
      description:
        'Define the expected response format using JSON Schema. If not provided, returns plain text content.',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'A name for your schema (optional)',
          },
          schema: {
            type: 'object',
            description: 'The JSON Schema definition',
            properties: {
              type: {
                type: 'string',
                enum: ['object'],
                description: 'Must be "object" for a valid JSON Schema',
              },
              properties: {
                type: 'object',
                description: 'Object containing property definitions',
              },
              required: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of required property names',
              },
              additionalProperties: {
                type: 'boolean',
                description: 'Whether additional properties are allowed',
              },
            },
            required: ['type', 'properties'],
          },
          strict: {
            type: 'boolean',
            description: 'Whether to enforce strict schema validation',
            default: true,
          },
        },
        required: ['schema'],
      },
    },
    temperature: { type: 'number', required: false },
    tools: { type: 'json', required: false },

    // Knowledge Sources Configuration
    ...knowledgeSourceInputs,

    // Memory Configuration (opt-in, works across all use cases)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        tokens: 'json',
        toolCalls: 'json',
      },
      dependsOn: {
        subBlockId: 'responseFormat',
        condition: {
          whenEmpty: {
            content: 'string',
            model: 'string',
            tokens: 'json',
            toolCalls: 'json',
          },
          whenFilled: 'json',
        },
      },
    },
  },
}
