import { ToolConfig } from '../types'

interface SharePointListsParams {
  accessToken: string
  operation: 'list_lists' | 'list_items' | 'get_item' | 'create_item' | 'update_item'
  siteId: string
  listId?: string
  itemId?: string
  fields?: Record<string, any>
}

export const sharepointListsTool: ToolConfig<SharePointListsParams> = {
  id: 'sharepoint_lists',
  name: 'Microsoft SharePoint Lists',
  description: 'List SharePoint lists and manage list items via Microsoft Graph API.',
  version: '1.0.0',
  oauth: {
    required: false,
    provider: 'microsoft-sharepoint',
    additionalScopes: [
      'https://graph.microsoft.com/Sites.ReadWrite.All',
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'https://graph.microsoft.com/User.Read',
    ],
  },
  params: {
    accessToken: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    siteId: { type: 'string', required: true },
    listId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    fields: { type: 'object', required: false },
  },
  request: {
    url: (p) => {
      const base = 'https://graph.microsoft.com/v1.0'
      if (p.operation === 'list_lists') {
        return `${base}/sites/${encodeURIComponent(p.siteId)}/lists`
      }
      if (!p.listId) return `${base}/sites/${encodeURIComponent(p.siteId)}/lists`
      const listBase = `${base}/sites/${encodeURIComponent(p.siteId)}/lists/${encodeURIComponent(p.listId)}`
      switch (p.operation) {
        case 'list_items':
          return `${listBase}/items?expand=fields`
        case 'get_item':
          return `${listBase}/items/${encodeURIComponent(p.itemId || '')}?expand=fields`
        case 'create_item':
          return `${listBase}/items`
        case 'update_item':
          return `${listBase}/items/${encodeURIComponent(p.itemId || '')}`
        default:
          return `${listBase}/items`
      }
    },
    method: (p) => {
      switch (p.operation) {
        case 'list_lists':
        case 'list_items':
        case 'get_item':
          return 'GET'
        case 'create_item':
          return 'POST'
        case 'update_item':
          return 'PATCH'
        default:
          return 'GET'
      }
    },
    headers: (p) => ({
      Authorization: `Bearer ${p.accessToken}`,
      'Content-Type': 'application/json',
    }),
    body: (p) =>
      (p.operation === 'create_item' || p.operation === 'update_item'
        ? { fields: p.fields || {} }
        : undefined) as any,
  },
  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.error?.message ||
        (typeof data === 'string' ? data : 'SharePoint request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'SharePoint request failed',
}
