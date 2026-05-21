import { CodeIcon } from '@/components/icons'
import { CodeExecutionOutput } from '@/tools/function/types'
import { BlockConfig } from '../types'

export const FunctionBlock: BlockConfig<CodeExecutionOutput> = {
  type: 'function',
  name: 'Function',
  description: 'Run custom logic',
  longDescription:
    'Execute custom JavaScript or TypeScript code within your workflow to transform data or implement complex logic. Create reusable functions to process inputs and generate outputs for other blocks.',
  category: 'blocks',
  bgColor: '#FF402F',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'code',
      type: 'code',
      layout: 'full',
      placeholder: `// Process input data
const result = {
  processedAt: new Date().toISOString(),
  data: input.data || []
};
return result;`,
    },
  ],
  tools: {
    access: ['function_execute'],
    config: {
      tool: () => 'function_execute',
      params: (params) => ({
        code: params.code,
        timeout: params.timeout,
      }),
    },
  },
  inputs: {
    code: { type: 'string', required: false },
    timeout: { type: 'number', required: false },
  },
  outputs: {
    response: {
      type: {
        result: 'json',
        stdout: 'string',
        executionTime: 'number',
      },
    },
  },
}
