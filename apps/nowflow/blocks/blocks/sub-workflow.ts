import { PlayButtonIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const SubWorkflowBlock: BlockConfig = {
  type: 'sub-workflow',
  name: 'Sub-Workflow',
  description: 'Run another workflow and use its output',
  longDescription:
    'Execute any published workflow from within your current workflow. Pass input data as JSON and receive the sub-workflow output in return. The target workflow must be deployed (have an active API endpoint). Use this block to compose complex automations from reusable workflow modules.',
  category: 'blocks',
  bgColor: '#6366F1',
  icon: PlayButtonIcon,
  subBlocks: [
    {
      id: 'workflowId',
      title: 'Workflow ID',
      type: 'short-input',
      placeholder: 'Paste the target workflow ID here...',
    },
    {
      id: 'inputData',
      title: 'Input Data (JSON)',
      type: 'code',
      placeholder: '{\n  "key": "value"\n}',
    },
  ],
  tools: { access: [] },
  inputs: {
    workflowId: { type: 'string', required: true },
    inputData: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'any',
        executionId: 'string',
        status: 'string',
      },
    },
  },
}
