import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SecuritySanitize')

/**
 * Sensitive field patterns for credential sanitization (case-insensitive, substring match).
 * Any property key whose lowercased form contains one of these patterns will have its
 * primitive value masked with the redaction sentinel.
 */
export const SENSITIVE_FIELD_PATTERNS: readonly string[] = [
  'apikey',
  'api_key',
  'apitoken',
  'token',
  'password',
  'passphrase',
  'passwd',
  'secret',
  'authorization',
  'credential',
  'credentials',
  'privatekey',
  'private_key',
  'accesstoken',
  'access_token',
  'accesskey',
  'access_key',
  'refreshtoken',
  'refresh_token',
  'sessiontoken',
  'session_token',
  'clientsecret',
  'client_secret',
  'webhook_secret',
  'signingkey',
  'signing_key',
  'bearertoken',
  'bearer',
  'auth_key',
  'auth_token',
  'connection_string',
  'connectionstring',
]

/**
 * Keys that look sensitive via substring match but are actually safe metadata
 * and should pass through unchanged. Case-insensitive exact match.
 */
const SAFE_KEY_ALLOWLIST = new Set<string>([
  'apiurl',
  'apihost',
  'apiversion',
  'apiname',
  'apiendpoint',
  'tokentype',
  'tokenurl',
  'tokenname',
  'tokencount',
  'tokenlimit',
  'secretname',
  'secretid',
  'secretref',
  'credentialname',
  'credentialid',
  'credentialtype',
  'credentialref',
  'authorizationurl',
  'authorizationtype',
  'authtype',
  'authurl',
  'passwordpolicy',
  'passwordless',
])

const REDACTED = '***REDACTED***'

export type SanitizeOptions = {
  /**
   * Optional label included in sanitization log lines for provenance.
   * Examples: 'marketplace_publish', 'auto_builder_snapshot'.
   */
  source?: string
  /**
   * When true, suppress the info log even if fields were cleared.
   */
  silent?: boolean
  /**
   * Additional caller-specific sensitive key patterns, merged with the default list.
   */
  additionalKeys?: string[]
}

export type DeepSanitizeOptions = {
  /**
   * Override or extend the sensitive key patterns. If omitted, defaults are used.
   * Patterns are matched as lowercased substrings against property keys.
   */
  keys?: string[]
  /**
   * When true, suppress the info log even if fields were cleared.
   */
  silent?: boolean
}

function isSensitiveKey(key: string, patterns: string[]): boolean {
  const keyLower = key.toLowerCase()
  if (SAFE_KEY_ALLOWLIST.has(keyLower)) return false
  return patterns.some((pattern) => keyLower.includes(pattern.toLowerCase()))
}

function isMaskablePrimitive(value: unknown): boolean {
  if (value === null) return true
  const t = typeof value
  return t === 'string' || t === 'number' || t === 'boolean'
}

/**
 * Recursive, shape-agnostic sanitizer.
 *
 * Walks any value (objects, arrays, Maps, Sets), deep-clones along the way, and
 * replaces property values with `'***REDACTED***'` whenever the property key
 * matches a sensitive pattern (case-insensitive substring match) AND the value
 * is a primitive (string/number/boolean/null).
 *
 * Features:
 *  - No mutation of the input.
 *  - Circular references handled via a WeakMap (preserves object identity per cycle).
 *  - Dates pass through as new Date instances.
 *  - Maps and Sets are cloned; for Maps with string keys, sensitive keys are masked.
 *  - Primitives and unknown exotic types pass through unchanged.
 */
export function deepSanitize<T>(value: T, opts: DeepSanitizeOptions = {}): T {
  const patterns =
    opts.keys && opts.keys.length > 0
      ? [...SENSITIVE_FIELD_PATTERNS, ...opts.keys]
      : [...SENSITIVE_FIELD_PATTERNS]

  const seen = new WeakMap<object, unknown>()
  let count = 0

  const walk = (node: unknown): unknown => {
    if (node === null || node === undefined) return node
    const t = typeof node
    if (t !== 'object') return node

    const obj = node as object

    if (seen.has(obj)) return seen.get(obj)

    if (obj instanceof Date) {
      const d = new Date(obj.getTime())
      seen.set(obj, d)
      return d
    }

    if (obj instanceof RegExp) {
      const r = new RegExp(obj.source, obj.flags)
      seen.set(obj, r)
      return r
    }

    if (Array.isArray(obj)) {
      const arr: unknown[] = []
      seen.set(obj, arr)
      for (let i = 0; i < obj.length; i++) {
        arr.push(walk(obj[i]))
      }
      return arr
    }

    if (obj instanceof Map) {
      const m = new Map<unknown, unknown>()
      seen.set(obj, m)
      obj.forEach((v, k) => {
        if (typeof k === 'string' && isSensitiveKey(k, patterns) && isMaskablePrimitive(v)) {
          m.set(k, REDACTED)
          count++
        } else {
          m.set(k, walk(v))
        }
      })
      return m
    }

    if (obj instanceof Set) {
      const s = new Set<unknown>()
      seen.set(obj, s)
      obj.forEach((v) => {
        s.add(walk(v))
      })
      return s
    }

    // Plain object (and anything else object-like we can key-walk).
    const out: Record<string, unknown> = {}
    seen.set(obj, out)
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key, patterns) && isMaskablePrimitive(val)) {
        // Preserve empty/falsy sentinel values to match historical behavior:
        // do not count them and keep them as-is (prevents log spam on empty creds).
        if (val === '' || val === null || val === undefined) {
          out[key] = val
        } else {
          out[key] = REDACTED
          count++
        }
      } else {
        out[key] = walk(val)
      }
    }
    return out
  }

  const result = walk(value) as T

  if (!opts.silent && count > 0) {
    logger.info(`Deep sanitization: masked ${count} sensitive field(s)`)
  }

  return result
}

