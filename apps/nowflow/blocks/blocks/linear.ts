import { LinearIcon } from '@/components/icons'
import { createOperationDropdown, createParamTransformer, defineBlock } from '../helpers'

export const LinearBlock = defineBlock({
  type: 'linear',
  name: 'Linear',
  description: 'Linear Issues via GraphQL: list, get, create.',
  longDescription: 'Manage Linear issues using GraphQL API. Supports custom queries.',
  category: 'tools',
  bgColor: '#5E6AD2',
  icon: LinearIcon,
  subBlocks: [
    { id: 'apiKey', title: 'API Key', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Issues' },
        { id: 'get', label: 'Get Issue' },
        { id: 'create', label: 'Create Issue' },
      ],
    }),
    { id: 'issueId', title: 'Issue ID', type: 'short-input', layout: 'half' },
    { id: 'teamId', title: 'Team ID', type: 'short-input', layout: 'half' },
    {
      id: 'query',
      title: 'Custom Query',
      type: 'code',
      layout: 'full',
      language: 'graphql',
      placeholder: 'query { viewer { id } }',
    },
    {
      id: 'variables',
      title: 'Variables (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "input": { "title": "New issue" }\n}',
    },
  ],
  tools: {
    access: ['linear_issues'],
    config: {
      tool: () => 'linear_issues',
      params: createParamTransformer({ variables: 'json' }),
    },
  },
  inputs: {
    apiKey: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    issueId: { type: 'string', required: false },
    teamId: { type: 'string', required: false },
    query: { type: 'string', required: false },
    variables: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
