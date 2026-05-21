/**
 * UUID v4 generation helpers.
 *
 * Extracted from `lib/utils.ts`. Prefers `crypto.randomUUID()` when available
 * (Node 16+ / modern browsers); falls back to a `Math.random` template for
 * older environments. Callers should import from `@/lib/utils` (the
 * canonical entry — re-exports this symbol).
 */

/** Generate a UUID v4 compatible string. Works in browser + Node.js. */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for older environments lacking `crypto.randomUUID()`.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
