import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('OAuthRevoke')

/**
 * Best-effort revocation of an OAuth access/refresh token at the upstream provider.
 *
 * On failure (network error, provider returns non-2xx, no revocation endpoint
 * defined for the provider) this **never throws** — it logs and resolves to
 * `false`. Callers should still proceed to delete the local credential record
 * regardless of the result, because (a) the user's intent is to disconnect,
 * and (b) the token may already be expired at the provider.
 *
 * Returns `true` when the revocation request succeeded (HTTP 2xx), `false`
 * otherwise, and `'skipped'` when no upstream revocation endpoint exists.
 */
export async function revokeProviderToken(
  providerId: string,
  accessToken: string | null | undefined,
  refreshToken?: string | null
): Promise<'ok' | 'failed' | 'skipped'> {
  if (!accessToken && !refreshToken) return 'skipped'

  const handler = REVOCATION_HANDLERS[normalizeProvider(providerId)]
  if (!handler) return 'skipped'

  try {
    const ok = await handler({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
    })
    if (ok) {
      logger.info('Upstream OAuth token revoked', { providerId })
      return 'ok'
    }
    logger.warn('Upstream OAuth revocation returned non-OK', { providerId })
    return 'failed'
  } catch (err) {
    logger.warn('Upstream OAuth revocation threw', {
      providerId,
      error: err instanceof Error ? err.message : String(err),
    })
    return 'failed'
  }
}

// ─── Provider normalization ──────────────────────────────────────────────────

function normalizeProvider(id: string): string {
  // Map prefixed scopes (e.g. `google-drive`, `microsoft-teams`) to their
  // family handler. The family is the substring before the first hyphen,
  // unless the full id is a registered provider.
  if (REVOCATION_HANDLERS[id]) return id
  const family = id.split('-')[0]
  return family
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type RevokeArgs = { accessToken: string | null; refreshToken: string | null }
type RevokeFn = (args: RevokeArgs) => Promise<boolean>

const REVOCATION_HANDLERS: Record<string, RevokeFn> = {
  // Google: same revocation endpoint for all google-* scoped providers.
  // https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
  google: async ({ accessToken, refreshToken }) => {
    const token = refreshToken ?? accessToken
    if (!token) return false
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    })
    return res.ok
  },

  // GitHub: revoking the token requires Basic auth with client credentials.
  // https://docs.github.com/en/rest/apps/oauth-applications#delete-an-app-token
  github: async ({ accessToken }) => {
    if (!accessToken) return false
    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET
    if (!clientId || !clientSecret) return false
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: accessToken }),
    })
    return res.status === 204
  },

  // Slack: simple POST with the token. https://api.slack.com/methods/auth.revoke
  slack: async ({ accessToken }) => {
    if (!accessToken) return false
    const res = await fetch('https://slack.com/api/auth.revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return false
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return data?.ok === true
  },

  // X (Twitter): RFC 7009 token revocation.
  // https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/revoke-tokens
  x: async ({ accessToken, refreshToken }) => {
    const token = refreshToken ?? accessToken
    if (!token) return false
    const clientId = process.env.X_CLIENT_ID
    if (!clientId) return false
    const res = await fetch('https://api.x.com/2/oauth2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: clientId,
        token_type_hint: refreshToken ? 'refresh_token' : 'access_token',
      }).toString(),
    })
    return res.ok
  },

  // LinkedIn: RFC 7009 with client credentials in body.
  // https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens#revoke-tokens
  linkedin: async ({ accessToken, refreshToken }) => {
    const token = refreshToken ?? accessToken
    if (!token) return false
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret) return false
    const res = await fetch('https://www.linkedin.com/oauth/v2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    })
    return res.ok
  },

  // Microsoft Graph does not expose a self-service revocation endpoint for
  // delegated tokens; tokens are short-lived and refresh tokens can only be
  // invalidated by the user via the Microsoft account portal. Marking as
  // 'skipped' is the correct behaviour here (handler returns false, caller
  // treats as best-effort no-op).
}
