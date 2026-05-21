/**
 * Get the base URL for API calls
 * Uses window.location.origin in browser (production-safe)
 * Falls back to environment variable for server-side
 *
 * @param contextBaseUrl - Optional base URL from execution context (for deployment subdomains)
 */
export function getApiBaseUrl(contextBaseUrl?: string): string {
  // Priority 1: Use context base URL if provided (for deployment subdomains)
  if (contextBaseUrl) {
    return contextBaseUrl
  }

  // Priority 2: In browser, always use current origin (production-safe, no CSP issues)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Priority 3: Server-side - use internal URL to avoid hairpin NAT issues
  // CRITICAL FIX: Use localhost instead of public domain to prevent ECONNREFUSED
  // Server should call itself internally, not via public DNS
  return process.env.INTERNAL_API_URL || 'http://localhost:3000'
}

/**
 * Get the full URL for a specific API endpoint
 * @param path - API path (e.g., '/api/providers', '/api/tools/custom')
 * @param params - Optional query parameters
 * @param contextBaseUrl - Optional base URL from execution context (for deployment subdomains)
 */
export function getApiUrl(
  path: string,
  params?: Record<string, string>,
  contextBaseUrl?: string
): string {
  const baseUrl = getApiBaseUrl(contextBaseUrl)
  const url = new URL(path, baseUrl)

  // Add query parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  return url.toString()
}

/**
 * Get the full URL for the providers API endpoint
 *
 * IMPORTANT: Provider API is always on the main domain (example.com), NOT on subdomains!
 * Subdomains (e.g., netasasistan.example.com) only serve chat interfaces,
 * they don't have provider API routes.
 *
 * @param contextBaseUrl - IGNORED - Provider API is always on main domain
 */
export function getProvidersApiUrl(contextBaseUrl?: string): string {
  // CRITICAL: Do NOT use contextBaseUrl for provider API!
  // Provider API only exists on main domain, not on chat subdomains
  return getApiUrl('/api/providers', undefined, undefined)
}
