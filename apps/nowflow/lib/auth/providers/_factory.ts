/**
 * OAuth provider factory.
 *
 * Reduces boilerplate across the per-vendor provider files
 * (meta.ts, google.ts, microsoft.ts, sap.ts, atlassian.ts, individual.ts,
 * social.ts, trusted.ts) by collapsing the repeated shape — providerId,
 * conditional env-var presence, authorizationUrl/tokenUrl/userInfoUrl,
 * scopes, and the standard `getUserInfo` / `mapProfileToUser` callbacks —
 * into a single declarative template object.
 *
 * Templates that need behavior beyond the defaults can supply custom
 * `getUserInfo` / `mapProfileToUser` callbacks; the factory will use those
 * verbatim. For everything else, the factory injects sensible defaults.
 */
import { logger } from '../helpers'

export type OAuthUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export type OAuthProviderTemplate = {
  providerId: string
  clientIdEnv: string
  clientSecretEnv: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  /**
   * Extra OAuth options forwarded to the underlying provider config
   * (e.g. `responseType`, `accessType`, `prompt`, `pkce`, `authentication`).
   * Anything passed here is merged onto the resulting provider verbatim.
   */
  extra?: Record<string, unknown>
  /** Override the redirect URI; defaults to `${NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/${providerId}`. */
  redirectURI?: string
  /**
   * Optional override. If absent, the factory provides a default
   * implementation that fetches `userInfoUrl` with a Bearer token and
   * passes the JSON body through `mapProfileToUser`.
   */
  getUserInfo?: (tokens: any) => Promise<OAuthUser | null>
  /**
   * Maps the raw provider profile JSON to the canonical OAuthUser shape.
   * Used by the default `getUserInfo` implementation.
   */
  mapProfileToUser?: (profile: any) => OAuthUser
}

const defaultMapProfileToUser = (profile: any): OAuthUser => ({
  id: String(profile?.id ?? ''),
  email: profile?.email ?? null,
  name: profile?.name ?? null,
  image: profile?.image ?? profile?.avatar_url ?? null,
  emailVerified: profile?.email ? true : false,
})

const buildDefaultGetUserInfo = (
  template: OAuthProviderTemplate,
  mapProfileToUser: (profile: any) => OAuthUser
) => {
  return async (tokens: any): Promise<OAuthUser | null> => {
    if (!template.userInfoUrl) {
      logger.error(`Missing userInfoUrl for provider ${template.providerId}`)
      return null
    }
    try {
      const response = await fetch(template.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      })
      if (!response.ok) {
        logger.error(`Error fetching ${template.providerId} user info:`, {
          status: response.status,
          statusText: response.statusText,
        })
        return null
      }
      const profile = await response.json()
      const now = new Date()
      const mapped = mapProfileToUser(profile)
      return {
        emailVerified: mapped.email ? true : false,
        image: null,
        ...mapped,
        createdAt: now,
        updatedAt: now,
      }
    } catch (error) {
      logger.error(`Error in ${template.providerId} getUserInfo:`, { error })
      return null
    }
  }
}

export function createOAuthProvider(template: OAuthProviderTemplate) {
  const clientId = process.env[template.clientIdEnv]
  const clientSecret = process.env[template.clientSecretEnv]
  if (!clientId || !clientSecret) return null

  const mapProfileToUser = template.mapProfileToUser ?? defaultMapProfileToUser
  const getUserInfo = template.getUserInfo ?? buildDefaultGetUserInfo(template, mapProfileToUser)

  return {
    providerId: template.providerId,
    clientId,
    clientSecret,
    authorizationUrl: template.authorizationUrl,
    tokenUrl: template.tokenUrl,
    userInfoUrl: template.userInfoUrl,
    scopes: template.scopes,
    redirectURI:
      template.redirectURI ??
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/${template.providerId}`,
    ...(template.extra ?? {}),
    getUserInfo,
  }
}

export function buildProviderList(templates: OAuthProviderTemplate[]) {
  return templates.map(createOAuthProvider).filter((p): p is NonNullable<typeof p> => p !== null)
}
