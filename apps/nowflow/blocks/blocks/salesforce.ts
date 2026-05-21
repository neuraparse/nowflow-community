import { SalesforceIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const SalesforceBlock = defineBlock({
  type: 'salesforce',
  name: 'Salesforce',
  description: 'Salesforce Opportunities operations (create, update, search, delete).',
  longDescription:
    'Manage Salesforce Opportunities with CRUD operations. Supports key fields like name, stage, amount, probability, and custom properties.',
  category: 'tools',
  bgColor: '#00A1E0',
  icon: SalesforceIcon,
  subBlocks: [
    {
      id: 'apiKey',
      title: 'API Key (Bearer)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Salesforce API key',
      password: true,
    },
    createOperationDropdown({
      id: 'action',
      title: 'Action',
      operations: [
        { id: 'create', label: 'Create' },
        { id: 'update', label: 'Update' },
        { id: 'search', label: 'Search' },
        { id: 'delete', label: 'Delete' },
      ],
    }),
    { id: 'id', title: 'Opportunity ID', type: 'short-input', layout: 'full' },
    { id: 'name', title: 'Name', type: 'short-input', layout: 'full' },
    { id: 'accountId', title: 'Account ID', type: 'short-input', layout: 'full' },
    { id: 'stage', title: 'Stage Name', type: 'short-input', layout: 'full' },
    { id: 'amount', title: 'Amount', type: 'short-input', layout: 'full' },
    { id: 'closeDate', title: 'Close Date (YYYY-MM-DD)', type: 'short-input', layout: 'full' },
    { id: 'probability', title: 'Probability (%)', type: 'short-input', layout: 'full' },
    {
      id: 'properties',
      title: 'Additional Fields (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "CustomField__c": "value"\n}',
    },
    { id: 'limit', title: 'Limit', type: 'short-input', layout: 'half' },
    { id: 'offset', title: 'Offset', type: 'short-input', layout: 'half' },
  ],
  tools: {
    access: ['salesforce_opportunities'],
    config: {
      tool: () => 'salesforce_opportunities',
      params: (params) => {
        const {
          apiKey,
          action,
          id,
          name,
          accountId,
          stage,
          amount,
          closeDate,
          probability,
          properties,
          limit,
          offset,
        } = params as Record<string, any>

        const parsedProps = (() => {
          if (typeof properties === 'string' && properties.trim().length) {
            try {
              return JSON.parse(properties)
            } catch {
              return undefined
            }
          }
          return properties
        })()

        const toNum = (v: any) => (typeof v === 'string' ? (v.trim() ? Number(v) : undefined) : v)

        return {
          apiKey,
          action,
          id,
          name,
          accountId,
          stage,
          amount: toNum(amount),
          closeDate,
          probability: toNum(probability),
          properties: parsedProps,
          limit: toNum(limit),
          offset: toNum(offset),
          data: parsedProps || {},
        }
      },
    },
  },
  inputs: {
    apiKey: { type: 'string', required: true },
    action: { type: 'string', required: true },
    id: { type: 'string', required: false },
    name: { type: 'string', required: false },
    accountId: { type: 'string', required: false },
    stage: { type: 'string', required: false },
    amount: { type: 'string', required: false },
    closeDate: { type: 'string', required: false },
    probability: { type: 'string', required: false },
    properties: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    offset: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        records: 'json',
        totalResults: 'number',
        pagination: 'json',
      },
    },
  },
})
