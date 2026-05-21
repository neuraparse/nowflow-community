import { ToolResponse } from '../types'

export type DataTableOperation =
  | 'list_tables'
  | 'query_rows'
  | 'insert_row'
  | 'update_row'
  | 'delete_row'
  | 'smart_insert'
  | 'auto_save'
  | 'lookup'
  | 'exists'
  | 'upsert'
  | 'bulk_update'

export interface DataTableToolParams {
  operation: DataTableOperation
  tableId?: string
  rowId?: string
  rowData?: Record<string, any>
  search?: string
  page?: number
  limit?: number
  filters?: Record<string, any>
  // smart_insert / auto_save
  rawData?: any
  createMissingColumns?: boolean
  deduplicateColumn?: string
  upsertOnDuplicate?: boolean
  // auto_save only
  tableName?: string
  workspaceId?: string
  description?: string
  // lookup / exists
  lookupColumn?: string
  lookupValue?: string
  // upsert
  matchColumn?: string
  matchValue?: string
  // bulk_update
  filterColumn?: string
  filterValue?: string
}

export interface DataTableRow {
  id: string
  tableId: string
  data: Record<string, any>
  order: number
  createdAt: string
  updatedAt: string
}

export interface DataTableInfo {
  id: string
  name: string
  description?: string
  rowCount: number
  columnCount: number
  columns: Array<{
    id: string
    name: string
    type: string
    order: number
  }>
}

export interface DataTableToolResponse extends ToolResponse {
  output: {
    // list_tables
    tables?: DataTableInfo[]
    // query_rows
    rows?: DataTableRow[]
    totalRows?: number
    page?: number
    // insert_row / update_row
    row?: DataTableRow
    data?: Record<string, any>
    // delete_row / generic
    success?: boolean
    rowId?: string
    tableId?: string
    // smart_insert
    insertedRows?: number
    skippedRows?: number
    createdColumns?: string[]
    format?: string
    // auto_save
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
