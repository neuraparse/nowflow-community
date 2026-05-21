import { ToolConfig } from '../types'

interface ServiceNowParams {
  instanceUrl: string
  apiKey: string
  table: string
  operation: 'get' | 'insert' | 'update' | 'delete' | 'query'
  sysId?: string
  query?: string
  fields?: string
  limit?: number
  offset?: number
  data?: Record<string, any>
}

export const serviceNowTableTool: ToolConfig<ServiceNowParams> = {
  id: 'servicenow_table',
  name: 'ServiceNow Table API',
  description: 'Perform CRUD and query operations on ServiceNow tables.',
  version: '1.0.0',

  params: {
    instanceUrl: { type: 'string', required: true, description: 'ServiceNow instance base URL' },
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Bearer token (OAuth)',
    },
    table: { type: 'string', required: true, description: 'Table name (e.g., incident)' },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation: get/insert/update/delete/query',
    },
    sysId: { type: 'string', description: 'Record sys_id for get/update/delete' },
    query: { type: 'string', description: 'sysparm_query (encoded query)' },
    fields: { type: 'string', description: 'sysparm_fields comma-separated list' },
    limit: { type: 'number', description: 'sysparm_limit' },
    offset: { type: 'number', description: 'sysparm_offset' },
    data: { type: 'object', description: 'Payload for insert/update' },
  },

  request: {
    url: (p: ServiceNowParams) => {
      const base = `${p.instanceUrl.replace(/\/$/, '')}/api/now/table/${encodeURIComponent(p.table)}`
      if (p.operation === 'get' && p.sysId) return `${base}/${encodeURIComponent(p.sysId)}`
      if (p.operation === 'update' && p.sysId) return `${base}/${encodeURIComponent(p.sysId)}`
      if (p.operation === 'delete' && p.sysId) return `${base}/${encodeURIComponent(p.sysId)}`
      return base
    },
    method: (p: ServiceNowParams) => {
      switch (p.operation) {
        case 'get':
        case 'query':
          return 'GET'
        case 'insert':
          return 'POST'
        case 'update':
          return 'PUT'
        case 'delete':
          return 'DELETE'
        default:
          return 'GET'
      }
    },
    headers: (p: ServiceNowParams) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
      Accept: 'application/json',
    }),
    body: (p: ServiceNowParams) => {
      if (p.operation === 'insert' || p.operation === 'update') return p.data || {}
      return undefined as any
    },
  },

  transformResponse: async (response: Response, params?: ServiceNowParams) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const message =
        (data as any)?.error?.message ||
        (typeof data === 'string' ? data : 'ServiceNow request failed')
      return { success: false, output: data as any, error: message }
    }

    if ((params?.operation === 'query' || params?.operation === 'get') && (data as any).result) {
      return { success: true, output: { result: (data as any).result } }
    }

    return { success: true, output: data as any }
  },

  transformError: (error: any) =>
    typeof error === 'string' ? error : error?.message || 'ServiceNow request failed',
}
