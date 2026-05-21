import { ToolConfig } from '../types'

interface AsanaTasksParams {
  token: string
  operation: 'list' | 'get' | 'create' | 'update'
  projectId?: string
  taskId?: string
  limit?: number
  offset?: string
  data?: Record<string, any>
}

const BASE = 'https://app.asana.com/api/1.0'

export const asanaTasksTool: ToolConfig<AsanaTasksParams> = {
  id: 'asana_tasks',
  name: 'Asana Tasks',
  description: 'List, get, create, and update Asana tasks.',
  version: '1.0.0',

  params: {
    token: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Asana Personal Access Token',
    },
    operation: { type: 'string', required: true, description: 'Operation: list/get/create/update' },
    projectId: { type: 'string', description: 'Project ID for listing tasks' },
    taskId: { type: 'string', description: 'Task ID for get/update' },
    limit: { type: 'number', description: 'Max tasks to list' },
    offset: { type: 'string', description: 'Pagination offset' },
    data: { type: 'object', description: 'Payload for create/update' },
  },

  request: {
    url: (p) => {
      if (p.operation === 'list' && p.projectId)
        return `${BASE}/projects/${encodeURIComponent(p.projectId)}/tasks`
      if ((p.operation === 'get' || p.operation === 'update') && p.taskId)
        return `${BASE}/tasks/${encodeURIComponent(p.taskId)}`
      if (p.operation === 'create') return `${BASE}/tasks`
      return `${BASE}/tasks`
    },
    method: (p) => (p.operation === 'create' ? 'POST' : p.operation === 'update' ? 'PUT' : 'GET'),
    headers: (p) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` }),
    query: (p) => {
      if (p.operation === 'list') {
        const q: Record<string, string> = {}
        if (p.limit) q.limit = String(p.limit)
        if (p.offset) q.offset = p.offset
        return q
      }
      return {}
    },
    body: (p) =>
      (p.operation === 'create' || p.operation === 'update'
        ? { data: p.data || {} }
        : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.errors?.[0]?.message ||
        (typeof data === 'string' ? data : 'Asana request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Asana request failed',
}
