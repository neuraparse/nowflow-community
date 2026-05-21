import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'

const logger = createLogger('GatewayRateLimiter')

// Redis key prefixes
const RATE_LIMIT_PREFIX = 'gateway:ratelimit:'
const DEDUP_PREFIX = 'gateway:dedup:'

// Deduplication window in seconds
const DEDUP_TTL = 300 // 5 minutes

// Rate limit window in seconds
const RATE_LIMIT_WINDOW = 60

/**
 * Check if a channel has exceeded its rate limit.
 * Uses a sliding window counter in Redis.
 *
 * @returns true if the request is allowed, false if rate limited
 */
export async function checkRateLimit(channelId: string, limitPerMinute: number): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      // Without Redis, allow all requests (no rate limiting possible)
      return true
    }

    const key = `${RATE_LIMIT_PREFIX}${channelId}`
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW * 1000

    // Use sorted set for sliding window rate limiting
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart) // Remove expired entries
    pipeline.zadd(key, now, `${now}:${Math.random()}`) // Add current request
    pipeline.zcard(key) // Count requests in window
    pipeline.expire(key, RATE_LIMIT_WINDOW) // Set key expiry

    const results = await pipeline.exec()
    if (!results) return true

    // zcard result is at index 2
    const count = results[2]?.[1] as number
    return count <= limitPerMinute
  } catch (error) {
    logger.error('Rate limit check failed, allowing request', { error, channelId })
    return true // Fail open
  }
}

/**
 * Check if a message has already been processed.
 */
export async function isDuplicateMessage(messageId: string): Promise<boolean> {
  try {
    const redis = getRedisClient()
    if (!redis) return false // No dedup without Redis

    const key = `${DEDUP_PREFIX}${messageId}`
    const exists = await redis.exists(key)
    return exists === 1
  } catch (error) {
    logger.error('Dedup check failed', { error, messageId })
    return false // Fail open
  }
}

/**
 * Mark a message as processed for deduplication.
 */
export async function markMessageProcessed(messageId: string): Promise<void> {
  try {
    const redis = getRedisClient()
    if (!redis) return

    const key = `${DEDUP_PREFIX}${messageId}`
    await redis.set(key, '1', 'EX', DEDUP_TTL)
  } catch (error) {
    logger.error('Failed to mark message as processed', { error, messageId })
  }
}
