import { ToolConfig } from '../types'

interface ClickUpTasksParams {
  token: string
  operation: 'list' | 'get' | 'create' | 'update'
  teamId?: string
  listId?: string
  taskId?: string
  data?: Record<string, any>
}

export const clickupTasksTool: ToolConfig<ClickUpTasksParams> = {
  id: 'clickup_tasks',
  name: 'ClickUp Tasks',
  description: 'List, get, create, and update ClickUp tasks.',
  version: '1.0.0',

  params: {
    token: { type: 'string', required: true, requiredForToolCall: true },
    operation: { type: 'string', required: true },
    teamId: { type: 'string', description: 'Team ID for listing tasks' },
    listId: { type: 'string', description: 'List ID for creating tasks' },
    taskId: { type: 'string', description: 'Task ID for get/update' },
    data: { type: 'object', description: 'Payload for create/update' },
  },

  request: {
    url: (p) => {
      const base = 'https://api.clickup.com/api/v2'
      if (p.operation === 'list' && p.teamId)
        return `${base}/team/${encodeURIComponent(p.teamId)}/task`
      if (p.operation === 'get' && p.taskId) return `${base}/task/${encodeURIComponent(p.taskId)}`
      if (p.operation === 'create' && p.listId)
        return `${base}/list/${encodeURIComponent(p.listId)}/task`
      if (p.operation === 'update' && p.taskId)
        return `${base}/task/${encodeURIComponent(p.taskId)}`
      return `${base}/task`
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
    headers: (p) => ({ 'Content-Type': 'application/json', Authorization: p.token }),
    body: (p) =>
      (p.operation === 'create' || p.operation === 'update' ? p.data || {} : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.err || (typeof data === 'string' ? data : 'ClickUp request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'ClickUp request failed',
}
