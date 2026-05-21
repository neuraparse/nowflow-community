import { FlyioIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const FlyioBlock = defineBlock({
  type: 'flyio',
  name: 'Fly.io',
  description: 'Deploy applications globally with edge compute platform.',
  longDescription:
    'Integrate with Fly.io to deploy and manage applications on a global edge compute platform. Fly.io runs your full-stack apps close to users worldwide with fast deployments, automatic scaling, and built-in global load balancing. Perfect for deploying Docker containers, databases, and full-stack applications at the edge.',
  category: 'tools',
  bgColor: '#7B3FF2',
  icon: FlyioIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Fly.io API Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Fly.io API access token',
      password: true,
    },
    {
      id: 'organization',
      title: 'Organization Slug (Optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your organization slug',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_apps', label: 'List Apps' },
        { id: 'get_app', label: 'Get App' },
        { id: 'create_app', label: 'Create App' },
        { id: 'list_machines', label: 'List Machines' },
        { id: 'create_machine', label: 'Create Machine' },
        { id: 'start_machine', label: 'Start Machine' },
        { id: 'stop_machine', label: 'Stop Machine' },
        { id: 'get_machine', label: 'Get Machine' },
        { id: 'list_volumes', label: 'List Volumes' },
      ],
      defaultValue: 'list_apps',
    }),
    {
      id: 'appName',
      title: 'App Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'my-app',
      condition: {
        field: 'operation',
        value: ['get_app', 'create_app', 'list_machines', 'create_machine'],
      },
    },
    {
      id: 'machineId',
      title: 'Machine ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter machine ID',
      condition: { field: 'operation', value: ['start_machine', 'stop_machine', 'get_machine'] },
    },
    {
      id: 'machineConfig',
      title: 'Machine Configuration (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"image": "nginx", "guest": {"cpus": 1, "memory_mb": 256}}',
      condition: { field: 'operation', value: 'create_machine' },
    },
    {
      id: 'region',
      title: 'Region',
      type: 'short-input',
      layout: 'half',
      placeholder: 'ord (Chicago)',
      condition: { field: 'operation', value: 'create_machine' },
    },
  ],
  tools: {
    access: ['flyio_api'],
    config: {
      tool: () => 'flyio_api',
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    organization: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    appName: { type: 'string', required: false },
    machineId: { type: 'string', required: false },
    machineConfig: { type: 'json', required: false },
    region: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
