import { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/client-ip'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('RateLimiter')

interface RateLimitConfig {
  enabled: boolean
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
}

interface QuotaConfig {
  enabled: boolean
  monthlyMessageLimit?: number
  perUserDailyLimit?: number
}

interface LimitsConfig {
  rateLimit?: RateLimitConfig
  quotas?: QuotaConfig
  ipWhitelist?: string[]
  ipBlacklist?: string[]
}

// In-memory store for rate limiting (for simple use case)
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const quotaStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Check if IP is in whitelist or blacklist
 */
export function checkIPAccess(
  ip: string,
  whitelist?: string[],
  blacklist?: string[]
): { allowed: boolean; reason?: string } {
  // Check blacklist first
  if (blacklist && blacklist.length > 0) {
    for (const blockedIP of blacklist) {
      if (isIPMatch(ip, blockedIP)) {
        return { allowed: false, reason: 'IP is blacklisted' }
      }
    }
  }

  // Check whitelist
  if (whitelist && whitelist.length > 0) {
    let isWhitelisted = false
    for (const allowedIP of whitelist) {
      if (isIPMatch(ip, allowedIP)) {
        isWhitelisted = true
        break
      }
    }

    if (!isWhitelisted) {
      return { allowed: false, reason: 'IP not whitelisted' }
    }
  }

  return { allowed: true }
}

/**
 * Check if IP matches pattern (supports CIDR notation)
 */
function isIPMatch(ip: string, pattern: string): boolean {
  // Simple exact match (for now)
  // TODO: Add CIDR notation support
  return ip === pattern || pattern === '*'
}

/**
 * Get client IP from request.
 *
 * Delegates to the Cloudflare-aware helper in `lib/client-ip` so that, once
 * the app is behind Cloudflare with Authenticated Origin Pulls, the real
 * visitor IP (not the CF edge IP) is used for all rate-limit / audit keys.
 */
export function getClientIP(request: NextRequest): string {
  return getClientIp(request.headers)
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number; limit?: number; remaining?: number } {
  if (!config.enabled) {
    return { allowed: true }
  }

  const now = Date.now()
  const key = `rate:${identifier}`

  // Clean up expired entries
  const current = rateLimitStore.get(key)
  if (current && current.resetAt < now) {
    rateLimitStore.delete(key)
  }

  // Determine limit and window
  let limit: number
  let windowMs: number

  if (config.requestsPerMinute) {
    limit = config.requestsPerMinute
    windowMs = 60 * 1000 // 1 minute
  } else if (config.requestsPerHour) {
    limit = config.requestsPerHour
    windowMs = 60 * 60 * 1000 // 1 hour
  } else if (config.requestsPerDay) {
    limit = config.requestsPerDay
    windowMs = 24 * 60 * 60 * 1000 // 1 day
  } else {
    // No limits configured
    return { allowed: true }
  }

  const entry = rateLimitStore.get(key)

  if (!entry) {
    // First request
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      allowed: true,
      limit,
      remaining: limit - 1,
    }
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

    logger.warn('Rate limit exceeded:', {
      identifier,
      count: entry.count,
      limit,
      retryAfter,
    })

    return {
      allowed: false,
      retryAfter,
      limit,
      remaining: 0,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
  }
}

/**
 * Check quota limits
 */
export function checkQuota(
  identifier: string,
  config: QuotaConfig
): { allowed: boolean; limit?: number; used?: number; remaining?: number } {
  if (!config.enabled) {
    return { allowed: true }
  }

  const now = Date.now()
  const key = `quota:${identifier}`

  // Clean up expired entries
  const current = quotaStore.get(key)
  if (current && current.resetAt < now) {
    quotaStore.delete(key)
  }

  // Determine limit and window
  let limit: number
  let windowMs: number

  if (config.perUserDailyLimit) {
    limit = config.perUserDailyLimit
    windowMs = 24 * 60 * 60 * 1000 // 1 day
  } else if (config.monthlyMessageLimit) {
    limit = config.monthlyMessageLimit
    windowMs = 30 * 24 * 60 * 60 * 1000 // 30 days
  } else {
    // No quotas configured
    return { allowed: true }
  }

  const entry = quotaStore.get(key)

  if (!entry) {
    // First request
    quotaStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      allowed: true,
      limit,
      used: 1,
      remaining: limit - 1,
    }
  }

  if (entry.count >= limit) {
    // Quota exceeded
    logger.warn('Quota exceeded:', {
      identifier,
      count: entry.count,
      limit,
    })

    return {
      allowed: false,
      limit,
      used: entry.count,
      remaining: 0,
    }
  }

  // Increment count
  entry.count++
  quotaStore.set(key, entry)

  return {
    allowed: true,
    limit,
    used: entry.count,
    remaining: limit - entry.count,
  }
}

/**
 * Main rate limiting function
 */
export function applyRateLimits(
  request: NextRequest,
  limits: LimitsConfig
): {
  allowed: boolean
  error?: string
  headers?: Record<string, string>
} {
  const ip = getClientIP(request)
  const sessionToken = request.headers.get('X-Session-Token') || ip

  // Check IP access
  const ipCheck = checkIPAccess(ip, limits.ipWhitelist, limits.ipBlacklist)
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      error: ipCheck.reason || 'Access denied',
    }
  }

  // Check rate limits
  if (limits.rateLimit?.enabled) {
    const rateLimitResult = checkRateLimit(ip, limits.rateLimit)

    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        error: 'Rate limit exceeded. Please try again later.',
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '0',
          'X-RateLimit-Remaining': '0',
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        },
      }
    }

    // Add rate limit headers
    if (rateLimitResult.limit && rateLimitResult.remaining !== undefined) {
      return {
        allowed: true,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        },
      }
    }
  }

  // Check quotas
  if (limits.quotas?.enabled) {
    const quotaResult = checkQuota(sessionToken, limits.quotas)

    if (!quotaResult.allowed) {
      return {
        allowed: false,
        error: 'Message quota exceeded. Please try again later.',
        headers: {
          'X-Quota-Limit': quotaResult.limit?.toString() || '0',
          'X-Quota-Used': quotaResult.used?.toString() || '0',
          'X-Quota-Remaining': '0',
        },
      }
    }

    // Add quota headers
    if (quotaResult.limit && quotaResult.remaining !== undefined) {
      return {
        allowed: true,
        headers: {
          'X-Quota-Limit': quotaResult.limit.toString(),
          'X-Quota-Used': quotaResult.used?.toString() || '0',
          'X-Quota-Remaining': quotaResult.remaining.toString(),
        },
      }
    }
  }

  return { allowed: true }
}

/**
 * Clean up expired entries periodically
 */
setInterval(
  () => {
    const now = Date.now()

    // Clean rate limit store
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }

    // Clean quota store
    for (const [key, value] of quotaStore.entries()) {
      if (value.resetAt < now) {
        quotaStore.delete(key)
      }
    }

    logger.debug('Cleaned up expired rate limit entries')
  },
  5 * 60 * 1000
) // Every 5 minutes
