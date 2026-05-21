import { RetoolIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const RetoolBlock = defineBlock({
  type: 'retool',
  name: 'Retool',
  description: 'Build internal tools fast with low-code platform for developers.',
  longDescription:
    'Integrate with Retool to programmatically manage internal tools, workflows, and automation. Retool is a low-code platform that helps developers build internal tools 10x faster by combining pre-built UI components with your own code, databases, and APIs. Perfect for admin panels, dashboards, and operational tools.',
  category: 'tools',
  bgColor: '#3D3D3D',
  icon: RetoolIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Retool API Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Retool API access token',
      password: true,
    },
    {
      id: 'subdomain',
      title: 'Retool Subdomain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'your-company (from your-company.retool.com)',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_apps', label: 'List Apps' },
        { id: 'get_app', label: 'Get App' },
        { id: 'list_resources', label: 'List Resources' },
        { id: 'get_resource', label: 'Get Resource' },
        { id: 'list_folders', label: 'List Folders' },
        { id: 'trigger_workflow', label: 'Trigger Workflow' },
      ],
      defaultValue: 'list_apps',
    }),
    {
      id: 'appId',
      title: 'App ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter app ID',
      condition: { field: 'operation', value: 'get_app' },
    },
    {
      id: 'resourceId',
      title: 'Resource ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter resource ID',
      condition: { field: 'operation', value: 'get_resource' },
    },
    {
      id: 'workflowId',
      title: 'Workflow ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter workflow ID',
      condition: { field: 'operation', value: 'trigger_workflow' },
    },
    {
      id: 'workflowParams',
      title: 'Workflow Parameters (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"param1": "value1", "param2": "value2"}',
      condition: { field: 'operation', value: 'trigger_workflow' },
    },
  ],
  tools: {
    access: ['retool_api'],
    config: {
      tool: () => 'retool_api',
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    subdomain: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    appId: { type: 'string', required: false },
    resourceId: { type: 'string', required: false },
    workflowId: { type: 'string', required: false },
    workflowParams: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
