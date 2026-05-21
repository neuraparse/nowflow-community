import { SupabaseIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { createOperationDropdown, defineBlock, parseJsonStrict } from '../helpers'

interface SupabaseResponse extends ToolResponse {
  output: {
    message: string
    results: any
  }
  error?: string
}

export const SupabaseBlock = defineBlock<SupabaseResponse>({
  type: 'supabase',
  name: 'Supabase',
  description: 'Use Supabase database',
  longDescription:
    'Integrate with Supabase to manage your database, authentication, storage, and more. Query data, manage users, and interact with Supabase services directly.',
  category: 'tools',
  bgColor: '#1C1C1C',
  icon: SupabaseIcon,
  subBlocks: [
    // Operation selector
    createOperationDropdown({
      operations: [
        { id: 'query', label: 'Read All Rows' },
        { id: 'insert', label: 'Insert Rows' },
      ],
    }),
    // Common Fields
    {
      id: 'projectId',
      title: 'Project ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Your Supabase project ID (e.g., jdrkgepadsdopsntdlom)',
    },
    {
      id: 'table',
      title: 'Table',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Name of the table',
    },
    {
      id: 'apiKey',
      title: 'Client Anon Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Your Supabase client anon key',
      password: true,
    },
    // Insert-specific Fields
    {
      id: 'data',
      title: 'Data',
      type: 'code',
      layout: 'full',
      placeholder: '{\n  "column1": "value1",\n  "column2": "value2"\n}',
      condition: { field: 'operation', value: 'insert' },
    },
  ],
  tools: {
    access: ['supabase_query', 'supabase_insert'],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'query':
            return 'supabase_query'
          case 'insert':
            return 'supabase_insert'
          default:
            throw new Error(`Invalid Supabase operation: ${params.operation}`)
        }
      },
      params: (params) => {
        const { data, ...rest } = params
        return {
          ...rest,
          data: parseJsonStrict(data, 'data'),
        }
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true, requiredForToolCall: true },
    projectId: { type: 'string', required: true, requiredForToolCall: true },
    table: { type: 'string', required: true, requiredForToolCall: true },
    apiKey: { type: 'string', required: true, requiredForToolCall: true },
    // Insert operation inputs
    data: { type: 'string', required: false, requiredForToolCall: true },
  },
  outputs: {
    response: {
      type: {
        message: 'string',
        results: 'json',
      },
    },
  },
})
