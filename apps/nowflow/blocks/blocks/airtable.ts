import { AirtableIcon } from '@/components/icons'
import {
  AirtableCreateResponse,
  AirtableGetResponse,
  AirtableListResponse,
  AirtableUpdateMultipleResponse,
  AirtableUpdateResponse,
} from '@/tools/airtable/types'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  defineBlock,
  parseJsonStrict,
} from '../helpers'

type AirtableResponse =
  | AirtableListResponse
  | AirtableGetResponse
  | AirtableCreateResponse
  | AirtableUpdateResponse
  | AirtableUpdateMultipleResponse

export const AirtableBlock = defineBlock<AirtableResponse>({
  type: 'airtable',
  name: 'Airtable',
  description: 'Read, create, and update Airtable',
  longDescription:
    'Integrate Airtable functionality to manage table records. List, get, create, ' +
    'update single, or update multiple records using OAuth authentication. ' +
    'Requires base ID, table ID, and operation-specific parameters.',
  category: 'tools',
  bgColor: '#E0E0E0',
  icon: AirtableIcon,
  subBlocks: [
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Records' },
        { id: 'get', label: 'Get Record' },
        { id: 'create', label: 'Create Records' },
        { id: 'update', label: 'Update Record' },
      ],
    }),
    createOAuthSubBlock({
      provider: 'airtable',
      serviceId: 'airtable',
      requiredScopes: ['data.records:read', 'data.records:write'],
      title: 'Airtable Account',
      placeholder: 'Select Airtable account',
    }),
    {
      id: 'baseId',
      title: 'Base ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your base ID (e.g., appXXXXXXXXXXXXXX)',
    },
    {
      id: 'tableId',
      title: 'Table ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter table ID (e.g., tblXXXXXXXXXXXXXX)',
    },
    {
      id: 'recordId',
      title: 'Record ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the record (e.g., recXXXXXXXXXXXXXX)',
      condition: { field: 'operation', value: ['get', 'update'] },
    },
    {
      id: 'maxRecords',
      title: 'Max Records',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Maximum records to return (optional)',
      condition: { field: 'operation', value: 'list' },
    },
    {
      id: 'filterFormula',
      title: 'Filter Formula',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Airtable formula to filter records (optional)',
      condition: { field: 'operation', value: 'list' },
    },
    {
      id: 'records',
      title: 'Records (JSON Array)',
      type: 'code',
      layout: 'full',
      placeholder: 'For Create: `[{ "fields": { ... } }]`\n',
      condition: { field: 'operation', value: ['create', 'updateMultiple'] },
    },
    {
      id: 'fields',
      title: 'Fields (JSON Object)',
      type: 'code',
      layout: 'full',
      placeholder: 'Fields to update: `{ "Field Name": "New Value" }`',
      condition: { field: 'operation', value: 'update' },
    },
  ],
  tools: {
    access: [
      'airtable_list_records',
      'airtable_get_record',
      'airtable_create_records',
      'airtable_update_record',
      'airtable_update_multiple_records',
    ],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'list':
            return 'airtable_list_records'
          case 'get':
            return 'airtable_get_record'
          case 'create':
            return 'airtable_create_records'
          case 'update':
            return 'airtable_update_record'
          case 'updateMultiple':
            return 'airtable_update_multiple_records'
          default:
            throw new Error(`Invalid Airtable operation: ${params.operation}`)
        }
      },
      params: (params) => {
        const { credential, records, fields, ...rest } = params

        const parsedRecords =
          records && (params.operation === 'create' || params.operation === 'updateMultiple')
            ? parseJsonStrict(records, 'records')
            : undefined
        const parsedFields =
          fields && params.operation === 'update' ? parseJsonStrict(fields, 'fields') : undefined

        // Construct parameters based on operation
        const baseParams = {
          accessToken: credential,
          ...rest,
        }

        switch (params.operation) {
          case 'create':
          case 'updateMultiple':
            return { ...baseParams, records: parsedRecords }
          case 'update':
            return { ...baseParams, fields: parsedFields }
          case 'list':
          case 'get':
          default:
            return baseParams
        }
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    credential: { type: 'string', required: true },
    baseId: { type: 'string', required: true },
    tableId: { type: 'string', required: true },
    recordId: { type: 'string', required: true },
    maxRecords: { type: 'number', required: false },
    filterFormula: { type: 'string', required: false },
    records: { type: 'json', required: false },
    fields: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        records: 'json',
        record: 'json',
        metadata: 'json',
      },
    },
  },
})
