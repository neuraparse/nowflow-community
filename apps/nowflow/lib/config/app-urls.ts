/**
 * Centralized domain/URL configuration - single source of truth.
 *
 * For the runtime-detected base URL (respects browser origin and env vars),
 * use `getBaseUrl()` / `getBaseDomain()` from '@/lib/urls/utils'.
 * The constants below are for static domain lists, allow-lists, and metadata.
 */

// ---------------------------------------------------------------------------
// Primary domain
// ---------------------------------------------------------------------------
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const APP_DOMAINS = [APP_DOMAIN, APP_DOMAIN.replace('https://', 'https://www.')]

// ---------------------------------------------------------------------------
// Alternate / alias domain (optional - set NEXT_PUBLIC_ALT_DOMAIN if needed)
// ---------------------------------------------------------------------------
export const ALT_DOMAIN = process.env.NEXT_PUBLIC_ALT_DOMAIN || ''
export const ALT_DOMAINS = ALT_DOMAIN
  ? [ALT_DOMAIN, ALT_DOMAIN.replace('https://', 'https://www.')]
  : []

// ---------------------------------------------------------------------------
// Combined lists (useful for CORS, CSP, allowed-origins, etc.)
// ---------------------------------------------------------------------------
export const ALL_DOMAINS = [...APP_DOMAINS, ...ALT_DOMAINS]
export const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

// ---------------------------------------------------------------------------
// Bare hostnames (without protocol) - handy for hostname comparisons
// ---------------------------------------------------------------------------
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

export const APP_HOSTNAME = stripProtocol(APP_DOMAIN) // e.g. 'example.com'
export const ALT_HOSTNAME = ALT_DOMAIN ? stripProtocol(ALT_DOMAIN) : ''
export const ALL_HOSTNAMES = ALL_DOMAINS.map(stripProtocol)

// ---------------------------------------------------------------------------
// Cookie domain (for production cross-subdomain cookies)
// ---------------------------------------------------------------------------
export const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || `.${APP_HOSTNAME}` // e.g. '.example.com'

// ---------------------------------------------------------------------------
// Company / branding
// ---------------------------------------------------------------------------
export const SENDER_NAME = process.env.SMTP_FROM_NAME || 'NowFlow'
export const COMPANY_NAME = process.env.COMPANY_NAME || 'NowFlow'
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || `support@${APP_HOSTNAME}`

// ---------------------------------------------------------------------------
// Sender email addresses
// ---------------------------------------------------------------------------
export const NOREPLY_EMAIL = process.env.NOREPLY_EMAIL || `noreply@${APP_HOSTNAME}`
export const ONBOARDING_FROM = `${SENDER_NAME} <${process.env.ONBOARDING_EMAIL || `onboarding@${APP_HOSTNAME}`}>`
export const TEAM_FROM = `${SENDER_NAME} <${process.env.TEAM_EMAIL || `team@${APP_HOSTNAME}`}>`
