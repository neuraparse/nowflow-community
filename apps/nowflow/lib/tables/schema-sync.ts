/**
 * Schema Sync Service
 *
 * Given a tableId and a list of inferred columns, ensures all columns exist
 * in the database and returns a { columnName → columnId } mapping.
 *
 * Rules:
 * - Never deletes or renames existing columns
 * - Only adds new columns that don't exist yet
 * - Returns a complete mapping so callers can convert { name: value } → { id: value }
 */
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { dataTableColumn } from '@/db/schema'
import { InferredColumn } from './schema-inference'

/** columnName → columnId */
export type ColumnMapping = Record<string, string>

/**
 * Ensure all inferredColumns exist for the given table.
 * Creates missing columns and returns the complete name→id mapping.
 *
 * @param tableId       - Target table
 * @param inferredColumns - Columns inferred from the incoming data
 * @param tx            - Optional Drizzle transaction (pass to run in a transaction)
 * @returns             { columnName: columnId } for every known column
 */
export async function syncColumnsAndGetMapping(
  tableId: string,
  inferredColumns: InferredColumn[],
  tx?: typeof db
): Promise<{ mapping: ColumnMapping; createdColumns: string[] }> {
  const client = tx ?? db

  // Fetch existing columns
  const existingColumns = await client
    .select({ id: dataTableColumn.id, name: dataTableColumn.name })
    .from(dataTableColumn)
    .where(eq(dataTableColumn.tableId, tableId))

  const mapping: ColumnMapping = {}
  for (const col of existingColumns) {
    mapping[col.name] = col.id
  }

  // Determine which columns are new
  const existingNames = new Set(Object.keys(mapping))
  const toCreate = inferredColumns.filter((col) => !existingNames.has(col.name))

  if (toCreate.length === 0) {
    return { mapping, createdColumns: [] }
  }

  // Get current max order
  const [maxOrderResult] = await client
    .select({ max: sql`COALESCE(MAX("order"), -1)` })
    .from(dataTableColumn)
    .where(eq(dataTableColumn.tableId, tableId))

  let currentOrder = ((maxOrderResult?.max as number) ?? -1) + 1
  const now = new Date()
  const createdColumns: string[] = []

  for (const col of toCreate) {
    const columnId = crypto.randomUUID()
    await client.insert(dataTableColumn).values({
      id: columnId,
      tableId,
      name: col.name,
      type: col.type,
      order: currentOrder++,
      createdAt: now,
      updatedAt: now,
    })
    mapping[col.name] = columnId
    createdColumns.push(col.name)
  }

  return { mapping, createdColumns }
}

/**
 * Convert a row from { columnName: value } format to { columnId: value } format
 * using the provided mapping. Columns not in the mapping are silently dropped.
 */
export function applyMapping(
  row: Record<string, any>,
  mapping: ColumnMapping
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [name, value] of Object.entries(row)) {
    const colId = mapping[name]
    if (colId) {
      result[colId] = value
    }
  }
  return result
}

/**
 * Read-only column name → column ID mapping for a table.
 * Unlike syncColumnsAndGetMapping, does NOT create missing columns.
 * Returns both forward (name→id) and reverse (id→name) mappings.
 */
export async function getColumnMapping(
  tableId: string,
  tx?: typeof db
): Promise<{ mapping: ColumnMapping; reverseMapping: Record<string, string> }> {
  const client = tx ?? db
  const columns = await client
    .select({ id: dataTableColumn.id, name: dataTableColumn.name })
    .from(dataTableColumn)
    .where(eq(dataTableColumn.tableId, tableId))

  const mapping: ColumnMapping = {}
  const reverseMapping: Record<string, string> = {}
  for (const col of columns) {
    mapping[col.name] = col.id
    reverseMapping[col.id] = col.name
  }
  return { mapping, reverseMapping }
}

/**
 * Convert a row from { columnId: value } format to { columnName: value } format.
 * Used to return user-friendly data from lookup/exists/upsert operations.
 */
export function reverseMapRowData(
  data: Record<string, any>,
  reverseMapping: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [colId, value] of Object.entries(data)) {
    const name = reverseMapping[colId] || colId
    result[name] = value
  }
  return result
}
