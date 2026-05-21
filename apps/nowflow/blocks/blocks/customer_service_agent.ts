import { HeadphonesIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface CustomerServiceAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    sentiment: 'positive' | 'neutral' | 'negative'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    category: string
    suggestedActions: string[]
    escalationRequired: boolean
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const CustomerServiceAgentBlock: BlockConfig<CustomerServiceAgentResponse> = {
  type: 'customer_service_agent',
  name: 'Customer Service Agent',
  description: 'Specialized customer support agent',
  longDescription:
    'Create a specialized customer service agent that can handle support tickets, analyze sentiment, categorize issues, and provide appropriate responses with escalation recommendations.',
  category: 'agents',
  bgColor: '#06B6D4',
  icon: HeadphonesIcon,
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
      placeholder:
        'You are a professional customer service agent. Always be helpful, empathetic, and solution-focused...',
      rows: 4,
      value: () => `You are a professional customer service agent. Your role is to:
1. ALWAYS respond in the SAME LANGUAGE as the customer's message (Turkish→Turkish, English→English, etc.)
2. Provide helpful, empathetic, and solution-focused responses
3. Analyze customer sentiment and issue priority
4. Categorize the customer's issue appropriately
5. Suggest actionable next steps
6. Determine if escalation is needed
7. Maintain a professional and friendly tone at all times

Always aim to resolve issues efficiently while ensuring customer satisfaction.`,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'customerMessage',
      title: 'Customer Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the customer message or support ticket...',
      rows: 4,
    },
    {
      id: 'customerContext',
      title: 'Customer Context',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter customer history, account info, previous interactions...',
      rows: 3,
    },
    ...getModelSubBlocks(),
    {
      id: 'knowledgeBase',
      title: 'Knowledge Base',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter company policies, FAQ, product information...',
      rows: 4,
    },
    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),
    {
      id: 'escalationRules',
      title: 'Escalation Rules',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: `{
  "keywords": ["refund", "cancel", "angry", "lawsuit", "complaint"],
  "sentimentThreshold": "negative",
  "priorityThreshold": "high",
  "autoEscalate": true
}`,
    },
    {
      id: 'agentType',
      title: 'Agent Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'None (Default)', id: 'none' },
        { label: 'Chatbot', id: 'chatbot' },
        { label: 'Customer Assistant', id: 'customer_assistant' },
        { label: 'HR Agent', id: 'hr' },
      ],
      value: () => 'none',
    },
    {
      id: 'responseStyle',
      title: 'Response Style',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Professional', id: 'professional' },
        { label: 'Friendly', id: 'friendly' },
        { label: 'Empathetic', id: 'empathetic' },
        { label: 'Concise', id: 'concise' },
      ],
    },
    {
      id: 'includeAnalysis',
      title: 'Include Analysis',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'tools',
      title: 'Tools',
      type: 'tool-input',
      layout: 'full',
    },
    {
      id: 'responseFormat',
      title: 'Response Format',
      type: 'code',
      layout: 'full',
      placeholder: `{
  "type": "object",
  "properties": {
    "content": {"type": "string"},
    "sentiment": {"type": "string", "enum": ["positive", "neutral", "negative"]},
    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
    "category": {"type": "string"},
    "suggestedActions": {"type": "array", "items": {"type": "string"}},
    "escalationRequired": {"type": "boolean"}
  }
}`,
      language: 'json',
      generationType: 'json-schema',
    },

    // Memory Configuration (NEW - opt-in)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'hubspot_contacts',
      'salesforce_opportunities',
      'slack_message',
      'gmail_send',
      'text_processor',
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
        // Parse escalation rules
        const escalationRules =
          typeof params.escalationRules === 'string'
            ? JSON.parse(params.escalationRules)
            : params.escalationRules || {}

        // Build enhanced system prompt
        const baseSystemPrompt = params.systemPrompt || ''
        const agentType = params.agentType || 'none'
        const responseStyle = params.responseStyle || 'professional'
        const includeAnalysis = params.includeAnalysis || false
        const customerContext = params.customerContext || ''
        const knowledgeBase = params.knowledgeBase || ''

        // Agent Type-Specific Rules (Language-Agnostic)
        const agentTypeRules: Record<string, string> = {
          chatbot: `CHATBOT MODE - Critical Rules:
- LANGUAGE: ALWAYS respond in the SAME LANGUAGE as the customer's message (Turkish→Turkish, English→English, etc.)
- Use natural, conversational language (avoid formal email-style responses)
- Keep responses SHORT and to the point (1-3 sentences when possible)
- Use a friendly, casual tone appropriate for the language culture
- Avoid email signatures, formal greetings, or closing statements
- Respond as if you're having a real-time chat conversation
- Use emojis sparingly if appropriate for the brand and culture
- Ask follow-up questions to keep the conversation flowing
- Be human-like: use contractions and natural phrasing native to the language
- Adapt your communication style to the cultural norms of the language being used`,

          customer_assistant: `CUSTOMER ASSISTANT MODE - Critical Rules:
- LANGUAGE: ALWAYS respond in the SAME LANGUAGE as the customer's message (Turkish→Turkish, English→English, etc.)
- Primary goal: Resolve customer issues quickly and effectively
- Always acknowledge the customer's concern first using culturally appropriate expressions
- Provide clear, actionable solutions with step-by-step guidance when needed
- Use empathetic language that shows you care about their experience
- Offer alternatives if the first solution doesn't apply
- Proactively suggest related help or resources
- End with a clear next step or confirmation question
- Maintain a helpful, solution-focused tone throughout
- Never say "I can't help" - always offer an alternative or escalation path
- Respect cultural communication norms of the language being used`,

          hr: `HR AGENT MODE - Critical Rules:
- LANGUAGE: ALWAYS respond in the SAME LANGUAGE as the employee's message (Turkish→Turkish, English→English, etc.)
- Maintain strict confidentiality and professionalism at all times
- Use formal, respectful language appropriate for workplace communication in that language and culture
- Be empathetic but maintain professional boundaries
- Provide accurate information based on company policies
- Never make promises you can't keep - verify before committing
- Handle sensitive topics (compensation, complaints, health) with extra care and cultural sensitivity
- Document conversations appropriately and suggest follow-up when needed
- Respect employee privacy and only request necessary information
- Guide employees to proper channels for sensitive issues
- Use inclusive, non-discriminatory language always
- Adapt formality level to the cultural workplace norms of the language`,
        }

        const agentTypeInstruction = agentType !== 'none' ? agentTypeRules[agentType] || '' : ''

        const instructions: string[] = []

        // Add agent type-specific rules FIRST (highest priority)
        if (agentTypeInstruction) {
          instructions.push(`\n=== AGENT TYPE CONFIGURATION ===\n${agentTypeInstruction}\n`)
        }

        if (responseStyle) {
          instructions.push(`Response Style: ${responseStyle}`)
        }
        if (customerContext) {
          instructions.push(`Customer Context: ${customerContext}`)
        }
        if (knowledgeBase) {
          instructions.push(`Knowledge Base: ${knowledgeBase}`)
        }
        if (Object.keys(escalationRules).length > 0) {
          instructions.push(`Escalation Rules: ${JSON.stringify(escalationRules, null, 2)}`)
        }
        if (includeAnalysis) {
          instructions.push('Include sentiment analysis and issue categorization in your response')
        }

        const enhancedSystemPrompt = `${baseSystemPrompt}

Customer Service Instructions:
${instructions.join('\n')}

The user will provide a customer message. Respond professionally based on the above instructions.`

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
            context: params.customerMessage,
            tools: transformedTools,
            agentType,
            escalationRules,
            responseStyle,
            includeAnalysis,
          }
        }

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.customerMessage,
          agentType,
          escalationRules,
          responseStyle,
          includeAnalysis,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    customerMessage: { type: 'string', required: true },
    customerContext: { type: 'string', required: false },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    temperature: { type: 'number', required: false },
    agentType: { type: 'string', required: false },
    knowledgeBase: { type: 'string', required: false },
    ...knowledgeSourceInputs,
    escalationRules: { type: 'json', required: false },
    responseStyle: { type: 'string', required: false },
    includeAnalysis: { type: 'boolean', required: false },
    tools: { type: 'json', required: false },
    responseFormat: { type: 'json', required: false },

    // Memory Configuration (NEW - opt-in)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        sentiment: 'string',
        priority: 'string',
        category: 'string',
        suggestedActions: 'json',
        escalationRequired: 'boolean',
        tokens: 'json',
      },
      dependsOn: {
        subBlockId: 'responseFormat',
        condition: {
          whenEmpty: {
            content: 'string',
            model: 'string',
            sentiment: 'string',
            priority: 'string',
            category: 'string',
            suggestedActions: 'json',
            escalationRequired: 'boolean',
            tokens: 'json',
          },
          whenFilled: 'json',
        },
      },
    },
  },
}
