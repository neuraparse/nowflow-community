import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPAribaBlock = defineBlock({
  type: 'sap_ariba',
  name: 'SAP Ariba',
  description: 'Manage procurement and supplier relationships',
  longDescription:
    'Integrate SAP Ariba to manage procurement, suppliers, sourcing processes, and contracts using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP Ariba Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 'ariba',
      requiredScopes: [
        'procurement.read',
        'procurement.write',
        'supplier.read',
        'supplier.write',
        'sourcing.read',
        'contract.read',
      ],
      title: 'SAP Ariba Account',
      placeholder: 'Select SAP Ariba account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'PurchaseRequisitions', label: 'Purchase Requisitions' },
        { id: 'PurchaseOrders', label: 'Purchase Orders' },
        { id: 'Suppliers', label: 'Suppliers' },
        { id: 'Contracts', label: 'Contracts' },
        { id: 'SourcingProjects', label: 'Sourcing Projects' },
        { id: 'Invoices', label: 'Invoices' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., api/resource/v2',
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
      placeholder: "$filter=Status eq 'Approved'&$select=ID,SupplierName",
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "requisitionID": "PR-12345",\n  "supplierID": "SUP001"\n}',
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
          baseUrl: '${SAP_ARIBA_BASE_URL}',
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
