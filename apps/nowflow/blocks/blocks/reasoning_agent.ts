import { BrightIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getKnowledgeSourceSubBlocks, knowledgeSourceInputs } from './knowledge-config'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface ReasoningAgentResponse extends ToolResponse {
  output: {
    answer: string
    reasoning: Array<{
      step: number
      thought: string
      action?: string
      observation?: string
    }>
    model: string
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const ReasoningAgentBlock: BlockConfig<ReasoningAgentResponse> = {
  type: 'reasoning_agent',
  name: 'Reasoning Agent',
  description: 'Step-by-step reasoning agent',
  longDescription:
    'Create an agent that uses structured reasoning techniques like Chain-of-Thought, ReAct, or Tree of Thoughts to solve complex problems step by step.',
  category: 'agents',
  bgColor: '#10B981',
  icon: BrightIcon,
  subBlocks: [
    {
      id: 'agentProfileId',
      title: 'Agent Profile',
      type: 'agent-profile-selector',
      layout: 'full',
    },
    {
      id: 'problem',
      title: 'Problem',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the problem or question for the agent to solve...',
      rows: 4,
    },
    {
      id: 'reasoningFramework',
      title: 'Reasoning Framework',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Chain of Thought', id: 'chain_of_thought' },
        { label: 'ReAct', id: 'react' },
        { label: 'Tree of Thoughts', id: 'tree_of_thoughts' },
        { label: 'Socratic Method', id: 'socratic' },
        { label: 'First Principles', id: 'first_principles' },
      ],
    },
    ...getModelSubBlocks(),
    {
      id: 'maxSteps',
      title: 'Max Steps',
      type: 'short-input',
      layout: 'half',
      placeholder: '10',
    },
    {
      id: 'verifySteps',
      title: 'Verify Steps',
      type: 'switch',
      layout: 'half',
    },
    {
      id: 'tools',
      title: 'Tools',
      type: 'tool-input',
      layout: 'full',
      condition: {
        field: 'reasoningFramework',
        value: 'react',
      },
    },
    {
      id: 'domainKnowledge',
      title: 'Domain Knowledge',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter any domain-specific knowledge or context...',
      rows: 3,
    },
    {
      id: 'outputFormat',
      title: 'Output Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Full Reasoning', id: 'full' },
        { label: 'Answer Only', id: 'answer_only' },
        { label: 'Summary with Key Steps', id: 'summary' },
      ],
    },
    // Knowledge Sources Configuration (RAG/Semantic Search)
    ...getKnowledgeSourceSubBlocks(),
    // Memory Configuration (opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: ['openai_chat', 'anthropic_chat', 'google_chat', 'xai_chat', 'deepseek_chat'],
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
        // Transform tools if provided and using ReAct framework
        let transformedTools = []
        if (params.reasoningFramework === 'react' && params.tools && Array.isArray(params.tools)) {
          transformedTools = params.tools.filter((tool: any) => {
            return tool.usageControl !== 'none'
          })
        }

        const reasoningFramework = params.reasoningFramework || 'chain_of_thought'
        const maxSteps = params.maxSteps ? parseInt(params.maxSteps) : 10
        const verifySteps = params.verifySteps || false
        const outputFormat = params.outputFormat || 'full'
        const domainKnowledge = params.domainKnowledge || ''

        // Build enhanced system prompt
        const instructions: string[] = []
        instructions.push('You are a reasoning agent that solves problems step by step.')
        instructions.push(`Reasoning Framework: ${reasoningFramework}`)
        instructions.push(`Maximum steps: ${maxSteps}`)
        instructions.push(`Verify steps: ${verifySteps ? 'yes' : 'no'}`)
        instructions.push(`Output format: ${outputFormat}`)

        // Add framework-specific instructions
        switch (reasoningFramework) {
          case 'chain_of_thought':
            instructions.push(
              '\nUse Chain-of-Thought reasoning: Break down the problem into logical steps and explain your thinking at each step.'
            )
            break
          case 'react':
            instructions.push(
              '\nUse ReAct framework: Alternate between Reasoning (thought), Action (using tools), and Observation (results).'
            )
            break
          case 'tree_of_thoughts':
            instructions.push(
              '\nUse Tree of Thoughts: Explore multiple reasoning paths and evaluate which leads to the best solution.'
            )
            break
          case 'socratic':
            instructions.push(
              '\nUse Socratic Method: Ask and answer questions to arrive at the solution through dialogue.'
            )
            break
          case 'first_principles':
            instructions.push(
              '\nUse First Principles: Break down the problem to fundamental truths and build up from there.'
            )
            break
        }

        if (domainKnowledge) {
          instructions.push(`\nDomain Knowledge:\n${domainKnowledge}`)
        }

        instructions.push(
          '\nThe user will provide a problem. Solve it using the specified reasoning framework.'
        )

        const enhancedSystemPrompt = instructions.join('\n')

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.problem, // Map problem to context
          reasoningFramework,
          maxSteps,
          verifySteps,
          tools: transformedTools.length > 0 ? transformedTools : undefined,
          outputFormat,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    problem: { type: 'string', required: true },
    reasoningFramework: { type: 'string', required: true },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    maxSteps: { type: 'number', required: false },
    verifySteps: { type: 'boolean', required: false },
    tools: { type: 'json', required: false },
    domainKnowledge: { type: 'string', required: false },
    outputFormat: { type: 'string', required: false },
    temperature: { type: 'number', required: false },
    // Knowledge Sources Configuration
    ...knowledgeSourceInputs,
    // Memory Configuration (opt-in, works for all agent types)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        answer: 'string',
        reasoning: 'json',
        model: 'string',
        tokens: 'json',
      },
    },
  },
}
