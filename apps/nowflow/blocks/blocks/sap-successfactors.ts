import { SAPIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SAPSuccessFactorsBlock = defineBlock({
  type: 'sap_successfactors',
  name: 'SAP SuccessFactors',
  description: 'Manage HR processes and employee data',
  longDescription:
    'Integrate SAP SuccessFactors HCM functionality to manage employees, recruiting, performance goals, and learning using OAuth authentication.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    // SAP SuccessFactors Credentials
    createOAuthSubBlock({
      provider: 'sap',
      serviceId: 'successfactors',
      requiredScopes: [
        'user_management',
        'employee_central',
        'recruiting',
        'performance_goals',
        'learning',
      ],
      title: 'SAP SuccessFactors Account',
      placeholder: 'Select SAP SuccessFactors account',
    }),
    // Resource Selection
    {
      id: 'resource',
      title: 'Resource',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'User', label: 'Users' },
        { id: 'EmpJob', label: 'Employee Jobs' },
        { id: 'JobRequisition', label: 'Job Requisitions' },
        { id: 'Candidate', label: 'Candidates' },
        { id: 'Goal', label: 'Performance Goals' },
        { id: 'LearningActivity', label: 'Learning Activities' },
        { id: 'custom', label: 'Custom Resource' },
      ],
    },
    {
      id: 'customResource',
      title: 'Custom Resource Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., odata/v2/EntitySet',
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
      placeholder: "$filter=status eq 'active'&$select=userId,firstName,lastName",
      condition: { field: 'operation', value: 'list' },
    },
    // Data Payload
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "userId": "emp001",\n  "firstName": "John",\n  "lastName": "Doe"\n}',
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
          baseUrl: '${SAP_SUCCESSFACTORS_BASE_URL}',
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
