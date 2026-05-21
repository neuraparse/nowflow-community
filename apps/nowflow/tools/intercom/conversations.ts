import { ToolConfig } from '../types'

interface IntercomConversationsParams {
  token: string
  operation: 'list' | 'get' | 'create'
  conversationId?: string
  data?: Record<string, any>
}

export const intercomConversationsTool: ToolConfig<IntercomConversationsParams> = {
  id: 'intercom_conversations',
  name: 'Intercom Conversations',
  description: 'List, get, and create Intercom conversations.',
  version: '1.0.0',

  params: {
    token: { type: 'string', required: true, requiredForToolCall: true },
    operation: { type: 'string', required: true },
    conversationId: { type: 'string', required: false },
    data: { type: 'object', required: false },
  },

  request: {
    url: (p) => {
      const base = 'https://api.intercom.io/conversations'
      if (p.operation === 'get' && p.conversationId)
        return `${base}/${encodeURIComponent(p.conversationId)}`
      return base
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'create':
          return 'POST'
        default:
          return 'GET'
      }
    },
    headers: (p) => ({
      Authorization: `Bearer ${p.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: (p) => (p.operation === 'create' ? p.data || {} : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.errors?.[0]?.message ||
        (typeof data === 'string' ? data : 'Intercom request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Intercom request failed',
}
