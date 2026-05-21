import { ToolConfig } from '../types'

interface LinearIssuesParams {
  apiKey: string
  operation: 'list' | 'get' | 'create'
  issueId?: string
  teamId?: string
  query?: string
  variables?: Record<string, any>
}

const ENDPOINT = 'https://api.linear.app/graphql'

export const linearIssuesTool: ToolConfig<LinearIssuesParams> = {
  id: 'linear_issues',
  name: 'Linear Issues',
  description: 'List, get, and create Linear issues via GraphQL.',
  version: '1.0.0',

  params: {
    apiKey: {
      type: 'string',
      required: true,
      requiredForToolCall: true,
      description: 'Linear API Key',
    },
    operation: { type: 'string', required: true, description: 'Operation: list/get/create' },
    issueId: { type: 'string', description: 'Issue ID for get' },
    teamId: { type: 'string', description: 'Team ID for list/create' },
    query: { type: 'string', description: 'Custom GraphQL query (optional)' },
    variables: { type: 'object', description: 'Variables for custom query' },
  },

  request: {
    url: () => ENDPOINT,
    method: () => 'POST',
    headers: (p) => ({ 'Content-Type': 'application/json', Authorization: p.apiKey }),
    body: (p) => {
      // If a custom query is provided, send it as-is
      if (p.query) return { query: p.query, variables: p.variables || {} } as any

      // Otherwise, build some common operations
      if (p.operation === 'get' && p.issueId) {
        return {
          query: `query Issue($id: String!) { issue(id: $id) { id title description state { name } assignee { name } } }`,
          variables: { id: p.issueId },
        } as any
      }

      if (p.operation === 'list') {
        return {
          query: `query Issues($teamId: String) { issues(filter: { team: { id: { eq: $teamId } } }) { nodes { id title description } } }`,
          variables: { teamId: p.teamId },
        } as any
      }

      if (p.operation === 'create') {
        return {
          query: `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title } } }`,
          variables: { input: p.variables || {} },
        } as any
      }

      return { query: 'query { viewer { id } }' } as any
    },
  },

  transformResponse: async (response) => {
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) {
      const message = (data as any)?.errors?.[0]?.message || 'Linear request failed'
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Linear request failed',
}
