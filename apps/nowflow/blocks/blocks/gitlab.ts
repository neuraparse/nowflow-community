import { GitLabIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const GitLabBlock = defineBlock({
  type: 'gitlab',
  name: 'GitLab',
  description: 'GitLab Issues operations: list, get, create.',
  longDescription:
    'Connect to GitLab API to manage project issues. Provide base URL, project ID or path, and token.',
  category: 'tools',
  bgColor: '#FC6D26',
  icon: GitLabIcon,
  subBlocks: [
    {
      id: 'baseUrl',
      title: 'Base URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://gitlab.com/api/v4',
    },
    { id: 'projectId', title: 'Project ID/Path', type: 'short-input', layout: 'full' },
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Issues' },
        { id: 'get', label: 'Get Issue' },
        { id: 'create', label: 'Create Issue' },
      ],
    }),
    { id: 'issueIid', title: 'Issue IID', type: 'short-input', layout: 'half' },
    { id: 'search', title: 'Search', type: 'short-input', layout: 'half' },
    { id: 'labels', title: 'Labels', type: 'short-input', layout: 'full' },
    {
      id: 'state',
      title: 'State',
      type: 'short-input',
      layout: 'half',
      placeholder: 'opened|closed|all',
    },
    {
      id: 'data',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "title": "New issue"\n}',
    },
  ],
  tools: {
    access: ['gitlab_issues'],
    config: {
      tool: () => 'gitlab_issues',
      params: (params) => {
        const { baseUrl, projectId, token, operation, issueIid, search, labels, state, data } =
          params as Record<string, any>
        const parseJSON = (v: any) => {
          if (typeof v === 'string' && v.trim()) {
            try {
              return JSON.parse(v)
            } catch {
              return undefined
            }
          }
          return v
        }
        const toNum = (v: any) => (typeof v === 'string' ? (v.trim() ? Number(v) : undefined) : v)
        return {
          baseUrl,
          projectId,
          token,
          operation,
          issueIid: toNum(issueIid),
          search,
          labels,
          state,
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    baseUrl: { type: 'string', required: true },
    projectId: { type: 'string', required: true },
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    issueIid: { type: 'string', required: false },
    search: { type: 'string', required: false },
    labels: { type: 'string', required: false },
    state: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
