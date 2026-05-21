import { ClickUpIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const ClickUpBlock = defineBlock({
  type: 'clickup',
  name: 'ClickUp',
  description: 'ClickUp Tasks: list/get/create/update.',
  longDescription: 'Use ClickUp API to manage tasks across teams and lists.',
  category: 'tools',
  bgColor: '#7B68EE',
  icon: ClickUpIcon,
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
    { id: 'teamId', title: 'Team ID', type: 'short-input', layout: 'half' },
    { id: 'listId', title: 'List ID', type: 'short-input', layout: 'half' },
    { id: 'taskId', title: 'Task ID', type: 'short-input', layout: 'half' },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['clickup_tasks'],
    config: {
      tool: () => 'clickup_tasks',
      params: (params) => {
        const { token, operation, teamId, listId, taskId, data } = params as Record<string, any>
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
        return { token, operation, teamId, listId, taskId, data: parseJSON(data) }
      },
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    teamId: { type: 'string', required: false },
    listId: { type: 'string', required: false },
    taskId: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
