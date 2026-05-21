import { APP_HOSTNAME } from '@/lib/config/app-urls'

/**
 * Returns the base URL of the application, respecting environment variables for deployment environments
 * @returns The base URL string (e.g., 'http://localhost:3000' or 'https://example.com')
 */
export function getBaseUrl(): string {
  // In browser, always use current origin (production-safe, no CSP issues)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Server-side: try multiple environment variables
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL

  if (baseUrl) {
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      return baseUrl
    }

    const isProd = process.env.NODE_ENV === 'production'
    const protocol = isProd ? 'https://' : 'http://'
    return `${protocol}${baseUrl}`
  }

  return 'http://localhost:3000'
}

/**
 * Returns just the domain and port part of the application URL
 * @returns The domain with port if applicable (e.g., 'localhost:3000' or APP_HOSTNAME)
 */
export function getBaseDomain(): string {
  try {
    const url = new URL(getBaseUrl())
    return url.host // host includes port if specified
  } catch (e) {
    const isProd = process.env.NODE_ENV === 'production'
    return isProd ? APP_HOSTNAME : 'localhost:3000'
  }
}
