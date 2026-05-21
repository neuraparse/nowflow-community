import { PlanetScaleIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const PlanetScaleBlock: BlockConfig = {
  type: 'planetscale',
  name: 'PlanetScale',
  description: 'Serverless MySQL with branching workflow',
  longDescription:
    'Integrate with PlanetScale MySQL to manage databases, create branches for schema changes, handle deploy requests, and scale horizontally. Features Git-like branching for databases with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#000000',
  icon: PlanetScaleIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'PlanetScale Account',
      type: 'oauth-input',
      layout: 'full',
      provider: 'planetscale',
      serviceId: 'planetscale',
      requiredScopes: [],
      placeholder: 'Select PlanetScale account',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'list_databases', label: 'List Databases' },
        { id: 'get_database', label: 'Get Database' },
        { id: 'create_database', label: 'Create Database' },
        { id: 'list_branches', label: 'List Branches' },
        { id: 'create_branch', label: 'Create Branch' },
        { id: 'create_deploy_request', label: 'Create Deploy Request' },
        { id: 'list_deploy_requests', label: 'List Deploy Requests' },
        { id: 'get_connection_strings', label: 'Get Connection Strings' },
      ],
      value: () => 'list_databases',
    },
    {
      id: 'organization',
      title: 'Organization',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter organization name',
    },
    {
      id: 'database',
      title: 'Database Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter database name',
      condition: {
        field: 'operation',
        value: [
          'get_database',
          'list_branches',
          'create_branch',
          'create_deploy_request',
          'list_deploy_requests',
          'get_connection_strings',
        ],
      },
    },
    {
      id: 'branchName',
      title: 'Branch Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'dev, staging, feature-schema',
      condition: { field: 'operation', value: 'create_branch' },
    },
  ],
  tools: {
    access: ['planetscale_api'],
    config: {
      tool: () => 'planetscale_api',
      params: (params) => params,
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    organization: { type: 'string', required: false },
    database: { type: 'string', required: false },
    branchName: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
