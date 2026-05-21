/**
 * Redirect URI allowlist for OAuth flows.
 *
 * SECURITY: Never trust a redirect URI supplied by agents or clients. Any URI
 * that reaches the authorization server must be validated against this
 * allowlist. The allowlist is composed from:
 *   1. The deployment's own origin (NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL).
 *   2. The comma-separated `OAUTH_ALLOWED_REDIRECT_URIS` env var (exact-match).
 *
 * Matching is exact on the fully qualified URI string after normalization.
 * Wildcard or prefix matching is intentionally not supported.
 */

const parseAllowlistEnv = (raw: string | undefined): string[] => {
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

const getDeploymentOrigin = (): string | null => {
  const candidate = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  if (!candidate) return null
  try {
    return new URL(candidate).origin
  } catch {
    return null
  }
}

const normalizeUri = (uri: string): string | null => {
  try {
    const parsed = new URL(uri)
    // Reject anything that is not http/https to avoid javascript:, data:, file: URIs.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null
    }
    // Strip trailing slash from pathname to make comparison deterministic.
    const pathname =
      parsed.pathname.endsWith('/') && parsed.pathname.length > 1
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname
    return `${parsed.origin}${pathname}${parsed.search}`
  } catch {
    return null
  }
}

/**
 * Returns true if the URI is on the allowlist or resolves to the deployment
 * origin, otherwise false.
 */
export const isAllowedRedirectUri = (uri: string): boolean => {
  if (typeof uri !== 'string' || uri.length === 0) return false

  const normalized = normalizeUri(uri)
  if (!normalized) return false

  const allowlist = parseAllowlistEnv(process.env.OAUTH_ALLOWED_REDIRECT_URIS)
  const normalizedAllowlist = allowlist
    .map((entry) => normalizeUri(entry))
    .filter((entry): entry is string => entry !== null)

  if (normalizedAllowlist.includes(normalized)) return true

  const origin = getDeploymentOrigin()
  if (origin) {
    try {
      const parsed = new URL(normalized)
      if (parsed.origin === origin) return true
    } catch {
      return false
    }
  }

  return false
}
