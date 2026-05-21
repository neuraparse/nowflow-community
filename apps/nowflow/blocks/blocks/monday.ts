import { MondayIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const MondayBlock = defineBlock({
  type: 'monday',
  name: 'Monday.com',
  description: 'Monday Items: list/get/create/update.',
  longDescription: 'Manage Monday.com items via GraphQL API using personal token.',
  category: 'tools',
  bgColor: '#FF3D57',
  icon: MondayIcon,
  subBlocks: [
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Items' },
        { id: 'get', label: 'Get Item' },
        { id: 'create', label: 'Create Item' },
        { id: 'update', label: 'Update Item' },
      ],
    }),
    { id: 'boardId', title: 'Board ID', type: 'short-input', layout: 'half' },
    { id: 'itemId', title: 'Item ID', type: 'short-input', layout: 'half' },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['monday_items'],
    config: {
      tool: () => 'monday_items',
      params: (params) => {
        const { token, operation, boardId, itemId, data } = params as Record<string, any>
        const parseJSON = (v: any) => {
          if (typeof v === 'string' && v.trim()) {
            try {
              return JSON.parse(v)
            } catch {
              return undefined
            }
          }
          return v
        }
        return { token, operation, boardId, itemId, data: parseJSON(data) }
      },
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    boardId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
