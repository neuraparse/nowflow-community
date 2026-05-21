import { ReplicateIcon } from '@/components/icons'
import { createOperationDropdown, createParamTransformer, defineBlock } from '../helpers'

export const ReplicateBlock = defineBlock({
  type: 'replicate',
  name: 'Replicate',
  description: 'Run AI models with cloud API',
  longDescription:
    'Integrate with Replicate to run thousands of AI models including image generation, LLMs, speech recognition, and more. Deploy custom models without managing infrastructure using API token authentication.',
  category: 'tools',
  bgColor: '#000000',
  icon: ReplicateIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Replicate API Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Replicate API token',
    },
    createOperationDropdown({
      operations: [
        { id: 'run_prediction', label: 'Run Prediction' },
        { id: 'get_prediction', label: 'Get Prediction' },
        { id: 'list_models', label: 'List Models' },
        { id: 'get_model', label: 'Get Model' },
      ],
      defaultValue: 'run_prediction',
    }),
    {
      id: 'model',
      title: 'Model',
      type: 'short-input',
      layout: 'full',
      placeholder: 'owner/model-name:version or owner/model-name',
      condition: { field: 'operation', value: ['run_prediction', 'get_model'] },
    },
    {
      id: 'input',
      title: 'Model Input (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"prompt": "a cat", "width": 512}',
      condition: { field: 'operation', value: 'run_prediction' },
    },
    {
      id: 'predictionId',
      title: 'Prediction ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter prediction ID',
      condition: { field: 'operation', value: 'get_prediction' },
    },
  ],
  tools: {
    access: ['replicate_api'],
    config: {
      tool: () => 'replicate_api',
      params: createParamTransformer({ input: 'json' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    model: { type: 'string', required: false },
    input: { type: 'string', required: false },
    predictionId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
