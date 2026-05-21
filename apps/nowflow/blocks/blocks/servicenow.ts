import { ServiceNowIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const ServiceNowBlock = defineBlock({
  type: 'servicenow',
  name: 'ServiceNow',
  description: 'ServiceNow Table API operations (CRUD + query) for generic tables.',
  longDescription:
    'Perform CRUD and query operations on ServiceNow tables using the Table API. Supports instance URL, OAuth Bearer token, table name, and optional query/fields/limits.',
  category: 'tools',
  bgColor: '#62D84E',
  icon: ServiceNowIcon,
  subBlocks: [
    {
      id: 'instanceUrl',
      title: 'Instance URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://your-instance.service-now.com',
    },
    {
      id: 'apiKey',
      title: 'Bearer Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter OAuth access token',
      password: true,
    },
    createOperationDropdown({
      operations: [
        { id: 'get', label: 'Get by sys_id' },
        { id: 'insert', label: 'Insert' },
        { id: 'update', label: 'Update by sys_id' },
        { id: 'delete', label: 'Delete by sys_id' },
        { id: 'query', label: 'Query (sysparm_query)' },
      ],
    }),
    { id: 'table', title: 'Table', type: 'short-input', layout: 'full', placeholder: 'incident' },
    { id: 'sysId', title: 'sys_id', type: 'short-input', layout: 'full' },
    { id: 'query', title: 'sysparm_query', type: 'short-input', layout: 'full' },
    {
      id: 'fields',
      title: 'sysparm_fields',
      type: 'short-input',
      layout: 'full',
      placeholder: 'number,short_description,priority',
    },
    { id: 'limit', title: 'sysparm_limit', type: 'short-input', layout: 'half' },
    { id: 'offset', title: 'sysparm_offset', type: 'short-input', layout: 'half' },
    {
      id: 'data',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "short_description": "..."\n}',
    },
  ],
  tools: {
    access: ['servicenow_table'],
    config: {
      tool: () => 'servicenow_table',
      params: (params) => {
        const { instanceUrl, apiKey, table, operation, sysId, query, fields, limit, offset, data } =
          params as Record<string, any>
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
        const toNum = (v: any) => (typeof v === 'string' ? (v.trim() ? Number(v) : undefined) : v)
        return {
          instanceUrl,
          apiKey,
          table,
          operation,
          sysId,
          query,
          fields,
          limit: toNum(limit),
          offset: toNum(offset),
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    instanceUrl: { type: 'string', required: true },
    apiKey: { type: 'string', required: true },
    table: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    sysId: { type: 'string', required: false },
    query: { type: 'string', required: false },
    fields: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    offset: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
