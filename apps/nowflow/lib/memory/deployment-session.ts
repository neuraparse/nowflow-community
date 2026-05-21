import { cookies, headers } from 'next/headers'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DeploymentSession')

/**
 * Browser fingerprint components for anonymous session tracking
 * Used when user is not authenticated
 */
interface BrowserFingerprint {
  userAgent: string
  language: string
  timezone: string
  screenResolution?: string
  platform?: string
}

/**
 * Deployment session context for chat interfaces
 * Extends base session with deployment-specific tracking
 */
export interface DeploymentSessionContext {
  /** Unique session ID (persistent across requests) */
  sessionId: string

  /** User ID if authenticated */
  userId?: string

  /** Workflow ID being executed */
  workflowId: string

  /** Anonymous flag */
  isAnonymous: boolean

  /** Session creation timestamp */
  createdAt: number

  /** IP address (for rate limiting and analytics) */
  ipAddress?: string

  /** User agent string */
  userAgent?: string

  /** Geographic location (optional, from IP) */
  location?: {
    country?: string
    city?: string
    region?: string
  }

  /** Browser fingerprint hash (for anonymous tracking) */
  fingerprint?: string

  /** Referer URL */
  referer?: string

  /** Session source (embedded, direct, etc.) */
  source: 'embedded' | 'direct' | 'api' | 'test'

  /** Metadata */
  metadata?: Record<string, any>
}

/**
 * Deployment Session Manager
 *
 * Handles session tracking for deployed chat interfaces:
 * - Cookie-based session persistence
 * - Browser fingerprinting for anonymous users
 * - IP-based rate limiting
 * - Analytics and monitoring
 *
 * Use cases:
 * 1. Public chat widget on website
 * 2. Embedded chatbot in app
 * 3. Standalone chat interface
 */
export class DeploymentSessionManager {
  private static readonly COOKIE_NAME = 'nowflow_session'
  private static readonly COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days
  private static readonly FINGERPRINT_HEADER = 'X-Browser-Fingerprint'

