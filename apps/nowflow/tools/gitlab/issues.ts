import { ToolConfig } from '../types'

interface GitLabIssuesParams {
  baseUrl: string // e.g., https://gitlab.com/api/v4
  projectId: string | number
  token: string // Private token or OAuth token
  operation: 'list' | 'get' | 'create'
  issueIid?: number
  search?: string
  labels?: string
  state?: 'opened' | 'closed' | 'all'
  data?: Record<string, any>
}

export const gitlabIssuesTool: ToolConfig<GitLabIssuesParams> = {
  id: 'gitlab_issues',
  name: 'GitLab Issues',
  description: 'List, get, and create GitLab issues via REST API.',
  version: '1.0.0',

  params: {
    baseUrl: {
      type: 'string',
      required: true,
      description: 'Base GitLab API URL (e.g., https://gitlab.com/api/v4)',
    },
    projectId: { type: 'string', required: true, description: 'Project ID or path' },
    token: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Private or OAuth token',
    },
    operation: { type: 'string', required: true, description: 'Operation: list/get/create' },
    issueIid: { type: 'number', description: 'Issue IID for get (not ID)' },
    search: { type: 'string', description: 'Search term for list' },
    labels: { type: 'string', description: 'Comma-separated labels for list' },
    state: { type: 'string', description: 'opened|closed|all for list' },
    data: { type: 'object', description: 'Payload for create' },
  },

  request: {
    url: (p) => {
      const base = `${p.baseUrl.replace(/\/$/, '')}/projects/${encodeURIComponent(String(p.projectId))}/issues`
      if (p.operation === 'get' && p.issueIid) return `${base}/${p.issueIid}`
      return base
    },
    method: (p) => (p.operation === 'create' ? 'POST' : 'GET'),
    headers: (p) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.token}`,
    }),
    query: (p) => {
      if (p.operation === 'list') {
        const q: Record<string, string> = {}
        if (p.search) q.search = p.search
        if (p.labels) q.labels = p.labels
        if (p.state) q.state = p.state
        return q
      }
      return {}
    },
    body: (p) => (p.operation === 'create' ? p.data || {} : undefined) as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.message || (typeof data === 'string' ? data : 'GitLab request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'GitLab request failed',
}
