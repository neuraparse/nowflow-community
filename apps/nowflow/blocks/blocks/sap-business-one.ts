import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPBusinessOneBlock = defineBlock({
  type: 'sap_business_one',
  name: 'SAP Business One',
  description: 'Manage SMB operations including financials and sales',
  longDescription:
    'Integrate SAP Business One to manage business partners, items, orders, invoices, inventory, and general ledger using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP Business One Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 'business-one',
      requiredScopes: [
        'sl.businesspartner',
        'sl.items',
        'sl.orders',
        'sl.invoices',
        'sl.inventory',
        'sl.generalledger',
      ],
      title: 'SAP Business One Account',
      placeholder: 'Select SAP Business One account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'BusinessPartners', label: 'Business Partners' },
        { id: 'Items', label: 'Items' },
        { id: 'Orders', label: 'Orders' },
        { id: 'Invoices', label: 'Invoices' },
        { id: 'InventoryGenEntries', label: 'Inventory' },
        { id: 'JournalEntries', label: 'General Ledger' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., $crossjoin(Items,BusinessPartners)',
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
      placeholder: "$filter=CardType eq 'C'&$select=CardCode,CardName&$top=20",
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "CardCode": "C001",\n  "CardName": "Customer ABC"\n}',
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
          baseUrl: '${SAP_BUSINESS_ONE_BASE_URL}',
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
