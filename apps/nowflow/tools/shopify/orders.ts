import { ToolConfig } from '../types'

interface ShopifyOrdersParams {
  shopDomain: string // your-store.myshopify.com
  accessToken: string // Admin API access token
  operation: 'list' | 'get' | 'create'
  orderId?: string
  status?: string
  limit?: number
  fields?: string
  pageInfo?: string // cursor-based pagination
  apiVersion?: string // default 2024-10
  data?: Record<string, any> // for create
}

const apiVersionDefault = '2025-10'

export const shopifyOrdersTool: ToolConfig<ShopifyOrdersParams> = {
  id: 'shopify_orders',
  name: 'Shopify Orders',
  description: 'List, retrieve, and create Shopify orders via Admin REST API.',
  version: '1.0.0',

  params: {
    shopDomain: {
      type: 'string',
      required: true,
      description: 'Shop domain, e.g., your-store.myshopify.com',
    },
    accessToken: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Admin API access token',
    },
    operation: { type: 'string', required: true, description: 'Operation: list/get/create' },
    orderId: { type: 'string', description: 'Order ID for get' },
    status: { type: 'string', description: 'Filter by status (for list)' },
    limit: { type: 'number', description: 'Limit (for list)' },
    fields: { type: 'string', description: 'Comma-separated fields to include' },
    pageInfo: { type: 'string', description: 'Cursor for pagination (list)' },
    apiVersion: { type: 'string', description: 'Shopify API version, default 2025-10' },
    data: {
      type: 'object',
      description: 'Order payload for create (will be wrapped as { order: ... })',
    },
  },

  request: {
    url: (p: ShopifyOrdersParams) => {
      const version = (p.apiVersion || apiVersionDefault).replace(/\/$/, '')
      const base = `https://${p.shopDomain}/admin/api/${version}/orders`
      if (p.operation === 'get' && p.orderId) return `${base}/${encodeURIComponent(p.orderId)}.json`
      return `${base}.json`
    },
    method: (p: ShopifyOrdersParams) => {
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
    headers: (p: ShopifyOrdersParams) => ({
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': p.accessToken,
      Accept: 'application/json',
    }),
    query: (p: ShopifyOrdersParams) => {
      const q: Record<string, string> = {}
      if (p.operation === 'list') {
        if (p.status) q.status = p.status
        if (p.limit) q.limit = String(p.limit)
        if (p.fields) q.fields = p.fields
        if (p.pageInfo) q.page_info = p.pageInfo
      }
      return q
    },
    body: (p: ShopifyOrdersParams) => {
      if (p.operation === 'create') return { order: p.data || {} }
      return undefined as any
    },
  },

  transformResponse: async (response: Response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const message =
        (data as any)?.errors || (typeof data === 'string' ? data : 'Shopify request failed')
      return {
        success: false,
        output: data as any,
        error: typeof message === 'string' ? message : JSON.stringify(message),
      }
    }

    return { success: true, output: data as any }
  },

  transformError: (error: any) =>
    typeof error === 'string' ? error : error?.message || 'Shopify request failed',
}
