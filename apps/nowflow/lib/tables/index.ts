/**
 * Barrel export for the data-tables namespace.
 *
 * Surfaces schema inference (raw data → typed columns) and schema sync
 * (mapping incoming column names to existing data-table columns).
 * Existing nested-path imports keep working unchanged.
 */

export { inferSchema } from './schema-inference'
export type { ColumnType, InferredColumn, InferredFormat, InferredSchema } from './schema-inference'

export {
  applyMapping,
  getColumnMapping,
  reverseMapRowData,
  syncColumnsAndGetMapping,
} from './schema-sync'
export type { ColumnMapping } from './schema-sync'
