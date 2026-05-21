import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPFieldglassBlock = defineBlock({
  type: 'sap_fieldglass',
  name: 'SAP Fieldglass',
  description: 'Manage contingent workforce and vendor management',
  longDescription:
    'Integrate SAP Fieldglass to manage workers, job postings, timesheets, and invoices using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP Fieldglass Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 'fieldglass',
      requiredScopes: [
        'worker.read',
        'worker.write',
        'job_posting.read',
        'job_posting.write',
        'timesheet.read',
        'invoice.read',
      ],
      title: 'SAP Fieldglass Account',
      placeholder: 'Select SAP Fieldglass account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'Workers', label: 'Workers' },
        { id: 'JobPostings', label: 'Job Postings' },
        { id: 'Timesheets', label: 'Timesheets' },
        { id: 'Invoices', label: 'Invoices' },
        { id: 'WorkOrders', label: 'Work Orders' },
        { id: 'Suppliers', label: 'Suppliers' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., api/v2/resource',
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
      placeholder: 'status=ACTIVE&limit=10',
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "workerID": "W-12345",\n  "name": "John Doe"\n}',
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
          baseUrl: '${SAP_FIELDGLASS_BASE_URL}',
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
