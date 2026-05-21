import type { AnyColumn } from 'drizzle-orm/column'
import {
  boolean,
  customType,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

// int8 column that maps the Postgres bigint to a JS number (safe for values
// within Number.MAX_SAFE_INTEGER, e.g. Date.now() epoch ms). We define this
// via customType because named-importing `bigint` from drizzle-orm/pg-core
// triggers a toolchain quirk in this workspace.
const int8Number = customType<{ data: number; driverData: string }>({
  dataType() {
    return 'bigint'
  },
  fromDriver(value) {
    return typeof value === 'string' ? Number(value) : (value as number)
  },
  toDriver(value) {
    return String(value)
  },
})

export const tsvector = customType<{ data: string | null }>({
  dataType() {
    return 'tsvector'
  },
})

// Generic alias for the `(table) => ...` callback parameter in pgTable.
// Drizzle's overload inference does not propagate the column map through
// re-exports, so individual schema files use this to explicitly type the
// parameter without resorting to implicit any.
export type SchemaTable = Record<string, AnyColumn>

export {
  int8Number,
  boolean,
  customType,
  decimal,
  integer,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
}
