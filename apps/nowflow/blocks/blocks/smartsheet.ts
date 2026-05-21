import { SmartsheetIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SmartsheetBlock = defineBlock({
  type: 'smartsheet',
  name: 'Smartsheet',
  description: 'Spreadsheet-style project management and collaboration',
  longDescription:
    'Integrate with Smartsheet to manage sheets, rows, columns, automate workflows, create reports, and collaborate on projects. Perfect for teams handling complex projects with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#1473E6',
  icon: SmartsheetIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'smartsheet',
      serviceId: 'smartsheet',
      requiredScopes: [
        'READ_SHEETS',
        'WRITE_SHEETS',
        'READ_USERS',
        'DELETE_SHEETS',
        'SHARE_SHEETS',
      ],
      title: 'Smartsheet Account',
      placeholder: 'Select Smartsheet account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_sheets', label: 'List Sheets' },
        { id: 'get_sheet', label: 'Get Sheet' },
        { id: 'create_sheet', label: 'Create Sheet' },
        { id: 'add_row', label: 'Add Row' },
        { id: 'update_row', label: 'Update Row' },
        { id: 'delete_row', label: 'Delete Row' },
        { id: 'add_column', label: 'Add Column' },
        { id: 'list_workspaces', label: 'List Workspaces' },
        { id: 'share_sheet', label: 'Share Sheet' },
        { id: 'get_user', label: 'Get User Info' },
      ],
      defaultValue: 'list_sheets',
    }),
    {
      id: 'sheetId',
      title: 'Sheet ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter sheet ID',
      condition: {
        field: 'operation',
        value: ['get_sheet', 'add_row', 'update_row', 'delete_row', 'add_column', 'share_sheet'],
      },
    },
    {
      id: 'sheetName',
      title: 'Sheet Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Project Sheet',
      condition: { field: 'operation', value: 'create_sheet' },
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
      id: 'columnTitle',
      title: 'Column Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Column name',
      condition: { field: 'operation', value: 'add_column' },
    },
    {
      id: 'columnType',
      title: 'Column Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'TEXT_NUMBER', label: 'Text/Number' },
        { id: 'DATE', label: 'Date' },
        { id: 'CHECKBOX', label: 'Checkbox' },
        { id: 'PICKLIST', label: 'Dropdown List' },
        { id: 'CONTACT_LIST', label: 'Contact List' },
      ],
      value: () => 'TEXT_NUMBER',
      condition: { field: 'operation', value: 'add_column' },
    },
    {
      id: 'cellValues',
      title: 'Cell Values (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"Column1": "Value1", "Column2": "Value2"}',
      condition: { field: 'operation', value: ['add_row', 'update_row'] },
    },
    {
      id: 'email',
      title: 'Share with Email',
      type: 'short-input',
      layout: 'half',
      placeholder: 'user@example.com',
      condition: { field: 'operation', value: 'share_sheet' },
    },
    {
      id: 'accessLevel',
      title: 'Access Level',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'VIEWER', label: 'Viewer' },
        { id: 'EDITOR', label: 'Editor' },
        { id: 'ADMIN', label: 'Admin' },
      ],
      value: () => 'VIEWER',
      condition: { field: 'operation', value: 'share_sheet' },
    },
  ],
  tools: {
    access: ['smartsheet_api'],
    config: {
      tool: () => 'smartsheet_api',
      params: (params) => {
        const { credential, cellValues, ...rest } = params as Record<string, any>
        return {
          credential,
          cellValues: cellValues ? JSON.parse(cellValues) : undefined,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    sheetId: { type: 'string', required: false },
    sheetName: { type: 'string', required: false },
    rowId: { type: 'string', required: false },
    columnTitle: { type: 'string', required: false },
    columnType: { type: 'string', required: false },
    cellValues: { type: 'string', required: false },
    email: { type: 'string', required: false },
    accessLevel: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
