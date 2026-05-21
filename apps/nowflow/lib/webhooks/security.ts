import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('WebhookSecurity')

/**
 * Verify webhook signature using HMAC SHA-256
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): Promise<boolean> {
  try {
    const hmac = crypto.createHmac(algorithm, secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch (error) {
    logger.error('Error verifying webhook signature:', error)
    return false
  }
}

/**
 * Verify webhook signature with prefix (e.g., "sha256=...")
 */
export async function verifyWebhookSignatureWithPrefix(
  payload: string,
  signatureHeader: string,
  secret: string,
  prefix: string = 'sha256='
): Promise<boolean> {
  try {
    if (!signatureHeader.startsWith(prefix)) {
      logger.warn('Invalid signature format - missing prefix')
      return false
    }

    const signature = signatureHeader.substring(prefix.length)
    const algorithm = prefix.replace('=', '') as 'sha256' | 'sha1'

    return verifyWebhookSignature(payload, signature, secret, algorithm)
  } catch (error) {
    logger.error('Error verifying webhook signature with prefix:', error)
    return false
  }
}

/**
 * Check if IP is in whitelist
 */
export function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) {
    return true // No IP restriction
  }

  // Support CIDR notation and wildcards
  for (const allowedIp of allowedIps) {
    if (allowedIp === '*') {
      return true
    }

    // Exact match
    if (clientIp === allowedIp) {
      return true
    }

    // Wildcard match (e.g., "192.168.*.*")
    if (allowedIp.includes('*')) {
      const pattern = allowedIp.replace(/\./g, '\\.').replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      if (regex.test(clientIp)) {
        return true
      }
    }

    // CIDR notation support (basic implementation)
    if (allowedIp.includes('/')) {
      // For production, use a proper CIDR library
      const [network, bits] = allowedIp.split('/')
      const networkParts = network.split('.')
      const clientParts = clientIp.split('.')

      const bitsNum = parseInt(bits)
      const bytesToCheck = Math.floor(bitsNum / 8)

      let match = true
      for (let i = 0; i < bytesToCheck; i++) {
        if (networkParts[i] !== clientParts[i]) {
          match = false
          break
        }
      }

      if (match) {
        return true
      }
    }
  }

  return false
}

/**
 * Extract client IP from request
 */
export function getClientIp(request: NextRequest): string {
  // Check common headers for real IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to connection IP (may not be available in all environments)
  return 'unknown'
}

/**
 * Rate limiting check using in-memory store
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = `ratelimit:${identifier}`

  const current = rateLimitStore.get(key)

  if (!current || current.resetAt < now) {
    // New window
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (current.count >= limit) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }

  // Increment count
  current.count++
  rateLimitStore.set(key, current)

  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt }
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validate webhook timestamp to prevent replay attacks
 */
export function isTimestampValid(
  timestamp: string | number,
  maxAgeSeconds: number = 300 // 5 minutes default
): boolean {
  try {
    const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
    const now = Math.floor(Date.now() / 1000)
    const age = Math.abs(now - timestampNum)

    return age <= maxAgeSeconds
  } catch (error) {
    logger.error('Error validating timestamp:', error)
    return false
  }
}

/**
 * Sanitize webhook payload for logging
 * Remove sensitive information
 */
export function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'credential',
    'private_key',
    'privateKey',
  ]

  const sanitized = { ...payload }

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase()

    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '***REDACTED***'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizePayload(sanitized[key])
    }
  }

  return sanitized
}

/**
 * Calculate webhook health status based on recent triggers
 */
export function calculateHealthStatus(
  totalTriggers: number,
  successfulTriggers: number,
  failedTriggers: number,
  lastTriggeredAt: Date | null
): 'healthy' | 'warning' | 'error' | 'inactive' {
  // If never triggered or not triggered in last 7 days
  if (!lastTriggeredAt || Date.now() - lastTriggeredAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return 'inactive'
  }

  if (totalTriggers === 0) {
    return 'inactive'
  }

  const successRate = successfulTriggers / totalTriggers

  if (successRate >= 0.95) {
    return 'healthy'
  } else if (successRate >= 0.8) {
    return 'warning'
  } else {
    return 'error'
  }
}
