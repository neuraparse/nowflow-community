import { ToolConfig } from '../types'

interface DropboxFilesParams {
  token: string
  operation: 'list' | 'upload'
  path?: string
  contents?: string
}

export const dropboxFilesTool: ToolConfig<DropboxFilesParams> = {
  id: 'dropbox_files',
  name: 'Dropbox Files',
  description: 'List files in a folder or upload a file to Dropbox.',
  version: '1.0.0',

  params: {
    token: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'OAuth Bearer token',
    },
    operation: { type: 'string', required: true, description: 'Operation: list or upload' },
    path: { type: 'string', description: 'Path for list or upload (e.g., /myfolder)' },
    contents: { type: 'string', description: 'File contents for upload (text)' },
  },

  request: {
    url: (p) =>
      p.operation === 'list'
        ? 'https://api.dropboxapi.com/2/files/list_folder'
        : 'https://content.dropboxapi.com/2/files/upload',
    method: (p) => (p.operation === 'list' ? 'POST' : 'POST'),
    headers: (p): Record<string, string> => {
      if (p.operation === 'list') {
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` }
      }
      // upload
      return {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: p.path || '/uploaded.txt',
          mode: 'add',
          autorename: true,
          mute: false,
        }),
        Authorization: `Bearer ${p.token}`,
      }
    },
    body: (p) => {
      if (p.operation === 'list') return { path: p.path || '' } as any
      // upload expects raw binary/text body
      return (p.contents || '') as any
    },
  },

  transformResponse: async (response, params) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.error_summary || (typeof data === 'string' ? data : 'Dropbox request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Dropbox request failed',
}
