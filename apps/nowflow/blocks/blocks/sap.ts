import { SAPIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const SAPODataBlock = defineBlock({
  type: 'sap_odata',
  name: 'SAP OData',
  description: 'Generic SAP OData operations (list/get/create/update/delete).',
  longDescription:
    'Connect to SAP OData endpoints with Basic or Bearer auth. Supports CRUD operations and custom $filter/$select queries.',
  category: 'tools',
  bgColor: '#0FAAFF',
  icon: SAPIcon,
  subBlocks: [
    {
      id: 'baseUrl',
      title: 'Base URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://example.sap.com/odata/v2',
    },
    {
      id: 'resource',
      title: 'Resource',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Products',
    },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List' },
        { id: 'get', label: 'Get' },
        { id: 'create', label: 'Create' },
        { id: 'update', label: 'Update' },
        { id: 'delete', label: 'Delete' },
      ],
    }),
    { id: 'id', title: 'Entity ID', type: 'short-input', layout: 'full' },
    {
      id: 'query',
      title: 'Query',
      type: 'short-input',
      layout: 'full',
      placeholder: '$filter=Name eq "X"&$select=Id,Name',
    },
    {
      id: 'authType',
      title: 'Auth Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'bearer', label: 'Bearer' },
        { id: 'basic', label: 'Basic' },
      ],
    },
    { id: 'username', title: 'Username', type: 'short-input', layout: 'half' },
    { id: 'password', title: 'Password', type: 'short-input', layout: 'half', password: true },
    { id: 'token', title: 'Token', type: 'short-input', layout: 'half', password: true },
    {
      id: 'headers',
      title: 'Headers (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "Accept-Language": "en-US"\n}',
    },
    {
      id: 'data',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "Name": "New"\n}',
    },
  ],
  tools: {
    access: ['sap_odata'],
    config: {
      tool: () => 'sap_odata',
      params: (params) => {
        const {
          baseUrl,
          resource,
          operation,
          id,
          query,
          headers,
          authType,
          username,
          password,
          token,
          data,
        } = params as Record<string, any>
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
          baseUrl,
          resource,
          operation,
          id,
          query,
          headers: parseJSON(headers),
          authType,
          username,
          password,
          token,
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    baseUrl: { type: 'string', required: true },
    resource: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    id: { type: 'string', required: false },
    query: { type: 'string', required: false },
    headers: { type: 'string', required: false },
    authType: { type: 'string', required: false },
    username: { type: 'string', required: false },
    password: { type: 'string', required: false },
    token: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
