import { RailwayIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const RailwayBlock = defineBlock({
  type: 'railway',
  name: 'Railway',
  description: 'Infrastructure and backend deployment platform',
  longDescription:
    'Integrate with Railway to deploy backend applications, manage services, create databases, configure environments, and monitor infrastructure. Supports full-stack deployment with GraphQL API and token authentication.',
  category: 'tools',
  bgColor: '#0B0D0E',
  icon: RailwayIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Railway API Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Railway API token (Team, Account, or Project token)',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_projects', label: 'List Projects' },
        { id: 'get_project', label: 'Get Project' },
        { id: 'list_services', label: 'List Services' },
        { id: 'get_service', label: 'Get Service' },
        { id: 'create_service', label: 'Create Service' },
        { id: 'list_deployments', label: 'List Deployments' },
        { id: 'trigger_deployment', label: 'Trigger Deployment' },
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
        value: ['get_project', 'list_services', 'create_service', 'list_deployments'],
      },
    },
    {
      id: 'serviceId',
      title: 'Service ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter service ID',
      condition: { field: 'operation', value: ['get_service', 'trigger_deployment'] },
    },
  ],
  tools: {
    access: ['railway_api'],
    config: createSimpleToolConfig('railway_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    projectId: { type: 'string', required: false },
    serviceId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
