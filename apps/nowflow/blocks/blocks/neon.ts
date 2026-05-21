import { NeonIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const NeonBlock = defineBlock({
  type: 'neon',
  name: 'Neon',
  description: 'Serverless Postgres with branching and autoscaling',
  longDescription:
    'Integrate with Neon serverless PostgreSQL to create projects, manage database branches, configure autoscaling, and execute queries. Features instant branching and scale-to-zero capabilities with API key authentication.',
  category: 'tools',
  bgColor: '#00E699',
  icon: NeonIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Neon API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Neon API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_projects', label: 'List Projects' },
        { id: 'get_project', label: 'Get Project' },
        { id: 'create_project', label: 'Create Project' },
        { id: 'list_branches', label: 'List Branches' },
        { id: 'create_branch', label: 'Create Branch' },
        { id: 'get_connection_string', label: 'Get Connection String' },
        { id: 'list_databases', label: 'List Databases' },
      ],
      defaultValue: 'list_projects',
    }),
    {
      id: 'projectId',
      title: 'Project ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter project ID',
      condition: {
        field: 'operation',
        value: [
          'get_project',
          'list_branches',
          'create_branch',
          'get_connection_string',
          'list_databases',
        ],
      },
    },
    {
      id: 'branchName',
      title: 'Branch Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'dev, staging, feature-x',
      condition: { field: 'operation', value: 'create_branch' },
    },
    {
      id: 'projectName',
      title: 'Project Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'my-project',
      condition: { field: 'operation', value: 'create_project' },
    },
  ],
  tools: {
    access: ['neon_api'],
    config: createSimpleToolConfig('neon_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    projectId: { type: 'string', required: false },
    branchName: { type: 'string', required: false },
    projectName: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
