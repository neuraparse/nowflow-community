import { ToolConfig } from '../types'

interface PipedriveDealsParams {
  apiToken: string
  baseUrl?: string
  operation: 'list' | 'get' | 'create' | 'update'
  dealId?: number | string
  search?: string
  data?: Record<string, any>
}

export const pipedriveDealsTool: ToolConfig<PipedriveDealsParams> = {
  id: 'pipedrive_deals',
  name: 'Pipedrive Deals',
  description: 'List, get, create and update Pipedrive deals.',
  version: '1.0.0',
  params: {
    apiToken: { type: 'string', required: true },
    baseUrl: {
      type: 'string',
      required: false,
      description: 'Default: https://api.pipedrive.com/v1',
    },
    operation: { type: 'string', required: true },
    dealId: { type: 'string', required: false },
    search: { type: 'string', required: false },
    data: { type: 'object', required: false },
  },
  request: {
    url: (p) => {
      const base = (p.baseUrl || 'https://api.pipedrive.com/v1').replace(/\/$/, '')
      if (p.operation === 'list') {
        const u = new URL(`${base}/deals`)
        u.searchParams.set('api_token', p.apiToken)
        if (p.search) u.searchParams.set('term', p.search)
        return u.toString()
      }
      if ((p.operation === 'get' || p.operation === 'update') && p.dealId) {
        const u = new URL(`${base}/deals/${encodeURIComponent(String(p.dealId))}`)
        u.searchParams.set('api_token', p.apiToken)
        return u.toString()
      }
      if (p.operation === 'create') {
        const u = new URL(`${base}/deals`)
        u.searchParams.set('api_token', p.apiToken)
        return u.toString()
      }
      const u = new URL(`${base}/deals`)
      u.searchParams.set('api_token', p.apiToken)
      return u.toString()
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'create':
          return 'POST'
        case 'update':
          return 'PUT'
        default:
          return 'GET'
      }
    },
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (p) =>
      (p.operation === 'create' || p.operation === 'update' ? p.data || {} : undefined) as any,
  },
  transformResponse: async (response) => {
    const data = await response.json().catch(async () => await response.text())
    if (!response.ok) {
      const message =
        (data as any)?.error || (data as any)?.error_info || 'Pipedrive request failed'
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Pipedrive request failed',
}
