/**
 * Redis-backed rate limit store with in-memory fallback.
 *
 * Implements the same `checkRateLimit(identifier, limit, windowMs)` shape used
 * by `lib/webhooks/security.ts` so call-sites can swap from the in-memory map
 * with no API change. Uses fixed-window counters via atomic `INCR` + `EXPIRE`
 * (sliding-window approximation). Falls back to a per-process Map if Redis is
 * unavailable so dev / single-instance setups still work.
 *
 * NOTE: Fixed-window has the standard burst-at-boundary tradeoff — a client
 * can do up to 2x `limit` across the boundary. A precise sliding-window
 * implementation (Lua + sorted set, or two interpolated buckets) is left as
 * a TODO, called out below.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'

const logger = createLogger('RedisRateLimit')

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export type RateLimitBackend = 'redis' | 'memory'

export type RateLimitCheckResult = RateLimitResult & {
  backend: RateLimitBackend
}

const KEY_PREFIX = 'ratelimit:'

// In-memory fallback. Mirrors the shape used by the legacy stores so behaviour
// is identical when Redis is offline. Module-scoped so it survives across
// requests within a single Node process.
type FallbackEntry = { count: number; resetAt: number }
const fallbackStore = new Map<string, FallbackEntry>()

// Periodic cleanup of stale fallback entries; cheap because the Map only
// grows when Redis is unavailable.
const FALLBACK_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null
if (typeof setInterval !== 'undefined' && cleanupTimer === null) {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of fallbackStore.entries()) {
      if (entry.resetAt < now) fallbackStore.delete(key)
    }
  }, FALLBACK_CLEANUP_INTERVAL_MS)
  if (cleanupTimer.unref) cleanupTimer.unref()
}

const isRedisEnabled = (): boolean => {
  // Honour an explicit opt-out for tests / debugging without unsetting REDIS_URL.
  if (process.env.RATE_LIMIT_BACKEND === 'memory') return false
  if (process.env.RATE_LIMIT_BACKEND === 'redis') return true
  return Boolean(process.env.REDIS_URL)
}

/**
 * Fixed-window check against the in-memory fallback map. Same semantics as
 * the legacy `checkRateLimit` in `lib/webhooks/security.ts`.
 */
const checkInMemory = (identifier: string, limit: number, windowMs: number): RateLimitResult => {
  const now = Date.now()
  const key = `${KEY_PREFIX}${identifier}`
  const current = fallbackStore.get(key)

  if (!current || current.resetAt < now) {
    const resetAt = now + windowMs
    fallbackStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count++
  fallbackStore.set(key, current)
  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: current.resetAt,
  }
}

/**
 * Fixed-window check against Redis. Atomicity is provided by the
 * `INCR` + `EXPIRE NX` pipeline — `EXPIRE NX` (added in Redis 7) only sets
 * the TTL on the first INCR of a new window. We use a `MULTI/EXEC` pipeline
 * to keep both ops on the same round-trip.
 *
 * TODO(precise-sliding-window): replace with a Lua script using either two
 * adjacent fixed buckets (interpolated by elapsed fraction) or a sorted-set
 * of timestamps trimmed by score, for true sliding behaviour.
 */
const checkRedis = async (
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> => {
  const client = getRedisClient()
  if (!client) return null

  const key = `${KEY_PREFIX}${identifier}`
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000))

  try {
    // Pipeline: INCR, then EXPIRE NX so we only stamp TTL on the first hit
    // of a new window. PTTL returns ms remaining for an accurate resetAt.
    const multi = client.multi()
    multi.incr(key)
    // ioredis surfaces EXPIRE NX as a 4th positional arg; older Redis (< 7)
    // ignores it, so we fall back to a separate set on first INCR below.
    multi.expire(key, ttlSeconds, 'NX')
    multi.pttl(key)

    const results = await multi.exec()

    if (!results) {
      logger.warn('Redis multi/exec returned null for rate-limit check', { identifier })
      return null
    }

    // results: [[err, count], [err, expireResult], [err, pttlMs]]
    const countErr = results[0]?.[0]
    const count = results[0]?.[1] as number | undefined
    const pttlMs = results[2]?.[1] as number | undefined

    if (countErr || typeof count !== 'number') {
      logger.warn('Redis INCR did not return a number', { identifier, countErr })
      return null
    }

    // If EXPIRE NX wasn't honoured (Redis < 7) and the key is fresh (count===1),
    // ensure a TTL is set so we don't leak counters forever.
    if (count === 1 && (typeof pttlMs !== 'number' || pttlMs < 0)) {
      await client.pexpire(key, windowMs)
    }

    const now = Date.now()
    const remainingMs = typeof pttlMs === 'number' && pttlMs > 0 ? pttlMs : windowMs
    const resetAt = now + remainingMs

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt }
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  } catch (error) {
    logger.error('Redis rate-limit check failed', { identifier, error })
    return null
  }
}

/**
 * Check whether `identifier` has remaining quota for the given window.
 *
 * Tries Redis first when `REDIS_URL` is set, falling back to the in-memory
 * map on any error or when the client is unavailable. Same return shape as
 * the legacy `checkRateLimit` in `lib/webhooks/security.ts`.
 */
export const checkRateLimit = async (
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): Promise<RateLimitCheckResult> => {
  if (isRedisEnabled()) {
    const redisResult = await checkRedis(identifier, limit, windowMs)
    if (redisResult) {
      return { ...redisResult, backend: 'redis' }
    }
    // fall through to in-memory on null (client unavailable / error)
  }

  return { ...checkInMemory(identifier, limit, windowMs), backend: 'memory' }
}

/**
 * Synchronous in-memory variant for callers that cannot await (legacy code
 * paths in `webhooks/security.ts`). Always uses the fallback map.
 */
export const checkRateLimitSync = (
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitCheckResult => {
  return { ...checkInMemory(identifier, limit, windowMs), backend: 'memory' }
}

/**
 * Object-style accessor for symmetry with future stores (e.g. Upstash).
 */
export const redisRateLimit = {
  checkRateLimit,
  checkRateLimitSync,
}

/**
 * Test-only: reset the in-memory fallback map. Not exported through the
 * package barrel; tests import this directly.
 */
export const __resetFallbackStoreForTests = (): void => {
  fallbackStore.clear()
}

export class RedisRateLimitStore {
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number = 60_000
  ): Promise<RateLimitCheckResult> {
    return checkRateLimit(identifier, limit, windowMs)
  }

  checkRateLimitSync(
    identifier: string,
    limit: number,
    windowMs: number = 60_000
  ): RateLimitCheckResult {
    return checkRateLimitSync(identifier, limit, windowMs)
  }
}
