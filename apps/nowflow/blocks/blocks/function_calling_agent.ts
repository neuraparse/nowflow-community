import { CodeIcon } from '@/components/icons'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { getAllModelProviders } from '@/providers/utils'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'
import { getModelSubBlocks } from './agent-model-helpers'
import { getMemoryConfigSubBlocks, memoryConfigInputs } from './memory-config'

interface FunctionCallingAgentResponse extends ToolResponse {
  output: {
    content: string
    model: string
    functionCalls: Array<{
      name: string
      arguments: Record<string, any>
      result: any
    }>
    tokens?: {
      prompt?: number
      completion?: number
      total?: number
    }
  }
}

export const FunctionCallingAgentBlock: BlockConfig<FunctionCallingAgentResponse> = {
  type: 'function_calling_agent',
  name: 'Function Calling Agent',
  description: 'Agent with function calling capabilities',
  longDescription:
    'Create an agent that can call custom functions, process their results, and use them to generate comprehensive responses.',
  category: 'agents',
  bgColor: '#F97316',
  icon: CodeIcon,
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
      placeholder: 'Enter system prompt for the function calling agent...',
      rows: 5,
      condition: {
        field: 'agentProfileId',
        value: '',
      },
    },
    {
      id: 'userInput',
      title: 'User Input',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter the user query or task...',
      rows: 3,
    },
    ...getModelSubBlocks(),
    {
      id: 'functions',
      title: 'Functions',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: `[
  {
    "name": "get_weather",
    "description": "Get the current weather for a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "The city and state, e.g. San Francisco, CA"
        },
        "unit": {
          "type": "string",
          "enum": ["celsius", "fahrenheit"],
          "description": "The unit of temperature"
        }
      },
      "required": ["location"]
    }
  },
  {
    "name": "calculate_mortgage",
    "description": "Calculate monthly mortgage payment",
    "parameters": {
      "type": "object",
      "properties": {
        "principal": {
          "type": "number",
          "description": "The loan amount"
        },
        "interest_rate": {
          "type": "number",
          "description": "Annual interest rate (percentage)"
        },
        "term_years": {
          "type": "number",
          "description": "Loan term in years"
        }
      },
      "required": ["principal", "interest_rate", "term_years"]
    }
  }
]`,
    },
    {
      id: 'functionImplementations',
      title: 'Function Implementations',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder: `// Define your function implementations here
// These will be executed when the agent calls the functions

async function get_weather(args) {
  const { location, unit = "celsius" } = args;
  // In a real implementation, you would call a weather API
  return {
    location,
    temperature: 22.5,
    unit,
    condition: "Sunny",
    humidity: 65
  };
}

async function calculate_mortgage(args) {
  const { principal, interest_rate, term_years } = args;
  const monthlyRate = interest_rate / 100 / 12;
  const payments = term_years * 12;
  const x = Math.pow(1 + monthlyRate, payments);
  const monthly = (principal * x * monthlyRate) / (x - 1);

  return {
    monthly_payment: monthly.toFixed(2),
    total_payment: (monthly * payments).toFixed(2),
    total_interest: ((monthly * payments) - principal).toFixed(2)
  };
}`,
    },
    {
      id: 'maxFunctionCalls',
      title: 'Max Function Calls',
      type: 'short-input',
      layout: 'half',
      placeholder: '5',
    },
    {
      id: 'parallelExecution',
      title: 'Parallel Execution',
      type: 'switch',
      layout: 'half',
    },
    // Memory Configuration (NEW - opt-in, works for all agent types)
    ...getMemoryConfigSubBlocks(),
  ],
  tools: {
    access: [
      'function_execute',
      'math_processor',
      'json_processor',
      'text_processor',
      'http_request',
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
        // Parse functions and implementations
        const functions =
          typeof params.functions === 'string'
            ? JSON.parse(params.functions)
            : params.functions || []

        const maxFunctionCalls = params.maxFunctionCalls ? parseInt(params.maxFunctionCalls) : 5
        const parallelExecution = params.parallelExecution || false

        // Build enhanced system prompt
        const baseSystemPrompt = params.systemPrompt || ''
        const instructions: string[] = []

        if (baseSystemPrompt) {
          instructions.push(baseSystemPrompt)
          instructions.push('')
        }

        instructions.push('Function Calling Agent Instructions:')
        instructions.push(`You have access to ${functions.length} custom function(s).`)
        instructions.push(`Maximum function calls: ${maxFunctionCalls}`)
        instructions.push(`Parallel execution: ${parallelExecution ? 'enabled' : 'disabled'}`)

        if (functions.length > 0) {
          instructions.push('\nAvailable Functions:')
          functions.forEach((fn: any) => {
            instructions.push(`- ${fn.name}: ${fn.description || 'No description'}`)
          })
        }

        instructions.push(
          '\nThe user will provide a query or task. Use the available functions to help answer the query.'
        )

        const enhancedSystemPrompt = instructions.join('\n')

        return {
          ...params,
          systemPrompt: enhancedSystemPrompt,
          context: params.userInput, // Map userInput to context
          functions,
          functionImplementations: params.functionImplementations || '',
          maxFunctionCalls,
          parallelExecution,
        }
      },
    },
  },
  inputs: {
    agentProfileId: { type: 'string', required: false },
    systemPrompt: { type: 'string', required: false },
    userInput: { type: 'string', required: true },
    model: { type: 'string', required: true },
    apiKey: { type: 'string', required: false }, // Conditional: required for cloud models, optional for Ollama (handled by conditional-rules)
    functions: { type: 'json', required: true },
    functionImplementations: { type: 'string', required: true },
    maxFunctionCalls: { type: 'number', required: false },
    parallelExecution: { type: 'boolean', required: false },
    temperature: { type: 'number', required: false },
    // Memory Configuration (NEW - opt-in, works for all agent types)
    ...memoryConfigInputs,
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        model: 'string',
        functionCalls: 'json',
        tokens: 'json',
      },
    },
  },
}
