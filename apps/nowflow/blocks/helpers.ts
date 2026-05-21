import type { ToolResponse } from '@/tools/types'
import type { BlockConfig, SubBlockConfig, SubBlockLayout } from './types'

/**
 * Helper builders for reducing boilerplate across the 193+ blocks in `blocks/blocks/`.
 *
 * These helpers are intentionally minimal pass-throughs that produce the exact
 * same object shapes hand-written blocks produce today. They exist to:
 *  - cut repeated `type: 'oauth-input'` / `layout: 'full'` boilerplate
 *  - give a single place to evolve shared defaults (e.g. placeholder text)
 *  - provide IntelliSense anchors (`defineBlock`) for future tooling
 *
 * No existing block has been migrated yet — migrations are opt-in.
 */

export type CreateOAuthSubBlockOptions = {
  id?: string
  provider: string
  serviceId: string
  requiredScopes: string[]
  title?: string
  layout?: SubBlockLayout
  placeholder?: string
}

/**
 * Build an `oauth-input` SubBlock with sensible defaults.
 *
 * Defaults:
 *  - id: `'credential'`
 *  - title: `'<Provider> Account'` (title-cased `serviceId`)
 *  - layout: `'full'`
 *  - placeholder: `'Select <serviceId> account'`
 */
export const createOAuthSubBlock = (opts: CreateOAuthSubBlockOptions): SubBlockConfig => {
  const {
    id = 'credential',
    provider,
    serviceId,
    requiredScopes,
    title,
    layout = 'full',
    placeholder,
  } = opts

  const pretty = serviceId.charAt(0).toUpperCase() + serviceId.slice(1)

  return {
    id,
    title: title ?? `${pretty} Account`,
    type: 'oauth-input',
    layout,
    provider,
    serviceId,
    requiredScopes,
    placeholder: placeholder ?? `Select ${serviceId} account`,
  }
}

export type OperationOption = {
  id: string
  label: string
  description?: string
}

export type CreateOperationDropdownOptions = {
  id?: string
  operations: OperationOption[]
  title?: string
  layout?: SubBlockLayout
  /** Optional default selected operation id. */
  defaultValue?: string
}

/**
 * Build the standard operation-selector dropdown SubBlock used by most
 * integration blocks. Preserves option order.
 *
 * Defaults:
 *  - id: `'operation'`
 *  - title: `'Operation'`
 *  - layout: `'full'`
 */
export const createOperationDropdown = (opts: CreateOperationDropdownOptions): SubBlockConfig => {
  const { id = 'operation', operations, title = 'Operation', layout = 'full', defaultValue } = opts

  const sub: SubBlockConfig = {
    id,
    title,
    type: 'dropdown',
    layout,
    options: operations.map((op) => ({
      id: op.id,
      label: op.label,
      ...(op.description ? { description: op.description } : {}),
    })),
  }

  if (defaultValue !== undefined) {
    sub.value = () => defaultValue
  }

  return sub
}

/**
 * Identity function with a type-parameter anchor. Use this in place of a bare
 * `const X: BlockConfig<T> = { ... }` annotation to get:
 *  - better IntelliSense when constructing a block
 *  - a single call-site future tooling can wrap (auto-registration, validation)
 *
 * Example:
 *   export const SlackBlock = defineBlock<SlackMessageResponse>({ ... })
 */
export const defineBlock = <T extends ToolResponse = ToolResponse>(
  config: BlockConfig<T>
): BlockConfig<T> => config

/**
 * Shorthand for the extremely common `tools.config` shape:
 *   { tool: () => toolId, params: (p) => p }
 *
 * Use when the block performs no per-operation remapping before dispatch.
 */
export const createSimpleToolConfig = (toolId: string) => ({
  tool: () => toolId,
  params: (p: Record<string, any>) => p,
})

// ─── Param transformers ──────────────────────────────────────────────────────
// These helpers replace inline `JSON.parse(v)` / `parseInt(v)` / `parseFloat(v)`
// scattered across 40+ blocks. They never throw — invalid input becomes
// `undefined`, which the upstream tool can decide to validate or default.

/**
 * Parse a JSON string safely. Returns `undefined` for empty / null / invalid
 * values, and the parsed structure otherwise. Already-parsed values
 * (objects/arrays/non-strings) are returned as-is.
 */
export const parseJsonSafely = (value: unknown): any => {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

/**
 * Strict JSON parser variant — used by blocks that need to surface a clear
 * error to the user when a JSON-typed input field is malformed (Supabase
 * `data`, Notion `properties`, Airtable `records`/`fields`, SQLite `data`).
 * Empty / null / undefined input still yields `undefined`; only malformed
 * JSON triggers the throw with the field name in the message.
 */
export const parseJsonStrict = (value: unknown, fieldName: string): any => {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch (err) {
    throw new Error(
      `Invalid JSON for ${fieldName}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Coerce a string-or-number into a finite number. Returns `undefined` for
 * empty / invalid values so callers can treat "no value" and "bad value"
 * uniformly.
 */
export const parseNumericString = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Build a parameter transformer that applies declarative coercion rules to
 * the keys you specify, leaves the rest untouched, and never throws on
 * malformed input.
 *
 * ```ts
 * params: createParamTransformer({
 *   max_tokens: 'number',
 *   data: 'json',
 * })
 * ```
 */
type ParamCoercion = 'json' | 'number'

export const createParamTransformer = (
  schema: Record<string, ParamCoercion>
): ((params: Record<string, any>) => Record<string, any>) => {
  return (params: Record<string, any>) => {
    const out: Record<string, any> = { ...params }
    for (const [key, type] of Object.entries(schema)) {
      const v = params[key]
      if (type === 'json') out[key] = parseJsonSafely(v)
      else if (type === 'number') out[key] = parseNumericString(v)
    }
    return out
  }
}
