import { PenToolIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface ContentCreationAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    contentType: string
    wordCount: number
    readabilityScore: number
    seoKeywords: string[]
    tone: string
    targetAudience: string
    suggestions: string[]
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const ContentCreationAgentBlock: BlockConfig<ContentCreationAgentResponse> = {
  type: 'content_creation_agent',
  name: 'Content Creation Agent',
  description: 'AI content writer and editor',
  longDescription:
    'Create an intelligent content creation agent that can write, edit, and optimize various types of content including blogs, social media posts, marketing copy, and technical documentation.',
  category: 'agents',
  bgColor: '#8B5CF6',
  icon: PenToolIcon,
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
      placeholder: 'You are a professional content creator...',
      rows: 4,
      value:
        () => `You are a professional content creator with expertise in writing engaging, high-quality content. Your role is to:
1. Create compelling and original content
2. Adapt writing style to target audience and purpose
3. Optimize content for SEO and readability
4. Maintain consistent brand voice and tone
5. Research and incorporate relevant information
6. Edit and improve existing content
7. Provide content strategy recommendations

Always focus on creating valuable, engaging content that serves the audience's needs.`,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'contentBrief',
      title: 'Content Brief',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the content brief, topic, or requirements...',
      rows: 4,
    },
    {
      id: 'contentType',
      title: 'Content Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Blog Post', id: 'blog' },
        { label: 'Social Media Post', id: 'social' },
        { label: 'Marketing Copy', id: 'marketing' },
        { label: 'Email Newsletter', id: 'email' },
        { label: 'Product Description', id: 'product' },
        { label: 'Technical Documentation', id: 'technical' },
        { label: 'Press Release', id: 'press' },
        { label: 'Website Copy', id: 'website' },
      ],
    },
    {
      id: 'targetAudience',
      title: 'Target Audience',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., Tech professionals, Small business owners...',
    },
    ...getModelSubBlocks(),
    {
      id: 'brandGuidelines',
      title: 'Brand Guidelines',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter brand voice, tone, style guidelines...',
      rows: 3,
    },
    {
      id: 'seoKeywords',
      title: 'SEO Keywords',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter target keywords separated by commas...',
    },
    {
      id: 'contentLength',
      title: 'Content Length',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Short (100-300 words)', id: 'short' },
        { label: 'Medium (300-800 words)', id: 'medium' },
        { label: 'Long (800-1500 words)', id: 'long' },
        { label: 'Extended (1500+ words)', id: 'extended' },
      ],
    },
    {
      id: 'tone',
      title: 'Tone',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Professional', id: 'professional' },
        { label: 'Casual', id: 'casual' },
        { label: 'Friendly', id: 'friendly' },
        { label: 'Authoritative', id: 'authoritative' },
        { label: 'Conversational', id: 'conversational' },
        { label: 'Persuasive', id: 'persuasive' },
      ],
    },
    {
      id: 'includeOutline',
      title: 'Include Outline',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'optimizeForSEO',
      title: 'Optimize for SEO',
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
    "contentType": {"type": "string"},
    "wordCount": {"type": "number"},
    "readabilityScore": {"type": "number"},
    "seoKeywords": {"type": "array", "items": {"type": "string"}},
    "tone": {"type": "string"},
    "targetAudience": {"type": "string"},
    "suggestions": {"type": "array", "items": {"type": "string"}}
  }
}`,
      language: 'json',
      generationType: 'json-schema',
    },
    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),
    // Memory Configuration (opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: ['text_processor', 'vision_tool'],
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
        // Parse SEO keywords
        const seoKeywords = params.seoKeywords
          ? params.seoKeywords.split(',').map((k: string) => k.trim())
          : []

        // Build enhanced system prompt that includes content creation instructions
        const baseSystemPrompt = params.systemPrompt || ''
        const contentType = params.contentType || 'blog'
        const contentLength = params.contentLength || 'medium'
        const tone = params.tone || 'professional'
        const targetAudience = params.targetAudience || ''
        const brandGuidelines = params.brandGuidelines || ''
        const optimizeForSEO = params.optimizeForSEO || false
        const includeOutline = params.includeOutline || false

        // Create detailed instructions based on configuration
        const instructions: string[] = []

        if (contentType) {
          instructions.push(`Content Type: ${contentType}`)
        }
        if (contentLength) {
          const lengthGuides: Record<string, string> = {
            short: '300-500 words',
            medium: '800-1200 words',
            long: '1500-2500 words',
          }
          const lengthGuide = lengthGuides[contentLength] || contentLength
          instructions.push(`Target Length: ${lengthGuide}`)
        }
        if (tone) {
          instructions.push(`Tone: ${tone}`)
        }
        if (targetAudience) {
          instructions.push(`Target Audience: ${targetAudience}`)
        }
        if (brandGuidelines) {
          instructions.push(`Brand Guidelines: ${brandGuidelines}`)
        }
        if (seoKeywords.length > 0) {
          instructions.push(`SEO Keywords to include: ${seoKeywords.join(', ')}`)
        }
        if (optimizeForSEO) {
          instructions.push('Optimize content for SEO with proper keyword placement and structure')
        }
        if (includeOutline) {
          instructions.push('Include a content outline before the main content')
        }

        // Combine system prompt with instructions
        const enhancedSystemPrompt = `${baseSystemPrompt}

Content Creation Instructions:
${instructions.join('\n')}

The user will provide a content brief or topic. Create content based on the brief and the above instructions.`

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
            systemPrompt: enhancedSystemPrompt, // Use enhanced system prompt
            context: params.contentBrief, // Map contentBrief to context for AgentBlockHandler
            tools: transformedTools,
            seoKeywords,
            contentType,
            contentLength,
            tone,
            includeOutline,
            optimizeForSEO,
          }
        }

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt, // Use enhanced system prompt
          context: params.contentBrief, // Map contentBrief to context for AgentBlockHandler
          seoKeywords,
          contentType,
          contentLength,
          tone,
          includeOutline,
          optimizeForSEO,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    contentBrief: { type: 'string', required: true },
    contentType: { type: 'string', required: false },
    targetAudience: { type: 'string', required: false },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    temperature: { type: 'number', required: false },
    brandGuidelines: { type: 'string', required: false },
    seoKeywords: { type: 'string', required: false },
    contentLength: { type: 'string', required: false },
    tone: { type: 'string', required: false },
    includeOutline: { type: 'boolean', required: false },
    optimizeForSEO: { type: 'boolean', required: false },
    tools: { type: 'json', required: false },
    responseFormat: { type: 'json', required: false },
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
        contentType: 'string',
        wordCount: 'number',
        readabilityScore: 'number',
        seoKeywords: 'json',
        tone: 'string',
        targetAudience: 'string',
        suggestions: 'json',
        tokens: 'json',
      },
      dependsOn: {
        subBlockId: 'responseFormat',
        condition: {
          whenEmpty: {
            content: 'string',
            model: 'string',
            contentType: 'string',
            wordCount: 'number',
            readabilityScore: 'number',
            seoKeywords: 'json',
            tone: 'string',
            targetAudience: 'string',
            suggestions: 'json',
            tokens: 'json',
          },
          whenFilled: 'json',
        },
      },
    },
  },
}