/**
 * Server-side sanitization of workflow state to remove sensitive credentials.
 *
 * Performs a shape-agnostic deep walk of the provided state, masking any
 * property whose key matches a sensitive pattern at any depth (top-level,
 * `blocks[*].subBlocks[*]`, custom nested config, arrays of objects, etc.).
 *
 * Returns a deep-cloned sanitized copy; the input is not mutated.
 * Safe to call with `null`/`undefined` / primitives — returns the value as-is.
 */
export function sanitizeWorkflowState<T = Record<string, any>>(
  state: T,
  options: SanitizeOptions = {}
): T {
  if (state == null || typeof state !== 'object') {
    return state
  }

  const patterns = options.additionalKeys?.length ? options.additionalKeys : undefined

  // Workflow-state-specific fast path: preserve the historical subBlock shape
  // where `{ value: '...' }` wrappers get their `.value` cleared (empty string,
  // not REDACTED) so the UI re-prompts the user for a new credential.
  const pre = preSanitizeSubBlocks(state, patterns ?? [])

  const sanitized = deepSanitize(pre.state, {
    keys: patterns,
    silent: true,
  })

  const total = pre.count + countMaskedFields(state, sanitized, patterns ?? [])

  if (total > 0 && !options.silent) {
    const suffix = options.source ? ` [source=${options.source}]` : ''
    logger.info(`Server-side sanitization: cleared ${total} sensitive field(s)${suffix}`)
  }

  return sanitized
}

/**
 * Handle the legacy `state.blocks[*].subBlocks[key] = { value }` shape by
 * clearing `.value` to '' (rather than replacing the whole wrapper with
 * REDACTED). This preserves downstream consumers that expect the subBlock
 * object to remain structurally intact.
 */
function preSanitizeSubBlocks<T>(state: T, extraPatterns: string[]): { state: T; count: number } {
  if (!state || typeof state !== 'object') return { state, count: 0 }
  const anyState = state as any
  if (!anyState.blocks || typeof anyState.blocks !== 'object') return { state, count: 0 }

  // Deep clone via JSON for this narrow path — sub-block values are always
  // JSON-serializable per the BlockConfig contract.
  const cloned = JSON.parse(JSON.stringify(state)) as any
  const patterns = [...SENSITIVE_FIELD_PATTERNS, ...extraPatterns]
  let count = 0

  for (const block of Object.values<any>(cloned.blocks)) {
    if (!block || typeof block !== 'object') continue
    const sub = block.subBlocks
    if (!sub || typeof sub !== 'object') continue
    for (const [key, entry] of Object.entries<any>(sub)) {
      if (isSensitiveKey(key, patterns) && entry && typeof entry === 'object' && 'value' in entry) {
        const v = entry.value
        if (v !== '' && v !== null && v !== undefined) {
          entry.value = ''
          count++
        }
      }
    }
  }

  return { state: cloned as T, count }
}

/**
 * Count remaining masked fields introduced by the deep walk beyond what the
 * pre-pass already cleared. Used only for log totals.
 */
function countMaskedFields(_orig: unknown, sanitized: unknown, _extra: string[]): number {
  let n = 0
  const stack: unknown[] = [sanitized]
  const seen = new WeakSet<object>()
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    if (seen.has(cur as object)) continue
    seen.add(cur as object)
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item)
      continue
    }
    if (cur instanceof Map) {
      cur.forEach((v) => stack.push(v))
      continue
    }
    if (cur instanceof Set) {
      cur.forEach((v) => stack.push(v))
      continue
    }
    for (const v of Object.values(cur as Record<string, unknown>)) {
      if (v === REDACTED) n++
      else if (v && typeof v === 'object') stack.push(v)
    }
  }
  return n
}
