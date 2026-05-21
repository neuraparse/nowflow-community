import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPConcurBlock = defineBlock({
  type: 'sap_concur',
  name: 'SAP Concur',
  description: 'Automate expense reporting and travel booking',
  longDescription:
    'Integrate SAP Concur to manage expense reports, travel requests, and invoices using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP Concur Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 'concur',
      requiredScopes: [
        'expense.report.read',
        'expense.report.write',
        'travel.request.read',
        'travel.request.write',
        'invoice.read',
        'invoice.write',
      ],
      title: 'SAP Concur Account',
      placeholder: 'Select SAP Concur account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'expense/expensereports', label: 'Expense Reports' },
        { id: 'travelrequest/requests', label: 'Travel Requests' },
        { id: 'invoice/invoices', label: 'Invoices' },
        { id: 'expense/receipts', label: 'Receipts' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., api/v4.0/resource',
      condition: { field: 'resource', value: 'custom' },
    },
    // Operation
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List All' },
        { id: 'get', label: 'Get by ID' },
        { id: 'create', label: 'Create' },
        { id: 'update', label: 'Update' },
        { id: 'delete', label: 'Delete' },
      ],
    }),
    // Entity ID
    {
      id: 'id',
      title: 'Entity ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Entity identifier',
      condition: { field: 'operation', value: ['get', 'update', 'delete'] },
    },
    // Query Parameters
    {
      id: 'query',
      title: 'Query Parameters',
      type: 'short-input',
      layout: 'full',
      placeholder: 'status=SUBMITTED&limit=10',
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "reportName": "Q1 Expenses",\n  "purpose": "Client visit"\n}',
      condition: { field: 'operation', value: ['create', 'update'] },
    },
  ],
  tools: {
    access: ['sap_odata'],
    config: {
      tool: () => 'sap_odata',
      params: (params) => {
        const { credential, resource, customResource, operation, id, query, data } =
          params as Record<string, any>

        const resourcePath = resource === 'custom' ? customResource : resource

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

        return {
          credential,
          baseUrl: '${SAP_CONCUR_BASE_URL}',
          resource: resourcePath,
          operation,
          id,
          query,
          authType: 'oauth',
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    resource: { type: 'string', required: true },
    customResource: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    id: { type: 'string', required: false },
    query: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
