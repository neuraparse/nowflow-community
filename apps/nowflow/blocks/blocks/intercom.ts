import { IntercomIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const IntercomBlock = defineBlock({
  type: 'intercom',
  name: 'Intercom',
  description: 'Intercom Conversations: list/get/create.',
  longDescription: 'Manage Intercom conversations via REST API using bearer token.',
  category: 'tools',
  bgColor: '#1F8DED',
  icon: IntercomIcon,
  subBlocks: [
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Conversations' },
        { id: 'get', label: 'Get Conversation' },
        { id: 'create', label: 'Create Conversation' },
      ],
    }),
    { id: 'conversationId', title: 'Conversation ID', type: 'short-input', layout: 'half' },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['intercom_conversations'],
    config: {
      tool: () => 'intercom_conversations',
      params: (params) => {
        const { token, operation, conversationId, data } = params as Record<string, any>
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
        return { token, operation, conversationId, data: parseJSON(data) }
      },
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    conversationId: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
