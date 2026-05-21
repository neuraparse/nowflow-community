/**
 * Schema Inference Service
 *
 * Analyzes incoming data of any format and infers:
 * - Column names and types
 * - Rows as arrays of {columnName: value} objects
 *
 * Supported formats:
 * - JSON object         → single row
 * - JSON array          → multiple rows (merged schema)
 * - CSV string          → multiple rows with headers
 * - Markdown table      → multiple rows
 * - Key:value text      → single row
 * - Plain text          → single column "content"
 */

export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'select'

export type InferredFormat =
  | 'json_object'
  | 'json_array'
  | 'csv'
  | 'markdown_table'
  | 'key_value'
  | 'plain_text'

export interface InferredColumn {
  name: string
  type: ColumnType
}

export interface InferredSchema {
  format: InferredFormat
  columns: InferredColumn[]
  rows: Array<Record<string, any>>
}

// ─────────────────────────────────────────────
// Type detection helpers
// ─────────────────────────────────────────────

function inferType(value: unknown): ColumnType {
  if (value === null || value === undefined || value === '') return 'text'

  const str = String(value).trim()

  // Boolean
  if (/^(true|false|yes|no|1|0)$/i.test(str)) return 'boolean'

  // Number
  const num = Number(str.replace(/,/g, ''))
  if (!isNaN(num) && isFinite(num) && str !== '') return 'number'

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return 'email'

  // URL
  try {
    const u = new URL(str)
    if (u.protocol === 'http:' || u.protocol === 'https:') return 'url'
  } catch {}

  // Date: must contain digits and date separators / month names
  if (
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(str) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(str)
  ) {
    const d = new Date(str)
    if (!isNaN(d.getTime())) return 'date'
  }

  return 'text'
}

/**
 * Merge type: if existing is 'text', accept the new type.
 * If both are the same, keep it. Otherwise fall back to 'text'.
 */
function mergeType(existing: ColumnType, incoming: ColumnType): ColumnType {
  if (existing === incoming) return existing
  if (existing === 'text') return incoming
  if (incoming === 'text') return existing
  return 'text'
}

// ─────────────────────────────────────────────
// Flatten nested objects
// { user: { name: "Ali" } } → { user_name: "Ali" }
// ─────────────────────────────────────────────

function flattenObject(obj: Record<string, any>, prefix = '', depth = 0): Record<string, any> {
  if (depth > 3) return obj // Prevent infinite nesting
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(result, flattenObject(val, newKey, depth + 1))
    } else if (Array.isArray(val)) {
      // Arrays: serialize as JSON string
      result[newKey] = JSON.stringify(val)
    } else {
      result[newKey] = val
    }
  }
  return result
}

// ─────────────────────────────────────────────
// Column schema builder from rows
// ─────────────────────────────────────────────

function buildColumnsFromRows(rows: Array<Record<string, any>>): InferredColumn[] {
  const typeMap: Record<string, ColumnType> = {}

  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      const t = inferType(val)
      if (typeMap[key] === undefined) {
        typeMap[key] = t
      } else {
        typeMap[key] = mergeType(typeMap[key], t)
      }
    }
  }

  return Object.entries(typeMap).map(([name, type]) => ({ name, type }))
}

// ─────────────────────────────────────────────
// Format parsers
// ─────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return null

  // Detect delimiter: comma or tab
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0])
  // Must have at least 2 columns to be considered CSV
  if (headers.length < 2) return null

  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 3) return null

  // Must start with |
  if (!lines[0].startsWith('|')) return null

  // Second line must be separator: |---|---|
  if (!/^\|[-:\s|]+\|$/.test(lines[1])) return null

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())

  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow)
  return { headers, rows }
}

function parseKeyValue(text: string): Record<string, string> | null {
  const lines = text.trim().split(/\r?\n/)
  const result: Record<string, string> = {}
  let matched = 0

  for (const line of lines) {
    // Match "key: value" or "key = value"
    const m = line.match(/^([^:=\n]+?)\s*[:=]\s*(.*)$/)
    if (m) {
      const key = m[1].trim().replace(/\s+/g, '_').toLowerCase()
      result[key] = m[2].trim()
      matched++
    }
  }

  // Need at least 2 key:value pairs to be considered key-value format
  if (matched < 2) return null
  return result
}

// ─────────────────────────────────────────────
// Main inference function
// ─────────────────────────────────────────────

export function inferSchema(rawData: unknown): InferredSchema {
  // Handle null/undefined
  if (rawData === null || rawData === undefined) {
    return {
      format: 'plain_text',
      columns: [{ name: 'content', type: 'text' }],
      rows: [{ content: String(rawData) }],
    }
  }

  // If it's already a plain object (not string), process directly
  if (typeof rawData === 'object' && !Array.isArray(rawData)) {
    const flat = flattenObject(rawData as Record<string, any>)
    const rows = [flat]
    return {
      format: 'json_object',
      columns: buildColumnsFromRows(rows),
      rows,
    }
  }

  // If it's already an array, process directly
  if (Array.isArray(rawData)) {
    const rows = rawData
      .filter((item) => item !== null && item !== undefined)
      .map((item) => {
        if (typeof item === 'object' && !Array.isArray(item)) {
          return flattenObject(item as Record<string, any>)
        }
        return { value: item }
      })

    if (rows.length === 0) {
      return {
        format: 'json_array',
        columns: [{ name: 'value', type: 'text' }],
        rows: [],
      }
    }

    return {
      format: 'json_array',
      columns: buildColumnsFromRows(rows),
      rows,
    }
  }

  // It's a string — try to parse various formats
  const str = String(rawData).trim()

  // 1. Try JSON
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str)
      return inferSchema(parsed) // Recurse with parsed value
    } catch {}
  }

  // 2. Try Markdown table
  if (str.startsWith('|')) {
    const md = parseMarkdownTable(str)
    if (md) {
      const rows = md.rows.map((row) => {
        const obj: Record<string, any> = {}
        md.headers.forEach((h, i) => {
          obj[h || `col_${i + 1}`] = row[i] ?? ''
        })
        return obj
      })
      return {
        format: 'markdown_table',
        columns: buildColumnsFromRows(rows),
        rows,
      }
    }
  }

  // 3. Try CSV
  const csv = parseCSV(str)
  if (csv) {
    const rows = csv.rows
      .filter((r) => r.some((c) => c.length > 0))
      .map((row) => {
        const obj: Record<string, any> = {}
        csv.headers.forEach((h, i) => {
          const key = (h || `col_${i + 1}`).replace(/\s+/g, '_').toLowerCase()
          obj[key] = row[i] ?? ''
        })
        return obj
      })
    return {
      format: 'csv',
      columns: buildColumnsFromRows(rows),
      rows,
    }
  }

  // 4. Try key:value text
  const kv = parseKeyValue(str)
  if (kv) {
    const rows = [kv]
    return {
      format: 'key_value',
      columns: buildColumnsFromRows(rows),
      rows,
    }
  }

  // 5. Plain text fallback
  return {
    format: 'plain_text',
    columns: [{ name: 'content', type: 'text' }],
    rows: [{ content: str }],
  }
}
