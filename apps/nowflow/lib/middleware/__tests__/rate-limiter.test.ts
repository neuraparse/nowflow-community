import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyRateLimits,
  checkIPAccess,
  checkQuota,
  checkRateLimit,
  getClientIP,
} from '@/lib/middleware/rate-limiter'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {},
  NextResponse: { json: vi.fn() },
}))

// Build a fake NextRequest-like object.
const fakeRequest = (headers: Record<string, string> = {}) =>
  ({
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null,
    },
  }) as any

// Unique identifier per test since the in-memory store is module-global.
let counter = 0
const uniq = (label: string) => `${label}-${Date.now()}-${counter++}`

describe('lib/middleware/rate-limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkIPAccess', () => {
    it('allows access when no lists are provided', () => {
      expect(checkIPAccess('1.2.3.4')).toEqual({ allowed: true })
    })

    it('blocks blacklisted IPs first', () => {
      const result = checkIPAccess('1.2.3.4', ['1.2.3.4'], ['1.2.3.4'])
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/blacklisted/i)
    })

    it('allows wildcard * pattern in whitelist', () => {
      expect(checkIPAccess('9.9.9.9', ['*'])).toEqual({ allowed: true })
    })

    it('rejects an IP not in whitelist', () => {
      const result = checkIPAccess('9.9.9.9', ['1.2.3.4'])
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/not whitelisted/i)
    })

    it('allows a whitelisted IP', () => {
      expect(checkIPAccess('1.2.3.4', ['1.2.3.4'])).toEqual({ allowed: true })
    })
  })

  describe('getClientIP', () => {
    it('prefers x-forwarded-for (first element)', () => {
      const req = fakeRequest({
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        'x-real-ip': '10.0.0.9',
      })
      expect(getClientIP(req)).toBe('10.0.0.1')
    })

    it('falls back to x-real-ip', () => {
      const req = fakeRequest({ 'x-real-ip': '10.0.0.9' })
      expect(getClientIP(req)).toBe('10.0.0.9')
    })

    it('returns "unknown" when headers are absent', () => {
      expect(getClientIP(fakeRequest())).toBe('unknown')
    })
  })

  describe('checkRateLimit', () => {
    it('is a no-op when disabled', () => {
      expect(checkRateLimit(uniq('a'), { enabled: false })).toEqual({ allowed: true })
    })

    it('allows when no limits are configured', () => {
      expect(checkRateLimit(uniq('b'), { enabled: true })).toEqual({ allowed: true })
    })

    it('tracks per-minute limits and blocks when exceeded', () => {
      const id = uniq('per-min')
      const config = { enabled: true, requestsPerMinute: 2 }

      const r1 = checkRateLimit(id, config)
      expect(r1).toMatchObject({ allowed: true, limit: 2, remaining: 1 })

      const r2 = checkRateLimit(id, config)
      expect(r2).toMatchObject({ allowed: true, limit: 2, remaining: 0 })

      const r3 = checkRateLimit(id, config)
      expect(r3.allowed).toBe(false)
      expect(r3.retryAfter).toBeGreaterThan(0)
    })

    it('honours requestsPerHour when requestsPerMinute absent', () => {
      const id = uniq('per-hr')
      const config = { enabled: true, requestsPerHour: 1 }

      expect(checkRateLimit(id, config).allowed).toBe(true)
      expect(checkRateLimit(id, config).allowed).toBe(false)
    })

    it('honours requestsPerDay when other windows absent', () => {
      const id = uniq('per-day')
      const config = { enabled: true, requestsPerDay: 1 }

      expect(checkRateLimit(id, config).allowed).toBe(true)
      expect(checkRateLimit(id, config).allowed).toBe(false)
    })

    it('resets count after the window expires', () => {
      const id = uniq('reset')
      const config = { enabled: true, requestsPerMinute: 1 }

      expect(checkRateLimit(id, config).allowed).toBe(true)
      expect(checkRateLimit(id, config).allowed).toBe(false)

      vi.advanceTimersByTime(61 * 1000)

      expect(checkRateLimit(id, config).allowed).toBe(true)
    })
  })

  describe('checkQuota', () => {
    it('is a no-op when disabled', () => {
      expect(checkQuota(uniq('q'), { enabled: false })).toEqual({ allowed: true })
    })

    it('allows when no quotas are configured', () => {
      expect(checkQuota(uniq('q2'), { enabled: true })).toEqual({ allowed: true })
    })

    it('tracks perUserDailyLimit and blocks when reached', () => {
      const id = uniq('day')
      const config = { enabled: true, perUserDailyLimit: 2 }

      expect(checkQuota(id, config)).toMatchObject({
        allowed: true,
        limit: 2,
        used: 1,
        remaining: 1,
      })
      expect(checkQuota(id, config)).toMatchObject({
        allowed: true,
        limit: 2,
        used: 2,
        remaining: 0,
      })
      const blocked = checkQuota(id, config)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })

    it('honours monthlyMessageLimit when perUserDailyLimit not set', () => {
      const id = uniq('mth')
      const config = { enabled: true, monthlyMessageLimit: 1 }
      expect(checkQuota(id, config).allowed).toBe(true)
      expect(checkQuota(id, config).allowed).toBe(false)
    })
  })

  describe('applyRateLimits', () => {
    it('denies when IP is blacklisted', () => {
      const req = fakeRequest({ 'x-forwarded-for': '1.1.1.1' })
      const result = applyRateLimits(req, { ipBlacklist: ['1.1.1.1'] })
      expect(result.allowed).toBe(false)
      expect(result.error).toMatch(/blacklisted/i)
    })

    it('allows request with no limits configured', () => {
      const req = fakeRequest({ 'x-forwarded-for': '1.1.1.1' })
      const result = applyRateLimits(req, {})
      expect(result.allowed).toBe(true)
    })

    it('emits rate-limit headers when limit is configured and not exceeded', () => {
      const id = uniq('ip')
      const req = fakeRequest({ 'x-forwarded-for': id })
      const result = applyRateLimits(req, {
        rateLimit: { enabled: true, requestsPerMinute: 5 },
      })
      expect(result.allowed).toBe(true)
      expect(result.headers?.['X-RateLimit-Limit']).toBe('5')
      expect(result.headers?.['X-RateLimit-Remaining']).toBe('4')
    })

    it('emits Retry-After when rate limit is exceeded', () => {
      const id = uniq('ip2')
      const req = fakeRequest({ 'x-forwarded-for': id })
      applyRateLimits(req, { rateLimit: { enabled: true, requestsPerMinute: 1 } })
      const blocked = applyRateLimits(req, {
        rateLimit: { enabled: true, requestsPerMinute: 1 },
      })
      expect(blocked.allowed).toBe(false)
      expect(blocked.headers?.['Retry-After']).toBeDefined()
    })

    it('emits quota headers when quotas pass', () => {
      const token = uniq('tok')
      const req = fakeRequest({
        'x-forwarded-for': '2.2.2.2',
        'x-session-token': token,
      })
      const result = applyRateLimits(req, {
        quotas: { enabled: true, perUserDailyLimit: 10 },
      })
      expect(result.allowed).toBe(true)
      expect(result.headers?.['X-Quota-Limit']).toBe('10')
      expect(result.headers?.['X-Quota-Remaining']).toBe('9')
    })

    it('emits quota-exceeded response when quotas are exhausted', () => {
      const token = uniq('tok2')
      const req = fakeRequest({
        'x-forwarded-for': '3.3.3.3',
        'x-session-token': token,
      })
      // Consume the single-unit daily quota
      applyRateLimits(req, { quotas: { enabled: true, perUserDailyLimit: 1 } })
      const blocked = applyRateLimits(req, {
        quotas: { enabled: true, perUserDailyLimit: 1 },
      })
      expect(blocked.allowed).toBe(false)
      expect(blocked.error).toMatch(/quota/i)
      expect(blocked.headers?.['X-Quota-Remaining']).toBe('0')
    })
  })
})
