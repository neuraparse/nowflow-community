/**
 * Secret redaction utility.
 *
 * Deep-clones the input and masks any value whose key matches a
 * sensitive name (case-insensitive, substring match).
 */

const DEFAULT_SENSITIVE_KEYS = [
  'apikey',
  'api_key',
  'token',
  'password',
  'secret',
  'authorization',
  'auth',
  'access_token',
  'refresh_token',
  'client_secret',
  'private_key',
  'cookie',
]

const MASK = '***REDACTED***'

function isSensitive(key: string, sensitive: string[]): boolean {
  const k = key.toLowerCase()
  return sensitive.some((s) => k.includes(s))
}

export function redactSecrets(obj: unknown, keys?: string[]): unknown {
  const sensitive = (keys ?? DEFAULT_SENSITIVE_KEYS).map((k) => k.toLowerCase())
  const seen = new WeakSet<object>()

  const walk = (value: unknown): unknown => {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value

    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)

    if (Array.isArray(value)) {
      return value.map((item) => walk(item))
    }

    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitive(k, sensitive)) {
        result[k] = MASK
      } else {
        result[k] = walk(v)
      }
    }
    return result
  }

  return walk(obj)
}
