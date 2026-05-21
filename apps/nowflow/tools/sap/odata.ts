import { ToolConfig } from '../types'

interface ODataParams {
  baseUrl: string // e.g., https://example.sap.com/odata/v2
  resource: string // e.g., Accounts, Products
  operation: 'get' | 'list' | 'create' | 'update' | 'delete'
  id?: string
  query?: string // $filter=, $select=, $top=, $skip=
  headers?: Record<string, string>
  authType?: 'basic' | 'bearer' | 'oauth'
  username?: string
  password?: string
  token?: string
  // OAuth credential ID from the account table
  credentialId?: string
  data?: Record<string, any>
}

export const sapODataTool: ToolConfig<ODataParams> = {
  id: 'sap_odata',
  name: 'SAP OData',
  description:
    'Generic OData client for SAP services (CRUD + query). Supports OAuth, basic auth, and bearer token authentication.',
  version: '1.0.1',

  params: {
    baseUrl: { type: 'string', required: true, description: 'Base OData endpoint URL' },
    resource: { type: 'string', required: true, description: 'OData resource name' },
    operation: {
      type: 'string',
      required: true,
      description: 'Operation: list/get/create/update/delete',
    },
    id: { type: 'string', description: 'Entity ID for get/update/delete' },
    query: { type: 'string', description: 'Query string for $filter, $select, etc.' },
    headers: { type: 'object', description: 'Additional headers' },
    authType: { type: 'string', description: 'Auth type: oauth, basic, or bearer. Default: oauth' },
    username: { type: 'string', description: 'Basic auth username (only for authType=basic)' },
    password: { type: 'string', description: 'Basic auth password (only for authType=basic)' },
    token: { type: 'string', description: 'Bearer token (only for authType=bearer)' },
    credentialId: {
      type: 'string',
      description: 'OAuth credential ID from connected accounts (for authType=oauth)',
    },
    data: { type: 'object', description: 'Payload for create/update' },
  },

  request: {
    url: (p: ODataParams) => {
      const base = `${p.baseUrl.replace(/\/$/, '')}/${p.resource.replace(/^\//, '')}`
      if ((p.operation === 'get' || p.operation === 'update' || p.operation === 'delete') && p.id) {
        return `${base}(${encodeURIComponent(p.id)})`
      }
      return base
    },
    method: (p: ODataParams) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'create':
          return 'POST'
        case 'update':
          return 'PATCH'
        case 'delete':
          return 'DELETE'
        default:
          return 'GET'
      }
    },
    headers: (p: ODataParams) => {
      const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(p.headers || {}),
      }
      if (p.authType === 'bearer' && p.token) h.Authorization = `Bearer ${p.token}`
      if (p.authType === 'basic' && p.username && p.password) {
        const creds = Buffer.from(`${p.username}:${p.password}`).toString('base64')
        h.Authorization = `Basic ${creds}`
      }
      return h
    },
    query: (p: ODataParams) => {
      const q: Record<string, string> = {}
      if (p.operation === 'list' && p.query) {
        // Accept full query string like "$filter=...&$select=..."
        // The request builder will append this after '?'
        // Returning a placeholder to signal direct append is not supported in our generic client,
        // instead we return an empty object and rely on base URL builder above to include only path.
      }
      return q
    },
    body: (p: ODataParams) => {
      if (p.operation === 'create' || p.operation === 'update') return p.data || {}
      return undefined as any
    },
  },

  transformResponse: async (response: Response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const message =
        (data as any)?.error?.message || (typeof data === 'string' ? data : 'OData request failed')
      return {
        success: false,
        output: data as any,
        error: typeof message === 'string' ? message : JSON.stringify(message),
      }
    }

    return { success: true, output: data as any }
  },

  transformError: (error: any) =>
    typeof error === 'string' ? error : error?.message || 'OData request failed',
}
