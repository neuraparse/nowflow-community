import { ToolConfig } from '../types'

interface OneDriveFilesParams {
  accessToken: string
  operation: 'list' | 'upload' | 'download'
  driveId?: string
  itemId?: string
  path?: string
  contents?: string
  contentType?: string
}

export const oneDriveFilesTool: ToolConfig<OneDriveFilesParams> = {
  id: 'onedrive_files',
  name: 'Microsoft OneDrive Files',
  description: 'List, upload, and download files via Microsoft Graph API.',
  version: '1.0.0',
  oauth: {
    required: false,
    provider: 'microsoft-onedrive',
    additionalScopes: [
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'https://graph.microsoft.com/Sites.ReadWrite.All',
      'https://graph.microsoft.com/User.Read',
    ],
  },
  params: {
    accessToken: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    driveId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    path: { type: 'string', required: false },
    contents: { type: 'string', required: false },
    contentType: { type: 'string', required: false },
  },
  request: {
    url: (p) => {
      const base = 'https://graph.microsoft.com/v1.0'
      const drive = p.driveId ? `/drives/${encodeURIComponent(p.driveId)}` : '/me/drive'
      if (p.operation === 'list') {
        if (p.path) {
          return `${base}${drive}/root:${encodeURI(p.path)}:/children`
        }
        return `${base}${drive}/root/children`
      }
      if (p.operation === 'download') {
        if (p.itemId) return `${base}${drive}/items/${encodeURIComponent(p.itemId)}/content`
        if (p.path) return `${base}${drive}/root:${encodeURI(p.path)}:/content`
      }
      if (p.operation === 'upload') {
        if (p.path) return `${base}${drive}/root:${encodeURI(p.path)}:/content`
      }
      return `${base}${drive}/root/children`
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
          return 'GET'
        case 'download':
          return 'GET'
        case 'upload':
          return 'PUT'
        default:
          return 'GET'
      }
    },
    headers: (p) => ({
      Authorization: `Bearer ${p.accessToken}`,
      ...(p.operation === 'upload' && p.contentType ? { 'Content-Type': p.contentType } : {}),
    }),
    body: (p) => (p.operation === 'upload' ? p.contents || '' : undefined) as any,
  },
  transformResponse: async (response) => {
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const data = await response.json()
      return response.ok
        ? { success: true, output: data }
        : {
            success: false,
            output: data,
            error: (data as any)?.error?.message || 'OneDrive request failed',
          }
    }
    const text = await response.text()
    return response.ok
      ? { success: true, output: text }
      : { success: false, output: text, error: 'OneDrive request failed' }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'OneDrive request failed',
}
