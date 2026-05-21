import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPS4HANABlock = defineBlock({
  type: 'sap_s4hana',
  name: 'SAP S/4HANA',
  description: 'Access SAP S/4HANA ERP data and business processes',
  longDescription:
    'Integrate SAP S/4HANA ERP functionality to manage sales orders, business partners, material stock, and production orders using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP S/4HANA Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 's4hana',
      requiredScopes: [
        'API_SALES_ORDER_SRV_0001',
        'API_BUSINESS_PARTNER',
        'API_MATERIAL_STOCK_SRV',
        'API_PRODUCTION_ORDER_2_SRV',
      ],
      title: 'SAP S/4HANA Account',
      placeholder: 'Select SAP S/4HANA account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'SalesOrder', label: 'Sales Orders' },
        { id: 'BusinessPartner', label: 'Business Partners' },
        { id: 'MaterialStock', label: 'Material Stock' },
        { id: 'ProductionOrder', label: 'Production Orders' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., API_CUSTOM_SRV/EntitySet',
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
    // Entity ID for get/update/delete
    {
      id: 'id',
      title: 'Entity ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Entity identifier',
      condition: { field: 'operation', value: ['get', 'update', 'delete'] },
    },
    // OData Query Parameters
    {
      id: 'query',
      title: 'Query Parameters',
      type: 'short-input',
      layout: 'full',
      placeholder: "$filter=Status eq 'Open'&$select=ID,Name&$top=10",
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload for create/update
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "SalesOrderID": "12345",\n  "CustomerID": "C001"\n}',
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

        // Determine actual resource path
        const resourcePath = resource === 'custom' ? customResource : resource

        // Parse JSON data
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
          baseUrl: '${SAP_S4HANA_BASE_URL}', // Will be replaced with actual URL
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
