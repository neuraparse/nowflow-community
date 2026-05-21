import { PipedriveIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const PipedriveBlock = defineBlock({
  type: 'pipedrive',
  name: 'Pipedrive',
  description: 'Manage Pipedrive deals: list, get, create, update.',
  longDescription: 'Pipedrive Deals via REST API with api_token.',
  category: 'tools',
  bgColor: '#00D084',
  icon: PipedriveIcon,
  subBlocks: [
    { id: 'apiToken', title: 'API Token', type: 'short-input', layout: 'full', password: true },
    {
      id: 'baseUrl',
      title: 'Base URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://api.pipedrive.com/v1',
    },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Deals' },
        { id: 'get', label: 'Get Deal' },
        { id: 'create', label: 'Create Deal' },
        { id: 'update', label: 'Update Deal' },
      ],
    }),
    {
      id: 'dealId',
      title: 'Deal ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'For get/update',
    },
    {
      id: 'search',
      title: 'Search Term',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Optional',
    },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['pipedrive_deals'],
    config: {
      tool: () => 'pipedrive_deals',
      params: (params) => {
        const { apiToken, baseUrl, operation, dealId, search, data } = params as Record<string, any>
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
        return { apiToken, baseUrl, operation, dealId, search, data: parseJSON(data) }
      },
    },
  },
  inputs: {
    apiToken: { type: 'string', required: true },
    baseUrl: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    dealId: { type: 'string', required: false },
    search: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
})