  /**
   * Resolve deployment session from request
   * Priority: Cookie > sessionToken (from body) > Fingerprint (from body/header) > Generate new
   */
  static async resolve(options: {
    workflowId: string
    userId?: string
    source?: 'embedded' | 'direct' | 'api' | 'test'
    sessionToken?: string // Session token from request body (for cross-domain scenarios)
    fingerprint?: string // Browser fingerprint from request body (for tracking)
  }): Promise<DeploymentSessionContext> {
    try {
      const headersList = await headers()
      const cookieStore = await cookies()

      // Get or create session ID
      // Pass sessionToken from body for cross-domain scenarios where cookies don't work
      const sessionId = await this.getOrCreateSessionId(
        cookieStore,
        headersList,
        options.sessionToken
      )

      // Extract client info
      const userAgent = headersList.get('user-agent') || 'unknown'
      const ipAddress = this.extractIpAddress(headersList)
      const referer = headersList.get('referer') || undefined

      // Fingerprint priority: body > header (body is more reliable for cross-domain)
      const fingerprint =
        options.fingerprint || headersList.get(this.FINGERPRINT_HEADER) || undefined

      // Build session context
      const context: DeploymentSessionContext = {
        sessionId,
        userId: options.userId,
        workflowId: options.workflowId,
        isAnonymous: !options.userId,
        createdAt: Date.now(),
        ipAddress,
        userAgent,
        fingerprint,
        referer,
        source: options.source || 'direct',
      }

      logger.info('Deployment session resolved', {
        sessionId,
        userId: options.userId,
        isAnonymous: context.isAnonymous,
        source: context.source,
        hasFingerprint: !!fingerprint,
      })

      return context
    } catch (error) {
      logger.error('Failed to resolve deployment session', { error })

      // Fallback to generated session
      return {
        sessionId: `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        workflowId: options.workflowId,
        userId: options.userId,
        isAnonymous: !options.userId,
        createdAt: Date.now(),
        source: options.source || 'direct',
      }
    }
  }

  /**
   * Get or create session ID from sessionToken (body), cookie, or generate new
   * Priority: sessionToken (from request body) > Cookie > Generate new
   *
   * IMPORTANT: sessionToken from request body takes precedence because:
   * 1. Cross-domain scenarios (subdomains) may not share cookies
   * 2. Each chat interface tab should maintain its own session
   * 3. Client generates unique sessionToken per chat subdomain in localStorage
   */
  private static async getOrCreateSessionId(
    cookieStore: Awaited<ReturnType<typeof cookies>>,
    headersList: Awaited<ReturnType<typeof headers>>,
    sessionToken?: string
  ): Promise<string> {
    // Priority 1: Use sessionToken from request body (MOST RELIABLE for cross-domain)
    // Client generates unique token per subdomain in localStorage
    if (sessionToken && this.isValidSessionId(sessionToken)) {
      logger.debug('Using session token from request body', { sessionId: sessionToken })
      return sessionToken
    }

    // Priority 2: Try to get existing session from cookie (fallback for same-domain)
    const existingSession = cookieStore.get(this.COOKIE_NAME)?.value

    if (existingSession && this.isValidSessionId(existingSession)) {
      logger.debug('Using existing session from cookie', { sessionId: existingSession })
      return existingSession
    }

    // Priority 3: Generate new session ID
    const newSessionId = this.generateSecureSessionId()

    // Try to set cookie (might fail in some contexts)
    try {
      cookieStore.set(this.COOKIE_NAME, newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: this.COOKIE_MAX_AGE,
        path: '/',
      })

      logger.debug('Created new session cookie', { sessionId: newSessionId })
    } catch (error) {
      logger.warn('Failed to set session cookie (might be read-only context)', { error })
    }

    return newSessionId
  }

  /**
   * Extract IP address from headers
   * Supports common proxy headers
   */
  private static extractIpAddress(
    headersList: Awaited<ReturnType<typeof headers>>
  ): string | undefined {
    // Try common proxy headers
    const forwardedFor = headersList.get('x-forwarded-for')
    if (forwardedFor) {
      // X-Forwarded-For can be a comma-separated list
      return forwardedFor.split(',')[0].trim()
    }

    const realIp = headersList.get('x-real-ip')
    if (realIp) {
      return realIp
    }

    const cfConnectingIp = headersList.get('cf-connecting-ip') // Cloudflare
    if (cfConnectingIp) {
      return cfConnectingIp
    }

    return undefined
  }

  /**
   * Generate cryptographically secure session ID
   */
  private static generateSecureSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `sess_${crypto.randomUUID().replace(/-/g, '')}`
    }

    // Fallback
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
  }

  /**
   * Validate session ID format
   */
  private static isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false
    }

    // Check format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
      return false
    }

    return true
  }

  /**
   * Generate browser fingerprint hash
   * Used for anonymous user tracking across sessions
   */
  static generateFingerprint(components: BrowserFingerprint): string {
    const data = [
      components.userAgent,
      components.language,
      components.timezone,
      components.screenResolution || '',
      components.platform || '',
    ].join('|')

    // Simple hash (in production, use crypto.subtle.digest)
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }

    return `fp_${Math.abs(hash).toString(36)}`
  }

  /**
   * Convert deployment session to memory session format
   */
  static toMemorySessionId(context: DeploymentSessionContext): string {
    if (context.userId) {
      return `user-${context.userId}-workflow-${context.workflowId}`
    }

    // For anonymous users, use persistent session ID
    return `anon-${context.sessionId}-workflow-${context.workflowId}`
  }

  /**
   * Check rate limit for session (prevent abuse)
   */
  static async checkRateLimit(
    sessionId: string,
    options: {
      maxRequests: number
      windowMs: number
    }
  ): Promise<{
    allowed: boolean
    remaining: number
    resetAt: number
  }> {
    // TODO: Implement with Redis or in-memory store
    // For now, always allow
    return {
      allowed: true,
      remaining: options.maxRequests,
      resetAt: Date.now() + options.windowMs,
    }
  }

  /**
   * Migrate anonymous session to authenticated user
   * When user logs in, preserve their conversation history
   */
  static async migrateToUser(
    anonymousSessionId: string,
    userId: string,
    workflowId: string
  ): Promise<void> {
    logger.info('Migrating anonymous session to user', {
      anonymousSessionId,
      userId,
      workflowId,
    })

    // TODO: Update all memories from anonymous session to user session
    // This requires a new API endpoint in /api/memory
    // For now, this is a placeholder
  }
}

/**
 * Middleware helper for deployment endpoints
 * Use in API routes that handle chat requests
 */
export async function withDeploymentSession<T>(
  workflowId: string,
  userId: string | undefined,
  handler: (session: DeploymentSessionContext) => Promise<T>
): Promise<T> {
  const session = await DeploymentSessionManager.resolve({
    workflowId,
    userId,
    source: 'api',
  })

  return handler(session)
}
