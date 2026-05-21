import { RenderIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const RenderBlock = defineBlock({
  type: 'render',
  name: 'Render',
  description: 'Cloud hosting and deployment platform',
  longDescription:
    'Integrate with Render to deploy web services, static sites, databases, and cron jobs. Manage services, deployments, environment variables, and monitor application performance with API key authentication.',
  category: 'tools',
  bgColor: '#46E3B7',
  icon: RenderIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Render API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Render API key',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_services', label: 'List Services' },
        { id: 'get_service', label: 'Get Service' },
        { id: 'create_service', label: 'Create Service' },
        { id: 'list_deploys', label: 'List Deploys' },
        { id: 'trigger_deploy', label: 'Trigger Deploy' },
        { id: 'get_deploy', label: 'Get Deploy' },
        { id: 'list_env_vars', label: 'List Environment Variables' },
      ],
      defaultValue: 'list_services',
    }),
    {
      id: 'serviceId',
      title: 'Service ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter service ID',
      condition: {
        field: 'operation',
        value: ['get_service', 'list_deploys', 'trigger_deploy', 'list_env_vars'],
      },
    },
    {
      id: 'deployId',
      title: 'Deploy ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter deploy ID',
      condition: { field: 'operation', value: 'get_deploy' },
    },
  ],
  tools: {
    access: ['render_api'],
    config: createSimpleToolConfig('render_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    serviceId: { type: 'string', required: false },
    deployId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
