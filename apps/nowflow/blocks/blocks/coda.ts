import { CodaIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const CodaBlock = defineBlock({
  type: 'coda',
  name: 'Coda',
  description: 'All-in-one doc platform combining docs, spreadsheets, and apps',
  longDescription:
    'Integrate with Coda to create and manage docs, tables, rows, formulas, and automations. Combine the power of documents and databases in a flexible workspace using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#F46A54',
  icon: CodaIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'coda',
      serviceId: 'coda',
      requiredScopes: ['readonly', 'write', 'admin'],
      title: 'Coda Account',
      placeholder: 'Select Coda account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_docs', label: 'List Docs' },
        { id: 'get_doc', label: 'Get Doc' },
        { id: 'create_doc', label: 'Create Doc' },
        { id: 'list_tables', label: 'List Tables' },
        { id: 'get_table', label: 'Get Table' },
        { id: 'add_row', label: 'Add Row' },
        { id: 'update_row', label: 'Update Row' },
        { id: 'delete_row', label: 'Delete Row' },
        { id: 'list_rows', label: 'List Rows' },
        { id: 'list_columns', label: 'List Columns' },
        { id: 'get_user', label: 'Get User Info' },
      ],
      defaultValue: 'list_docs',
    }),
    {
      id: 'docId',
      title: 'Doc ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter doc ID',
      condition: {
        field: 'operation',
        value: [
          'get_doc',
          'list_tables',
          'get_table',
          'add_row',
          'update_row',
          'delete_row',
          'list_rows',
          'list_columns',
        ],
      },
    },
    {
      id: 'docTitle',
      title: 'Doc Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Coda Doc',
      condition: { field: 'operation', value: 'create_doc' },
    },
    {
      id: 'tableId',
      title: 'Table ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter table ID or name',
      condition: {
        field: 'operation',
        value: ['get_table', 'add_row', 'update_row', 'delete_row', 'list_rows', 'list_columns'],
      },
    },
    {
      id: 'rowId',
      title: 'Row ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter row ID',
      condition: { field: 'operation', value: ['update_row', 'delete_row'] },
    },
    {
      id: 'rowData',
      title: 'Row Data (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"Column1": "Value1", "Column2": "Value2"}',
      condition: { field: 'operation', value: ['add_row', 'update_row'] },
    },
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '100',
      condition: { field: 'operation', value: ['list_docs', 'list_tables', 'list_rows'] },
    },
  ],
  tools: {
    access: ['coda_api'],
    config: {
      tool: () => 'coda_api',
      params: createParamTransformer({ rowData: 'json', limit: 'number' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    docId: { type: 'string', required: false },
    docTitle: { type: 'string', required: false },
    tableId: { type: 'string', required: false },
    rowId: { type: 'string', required: false },
    rowData: { type: 'string', required: false },
    limit: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
