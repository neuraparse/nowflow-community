import { CircleStackIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface DataTableResponse extends ToolResponse {
  output: {
    // list_tables
    tables?: Array<{
      id: string
      name: string
      description?: string
      rowCount: number
      columnCount: number
    }>
    // query_rows
    rows?: Array<{
      id: string
      tableId: string
      data: Record<string, any>
      createdAt: string
      updatedAt: string
    }>
    row?: {
      id: string
      tableId: string
      data: Record<string, any>
      createdAt: string
      updatedAt: string
    }
    data?: Record<string, any>
    success?: boolean
    totalRows?: number
    page?: number
    // smart_insert / auto_save
    insertedRows?: number
    skippedRows?: number
    createdColumns?: string[]
    format?: string
    tableId?: string
    tableName?: string
    isNewTable?: boolean
    // lookup / exists
    found?: boolean
    exists?: boolean
    // upsert
    action?: 'inserted' | 'updated'
    // bulk_update
    updatedRows?: number
    // upsertOnDuplicate
    upsertedRows?: number
  }
}

export const DataTableBlock: BlockConfig<DataTableResponse> = {
  type: 'data_table',
  name: 'Data Table',
  description: 'Read, write, and query your built-in data tables.',
  longDescription:
    'Interact with your built-in data tables directly from workflows. List available tables, query rows with search/filters, insert new rows, update existing rows, or delete rows. Supports Smart Insert (auto-detect format and columns), Auto Save (find-or-create table by name), Lookup/Exists (check if a value exists before acting), Upsert (insert or update by match column), and Bulk Update (update all rows matching a filter). Manage tables in the Tables section of your workspace.',
  category: 'data',
  bgColor: '#10B981',
  icon: CircleStackIcon,
  isUtility: true,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Smart Insert', id: 'smart_insert' },
        { label: 'Auto Save', id: 'auto_save' },
        { label: 'Query Rows', id: 'query_rows' },
        { label: 'List Tables', id: 'list_tables' },
        { label: 'Insert Row', id: 'insert_row' },
        { label: 'Update Row', id: 'update_row' },
        { label: 'Delete Row', id: 'delete_row' },
        { label: 'Lookup Row', id: 'lookup' },
        { label: 'Exists Check', id: 'exists' },
        { label: 'Upsert', id: 'upsert' },
        { label: 'Bulk Update', id: 'bulk_update' },
      ],
    },
    {
      id: 'tableId',
      title: 'Table ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter table ID...',
      condition: {
        field: 'operation',
        value: [
          'query_rows',
          'insert_row',
          'update_row',
          'delete_row',
          'smart_insert',
          'lookup',
          'exists',
          'upsert',
          'bulk_update',
        ],
      },
    },
    {
      id: 'tableName',
      title: 'Table Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Table name (created if not exists)...',
      condition: {
        field: 'operation',
        value: 'auto_save',
      },
    },
    {
      id: 'rawData',
      title: 'Raw Data',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Any format: JSON object/array, CSV, markdown table, key:value text...',
      condition: {
        field: 'operation',
        value: ['smart_insert', 'auto_save'],
      },
    },
    {
      id: 'deduplicateColumn',
      title: 'Deduplicate Column (optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Column name to prevent duplicates...',
      condition: {
        field: 'operation',
        value: ['smart_insert', 'auto_save'],
      },
    },
    {
      id: 'upsertOnDuplicate',
      title: 'Update Duplicates (Upsert)',
      type: 'switch',
      layout: 'half',
      condition: {
        field: 'operation',
        value: ['smart_insert', 'auto_save'],
      },
    },
    // Lookup / Exists fields
    {
      id: 'lookupColumn',
      title: 'Lookup Column',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Column name (e.g. email)...',
      condition: {
        field: 'operation',
        value: ['lookup', 'exists'],
      },
    },
    {
      id: 'lookupValue',
      title: 'Lookup Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Value to find...',
      condition: {
        field: 'operation',
        value: ['lookup', 'exists'],
      },
    },
    // Upsert fields
    {
      id: 'matchColumn',
      title: 'Match Column',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Column to match on (e.g. email)...',
      condition: {
        field: 'operation',
        value: 'upsert',
      },
    },
    {
      id: 'matchValue',
      title: 'Match Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Value to match...',
      condition: {
        field: 'operation',
        value: 'upsert',
      },
    },
    // Bulk Update fields
    {
      id: 'filterColumn',
      title: 'Filter Column',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Column to filter by (e.g. status)...',
      condition: {
        field: 'operation',
        value: 'bulk_update',
      },
    },
    {
      id: 'filterValue',
      title: 'Filter Value',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Value to match (e.g. pending)...',
      condition: {
        field: 'operation',
        value: 'bulk_update',
      },
    },
    // Query Rows fields
    {
      id: 'search',
      title: 'Search',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Search term to filter rows...',
      condition: {
        field: 'operation',
        value: 'query_rows',
      },
    },
    {
      id: 'filters',
      title: 'Filters',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "status": "active"\n}',
      condition: {
        field: 'operation',
        value: 'query_rows',
      },
    },
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '50',
      condition: {
        field: 'operation',
        value: 'query_rows',
      },
    },
    {
      id: 'page',
      title: 'Page',
      type: 'short-input',
      layout: 'half',
      placeholder: '1',
      condition: {
        field: 'operation',
        value: 'query_rows',
      },
    },
    // Row Data (shared by insert, update, upsert, bulk_update)
    {
      id: 'rowData',
      title: 'Row Data',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "Name": "Example",\n  "Status": "active"\n}',
      condition: {
        field: 'operation',
        value: ['insert_row', 'update_row', 'upsert', 'bulk_update'],
      },
    },
    {
      id: 'rowId',
      title: 'Row ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Row ID to update or delete...',
      condition: {
        field: 'operation',
        value: ['update_row', 'delete_row'],
      },
    },
  ],
  tools: {
    access: ['data_table_manager'],
    config: {
      tool: () => 'data_table_manager',
      params: (params) => ({
        operation: params.operation,
        tableId: params.tableId,
        rowId: params.rowId,
        rowData: params.rowData
          ? typeof params.rowData === 'string'
            ? JSON.parse(params.rowData)
            : params.rowData
          : undefined,
        search: params.search,
        page: params.page ? parseInt(String(params.page)) : undefined,
        limit: params.limit ? parseInt(String(params.limit)) : undefined,
        filters: params.filters
          ? typeof params.filters === 'string'
            ? JSON.parse(params.filters)
            : params.filters
          : undefined,
        // smart_insert / auto_save
        rawData: params.rawData
          ? typeof params.rawData === 'string'
            ? (() => {
                try {
                  return JSON.parse(params.rawData)
                } catch {
                  return params.rawData
                }
              })()
            : params.rawData
          : undefined,
        createMissingColumns: params.createMissingColumns !== false,
        deduplicateColumn: params.deduplicateColumn || undefined,
        upsertOnDuplicate: params.upsertOnDuplicate === true || params.upsertOnDuplicate === 'true',
        tableName: params.tableName,
        workspaceId: params.workspaceId,
        description: params.description,
        // lookup / exists
        lookupColumn: params.lookupColumn || undefined,
        lookupValue: params.lookupValue !== undefined ? String(params.lookupValue) : undefined,
        // upsert
        matchColumn: params.matchColumn || undefined,
        matchValue: params.matchValue !== undefined ? String(params.matchValue) : undefined,
        // bulk_update
        filterColumn: params.filterColumn || undefined,
        filterValue: params.filterValue !== undefined ? String(params.filterValue) : undefined,
      }),
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    tableId: { type: 'string', required: false },
    rowId: { type: 'string', required: false },
    rowData: { type: 'json', required: false },
    search: { type: 'string', required: false },
    page: { type: 'number', required: false },
    limit: { type: 'number', required: false },
    filters: { type: 'json', required: false },
    rawData: { type: 'json', required: false },
    createMissingColumns: { type: 'boolean', required: false },
    deduplicateColumn: { type: 'string', required: false },
    upsertOnDuplicate: { type: 'boolean', required: false },
    tableName: { type: 'string', required: false },
    workspaceId: { type: 'string', required: false },
    description: { type: 'string', required: false },
    lookupColumn: { type: 'string', required: false },
    lookupValue: { type: 'string', required: false },
    matchColumn: { type: 'string', required: false },
    matchValue: { type: 'string', required: false },
    filterColumn: { type: 'string', required: false },
    filterValue: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        tables: 'json',
        rows: 'json',
        row: 'json',
        data: 'json',
        success: 'boolean',
        totalRows: 'number',
        page: 'number',
        insertedRows: 'number',
        skippedRows: 'number',
        createdColumns: 'json',
        format: 'string',
        tableId: 'string',
        tableName: 'string',
        isNewTable: 'boolean',
        found: 'boolean',
        exists: 'boolean',
        action: 'string',
        updatedRows: 'number',
        upsertedRows: 'number',
      },
    },
  },
}
