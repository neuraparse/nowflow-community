import { ToolConfig } from '../types'
import { DataTableToolParams, DataTableToolResponse } from './types'

export const dataTableManagerTool: ToolConfig<DataTableToolParams, DataTableToolResponse> = {
  id: 'data_table_manager',
  name: 'Data Table Manager',
  description:
    'Manage data tables as an operational database. Operations: list_tables, query_rows, insert_row, update_row, delete_row, smart_insert, auto_save, lookup (find row by column value), exists (check if value exists), upsert (insert or update by match column), bulk_update (update all rows matching a filter). Use lookup/exists to check state before acting. Use upsert for idempotent save operations. Use bulk_update to change status of multiple rows at once.',
  version: '1.0.0',

  params: {
    operation: {
      type: 'string',
      required: true,
      description:
        'Operation: list_tables, query_rows, insert_row, update_row, delete_row, smart_insert, auto_save, lookup, exists, upsert, bulk_update',
    },
    tableId: {
      type: 'string',
      required: false,
      description:
        'ID of the data table (required for all operations except list_tables and auto_save)',
    },
    rowId: {
      type: 'string',
      required: false,
      description: 'ID of the row (required for update_row and delete_row)',
    },
    rowData: {
      type: 'json',
      required: false,
      description:
        'Row data as an object with column names as keys (required for insert_row, update_row, upsert, bulk_update)',
    },
    search: {
      type: 'string',
      required: false,
      description: 'Search term to filter rows (used in query_rows)',
    },
    page: {
      type: 'number',
      required: false,
      description: 'Page number for pagination (used in query_rows, default: 1)',
    },
    limit: {
      type: 'number',
      required: false,
      description: 'Number of rows per page (used in query_rows, default: 50, max: 200)',
    },
    filters: {
      type: 'json',
      required: false,
      description: 'Column-based filters as an object (used in query_rows)',
    },
    rawData: {
      type: 'json',
      required: false,
      description:
        'Raw data in any format (JSON object/array, CSV string, markdown table, key:value text). Used by smart_insert and auto_save.',
    },
    createMissingColumns: {
      type: 'boolean',
      required: false,
      description: 'Automatically create columns that do not exist yet (default: true)',
    },
    deduplicateColumn: {
      type: 'string',
      required: false,
      description:
        'Column name to use for deduplication — skip rows where this value already exists',
    },
    upsertOnDuplicate: {
      type: 'boolean',
      required: false,
      description:
        'When true + deduplicateColumn set, update existing rows instead of skipping them (used in smart_insert, auto_save)',
    },
    tableName: {
      type: 'string',
      required: false,
      description: 'Table name for auto_save — finds or creates the table by this name',
    },
    workspaceId: {
      type: 'string',
      required: false,
      description: 'Workspace ID (used with auto_save)',
    },
    description: {
      type: 'string',
      required: false,
      description: 'Description for a newly created table (used with auto_save)',
    },
    lookupColumn: {
      type: 'string',
      required: false,
      description: 'Column name to search by (used in lookup, exists)',
    },
    lookupValue: {
      type: 'string',
      required: false,
      description: 'Value to match in the lookup column (used in lookup, exists)',
    },
    matchColumn: {
      type: 'string',
      required: false,
      description: 'Column name to match on for upsert (insert-or-update) operations',
    },
    matchValue: {
      type: 'string',
      required: false,
      description: 'Value to match in the match column for upsert',
    },
    filterColumn: {
      type: 'string',
      required: false,
      description: 'Column name to filter by for bulk_update operations',
    },
    filterValue: {
      type: 'string',
      required: false,
      description: 'Value to match in the filter column for bulk_update',
    },
  },

  request: {
    url: (params: DataTableToolParams) => {
      const base = '/api/tables'
      switch (params.operation) {
        case 'list_tables':
          return base
        case 'query_rows':
        case 'lookup':
        case 'exists':
          return `${base}/${params.tableId}`
        case 'insert_row':
          return `${base}/${params.tableId}/rows`
        case 'update_row':
          return `${base}/${params.tableId}/rows`
        case 'delete_row':
          return `${base}/${params.tableId}/rows`
        case 'smart_insert':
          return `${base}/${params.tableId}/smart-insert`
        case 'auto_save':
          return `${base}/auto`
        case 'upsert':
          return `${base}/${params.tableId}/upsert`
        case 'bulk_update':
          return `${base}/${params.tableId}/bulk-update`
        default:
          return base
      }
    },
    method: (params: DataTableToolParams) => {
      switch (params.operation) {
        case 'list_tables':
          return 'GET'
        case 'query_rows':
          return 'GET'
        case 'lookup':
          return 'GET'
        case 'exists':
          return 'GET'
        case 'insert_row':
          return 'POST'
        case 'update_row':
          return 'PATCH'
        case 'delete_row':
          return 'DELETE'
        case 'smart_insert':
          return 'POST'
        case 'auto_save':
          return 'POST'
        case 'upsert':
          return 'POST'
        case 'bulk_update':
          return 'PATCH'
        default:
          return 'GET'
      }
    },
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params: DataTableToolParams) => {
      if (params.operation === 'insert_row') {
        return { data: params.rowData || {} }
      }
      if (params.operation === 'update_row') {
        return { rowId: params.rowId, data: params.rowData || {} }
      }
      if (params.operation === 'smart_insert') {
        return {
          rawData: params.rawData,
          createMissingColumns: params.createMissingColumns !== false,
          deduplicateColumn: params.deduplicateColumn,
          upsertOnDuplicate: params.upsertOnDuplicate,
        }
      }
      if (params.operation === 'auto_save') {
        return {
          tableName: params.tableName,
          rawData: params.rawData,
          workspaceId: params.workspaceId,
          description: params.description,
          createMissingColumns: params.createMissingColumns !== false,
          deduplicateColumn: params.deduplicateColumn,
          upsertOnDuplicate: params.upsertOnDuplicate,
        }
      }
      if (params.operation === 'upsert') {
        return {
          matchColumn: params.matchColumn,
          matchValue: params.matchValue,
          rowData: params.rowData || {},
          createMissingColumns: params.createMissingColumns !== false,
        }
      }
      if (params.operation === 'bulk_update') {
        return {
          filterColumn: params.filterColumn,
          filterValue: params.filterValue,
          updateData: params.rowData || {},
          createMissingColumns: params.createMissingColumns !== false,
        }
      }
      return undefined as any
    },
    query: (params: DataTableToolParams) => {
      if (params.operation === 'query_rows') {
        const q: Record<string, string> = {}
        if (params.page) q.page = String(params.page)
        if (params.limit) q.limit = String(params.limit)
        if (params.search) q.search = params.search
        return q
      }
      if (params.operation === 'lookup' || params.operation === 'exists') {
        return {
          lookupColumn: params.lookupColumn || '',
          lookupValue: params.lookupValue || '',
        }
      }
      if (params.operation === 'delete_row' && params.rowId) {
        return { rowId: params.rowId }
      }
      return {}
    },
    isInternalRoute: true,
  },

  transformResponse: async (response: Response) => {
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        output: {},
        error: data.error || `Request failed with status ${response.status}`,
      } as DataTableToolResponse
    }

    // Normalize response based on what the API returned
    const output: DataTableToolResponse['output'] = {}

    if (data.tables !== undefined) output.tables = data.tables
    if (data.rows !== undefined) output.rows = data.rows
    if (data.totalRows !== undefined) output.totalRows = data.totalRows
    if (data.page !== undefined) output.page = data.page
    if (data.row !== undefined) output.row = data.row
    if (data.data !== undefined) output.data = data.data
    if (data.success !== undefined) output.success = data.success
    if (data.rowId !== undefined) output.rowId = data.rowId
    if (data.tableId !== undefined) output.tableId = data.tableId
    // smart_insert / auto_save
    if (data.insertedRows !== undefined) output.insertedRows = data.insertedRows
    if (data.skippedRows !== undefined) output.skippedRows = data.skippedRows
    if (data.createdColumns !== undefined) output.createdColumns = data.createdColumns
    if (data.format !== undefined) output.format = data.format
    if (data.tableName !== undefined) output.tableName = data.tableName
    if (data.isNewTable !== undefined) output.isNewTable = data.isNewTable
    // lookup / exists
    if (data.found !== undefined) {
      output.found = data.found
      output.exists = data.found
    }
    // upsert
    if (data.action !== undefined) output.action = data.action
    // bulk_update
    if (data.updatedRows !== undefined) output.updatedRows = data.updatedRows
    // upsertOnDuplicate
    if (data.upsertedRows !== undefined) output.upsertedRows = data.upsertedRows

    // If none of the above matched, set success=true
    if (Object.keys(output).length === 0) {
      output.success = true
    }

    return { success: true, output }
  },
}
