import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { createLogger } from '@/lib/logs/console-logger'
import { getBaseDomain } from '@/lib/urls/utils'

const logger = createLogger('Proxy')

// Environment flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development'

// ---------------------------------------------------------------------------
// CORS – allow multiple origins derived from environment variables
// ---------------------------------------------------------------------------
function buildAllowedOrigins(): string[] {
  if (isDevelopment) {
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:8082',
    ]
    // Include configured app URLs in dev so proxied requests still work
    if (process.env.NEXT_PUBLIC_APP_URL) devOrigins.push(process.env.NEXT_PUBLIC_APP_URL)
    if (process.env.NEXT_PUBLIC_ALT_DOMAIN) devOrigins.push(process.env.NEXT_PUBLIC_ALT_DOMAIN)
    return devOrigins
  }

  const origins: string[] = []
  if (process.env.NEXT_PUBLIC_APP_URL) origins.push(process.env.NEXT_PUBLIC_APP_URL)
  if (process.env.NEXT_PUBLIC_ALT_DOMAIN) origins.push(process.env.NEXT_PUBLIC_ALT_DOMAIN)
  return origins
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (isDevelopment && origin.includes('.exp.direct')) return true
  return ALLOWED_ORIGINS.includes(origin)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie',
} as const

const SUSPICIOUS_UA_PATTERNS = [
  /^\s*$/, // Empty user agents
  /\.\./, // Path traversal attempt
  /<\s*script/i, // Potential XSS payloads
  /^\(\)\s*{/, // Command execution attempt
  /\b(sqlmap|nikto|gobuster|dirb|nmap)\b/i, // Known scanning tools
]

const BASE_DOMAIN = getBaseDomain()

export default async function proxy(request: NextRequest) {
  try {
    const url = request.nextUrl
    const origin = request.headers.get('origin')

    // ---- CORS: handle preflight and actual API requests ----
    if (url.pathname.startsWith('/api/') && isAllowedOrigin(origin)) {
      // Preflight
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin!,
            'Access-Control-Max-Age': '86400',
            ...CORS_HEADERS,
          },
        })
      }
    }

    // Skip HTTPS redirect for internal API calls (memory API, schedules, etc.)
    // These are called server-side via localhost and should not be redirected
    // Skip HTTPS redirect for internal server-to-server calls
    // These are called via http://127.0.0.1:PORT and don't have x-forwarded-proto: https
    const isInternalApiCall =
      url.pathname.startsWith('/api/memory') ||
      url.pathname.startsWith('/api/internal/') ||
      url.pathname.startsWith('/api/hitl/') ||
      url.pathname.startsWith('/api/schedules/execute') ||
      url.pathname.startsWith('/api/triggers/execute') ||
      url.pathname.startsWith('/api/health')

    // Force HTTPS in deployed mode (except for internal API calls)
    if (
      !isInternalApiCall &&
      process.env.NODE_ENV === 'production' &&
      request.headers.get('x-forwarded-proto') !== 'https'
    ) {
      return NextResponse.redirect(
        `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
        301
      )
    }

    // Check for active session
    const sessionCookie = getSessionCookie(request, {
      cookiePrefix: process.env.AUTH_COOKIE_PREFIX || 'better-auth',
    })
    const hasActiveSession = !!sessionCookie

    // Check if user has previously logged in by checking localStorage value in cookies
    const hasPreviouslyLoggedIn = request.cookies.get('has_logged_in_before')?.value === 'true'

    const hostname = request.headers.get('host') || ''

    // Extract subdomain - only for actual subdomains (e.g., subdomain.localhost:3000 or subdomain.example.com)
    // NOT for base domains like localhost:3000 or example.com
    const isCustomDomain =
      hostname !== BASE_DOMAIN &&
      !hostname.startsWith('www.') &&
      hostname !== BASE_DOMAIN &&
      !hostname.endsWith(`.${BASE_DOMAIN}`.replace('www.', '')) &&
      hostname !== 'localhost:3000' && // Exclude base localhost
      hostname !== 'localhost' && // Exclude localhost without port
      hostname.includes(BASE_DOMAIN.replace('www.', '')) &&
      hostname.split('.').length > 1 // Must have at least one dot (subdomain.domain)

    const subdomain = isCustomDomain ? hostname.split('.')[0] : null

    // Handle chat subdomains
    if (subdomain && isCustomDomain) {
      if (url.pathname.startsWith('/api/')) {
        const response = NextResponse.next()
        if (isAllowedOrigin(origin)) {
          response.headers.set('Access-Control-Allow-Origin', origin!)
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }
        return response
      }

      const staticFiles = [
        '/manifest.json',
        '/sw.js',
        '/icon',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
      ]
      const isStaticFile =
        staticFiles.some((file) => url.pathname === file) ||
        url.pathname.startsWith('/static/') ||
        url.pathname.startsWith('/_next/')

      if (isStaticFile) {
        return NextResponse.next()
      }

      const targetPath =
        url.pathname === '/' ? `/chat/${subdomain}` : `/chat/${subdomain}${url.pathname}`
      return NextResponse.rewrite(new URL(targetPath, request.url))
    }

    // Allow access to invitation links
    if (request.nextUrl.pathname.startsWith('/invite/')) {
      return NextResponse.next()
    }

    // Allow API routes to handle their own authentication
    if (url.pathname.startsWith('/api/')) {
      const response = NextResponse.next()
      if (isAllowedOrigin(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin!)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }
      return response
    }

    // Handle protected routes that require authentication
    if (url.pathname.startsWith('/w/') || url.pathname === '/w') {
      if (!hasActiveSession) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      return NextResponse.next()
    }

    // Skip waitlist protection for development environment
    if (isDevelopment) {
      return NextResponse.next()
    }

    // If user has an active session, allow them to access any route
    if (hasActiveSession) {
      return NextResponse.next()
    }

    // Handle login access for users who have previously logged in
    if (url.pathname === '/login') {
      // If this is the login page and user has logged in before, allow access
      if (hasPreviouslyLoggedIn) {
        return NextResponse.next()
      }

      // If there's a redirect to the invite page, bypass any restrictions
      const redirectParam = request.nextUrl.searchParams.get('redirect')
      if (redirectParam && redirectParam.startsWith('/invite/')) {
        return NextResponse.next()
      }
    }

    // Allow free access to signup when deployed (waitlist restrictions removed)
    if (url.pathname === '/signup') {
      return NextResponse.next()
    }

    const userAgent = request.headers.get('user-agent') || ''

    const isSuspicious = SUSPICIOUS_UA_PATTERNS.some((pattern) => pattern.test(userAgent))

    if (isSuspicious) {
      logger.warn('Blocked suspicious request', {
        userAgent,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        url: request.url,
        method: request.method,
        pattern: SUSPICIOUS_UA_PATTERNS.find((pattern) => pattern.test(userAgent))?.toString(),
      })

      // Return 403 with security headers
      return new NextResponse(null, {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'none'",
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    }

    const response = NextResponse.next()

    // Security headers are primarily defined in next.config.ts headers().
    // Only set headers here that are specific to middleware logic (e.g., Vary).
    // Avoid duplicating/overriding next.config.ts headers to prevent conflicts.
    response.headers.set('Vary', 'User-Agent')

    return response
  } catch (error) {
    // Log proxy errors but don't block requests
    console.error('Proxy error:', error)
    return NextResponse.next()
  }
}

// Proxy configuration for Next.js 16
export const config = {
  matcher: [
    '/w', // Match exactly /w
    '/w/:path*', // Match protected routes
    '/login',
    '/signup',
    '/invite/:path*', // Match invitation routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
