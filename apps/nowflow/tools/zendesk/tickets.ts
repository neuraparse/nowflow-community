import { ToolConfig } from '../types'

interface ZendeskTicketsParams {
  subdomain: string
  authType: 'basic' | 'bearer'
  username?: string
  password?: string
  token?: string
  operation: 'list' | 'get' | 'create' | 'update'
  ticketId?: string
  data?: Record<string, any>
}

export const zendeskTicketsTool: ToolConfig<ZendeskTicketsParams> = {
  id: 'zendesk_tickets',
  name: 'Zendesk Tickets',
  description: 'List, get, create, and update Zendesk tickets.',
  version: '1.0.0',

  params: {
    subdomain: { type: 'string', required: true },
    authType: { type: 'string', required: true, description: 'basic or bearer' },
    username: { type: 'string', description: 'For basic auth' },
    password: { type: 'string', description: 'For basic auth' },
    token: { type: 'string', description: 'OAuth bearer token' },
    operation: { type: 'string', required: true },
    ticketId: { type: 'string', description: 'For get/update' },
    data: { type: 'object', description: 'Payload for create/update { ticket: {...} }' },
  },

  request: {
    url: (p) => {
      const base = `https://${p.subdomain}.zendesk.com/api/v2/tickets`
      if (p.operation === 'get' && p.ticketId) return `${base}/${encodeURIComponent(p.ticketId)}`
      if (p.operation === 'update' && p.ticketId) return `${base}/${encodeURIComponent(p.ticketId)}`
      return base
    },
    method: (p) => (p.operation === 'create' ? 'POST' : p.operation === 'update' ? 'PUT' : 'GET'),
    headers: (p) => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' }
      if (p.authType === 'bearer' && p.token) h.Authorization = `Bearer ${p.token}`
      if (p.authType === 'basic' && p.username && p.password) {
        const creds = Buffer.from(`${p.username}:${p.password}`).toString('base64')
        h.Authorization = `Basic ${creds}`
      }
      return h
    },
    body: (p) =>
      (p.operation === 'create' || p.operation === 'update' ? p.data || {} : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.error || (typeof data === 'string' ? data : 'Zendesk request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Zendesk request failed',
}
