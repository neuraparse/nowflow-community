import { AsanaIcon } from '@/components/icons'
import { createOperationDropdown, createParamTransformer, defineBlock } from '../helpers'

export const AsanaBlock = defineBlock({
  type: 'asana',
  name: 'Asana',
  description: 'Asana Tasks operations: list, get, create, update.',
  longDescription: 'Use Asana API with Personal Access Token to manage tasks.',
  category: 'tools',
  bgColor: '#F06A6A',
  icon: AsanaIcon,
  subBlocks: [
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Tasks' },
        { id: 'get', label: 'Get Task' },
        { id: 'create', label: 'Create Task' },
        { id: 'update', label: 'Update Task' },
      ],
    }),
    { id: 'projectId', title: 'Project ID', type: 'short-input', layout: 'half' },
    { id: 'taskId', title: 'Task ID', type: 'short-input', layout: 'half' },
    { id: 'limit', title: 'Limit', type: 'short-input', layout: 'half' },
    { id: 'offset', title: 'Offset', type: 'short-input', layout: 'half' },
    {
      id: 'data',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "name": "New task"\n}',
    },
  ],
  tools: {
    access: ['asana_tasks'],
    config: {
      tool: () => 'asana_tasks',
      params: createParamTransformer({
        limit: 'number',
        data: 'json',
      }),
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    projectId: { type: 'string', required: false },
    taskId: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    offset: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
