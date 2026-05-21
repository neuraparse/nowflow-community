import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'
import {
  calculateHealthStatus,
  checkRateLimit,
  cleanupRateLimitStore,
  generateWebhookSecret,
  getClientIp,
  isIpAllowed,
  isTimestampValid,
  sanitizePayload,
  verifyWebhookSignature,
  verifyWebhookSignatureWithPrefix,
} from '../security'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('next/server', () => ({ NextRequest: class {} }))

function signPayload(payload: string, secret: string, algo: 'sha256' | 'sha1' = 'sha256') {
  return crypto.createHmac(algo, secret).update(payload).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('returns true for matching signature', async () => {
    const payload = '{"ok":true}'
    const secret = 'topsecret'
    const sig = signPayload(payload, secret)
    expect(await verifyWebhookSignature(payload, sig, secret)).toBe(true)
  })

  it('returns false for mismatched signature', async () => {
    const payload = '{"ok":true}'
    const secret = 'topsecret'
    const sig = signPayload(payload, secret)
    expect(await verifyWebhookSignature('{"ok":false}', sig, secret)).toBe(false)
  })

  it('returns false for bad length signature', async () => {
    expect(await verifyWebhookSignature('x', 'abc', 'k')).toBe(false)
  })

  it('supports sha1 algorithm', async () => {
    const payload = 'hi'
    const secret = 's'
    const sig = signPayload(payload, secret, 'sha1')
    expect(await verifyWebhookSignature(payload, sig, secret, 'sha1')).toBe(true)
  })
})

describe('verifyWebhookSignatureWithPrefix', () => {
  it('returns false when prefix missing', async () => {
    expect(await verifyWebhookSignatureWithPrefix('p', 'abc', 'k')).toBe(false)
  })

  it('verifies correctly when prefix matches', async () => {
    const payload = 'hello'
    const secret = 'key'
    const sig = signPayload(payload, secret)
    const header = `sha256=${sig}`
    expect(await verifyWebhookSignatureWithPrefix(payload, header, secret)).toBe(true)
  })

  it('returns false for wrong signature with prefix', async () => {
    const header = 'sha256=' + '0'.repeat(64)
    expect(await verifyWebhookSignatureWithPrefix('hello', header, 'key')).toBe(false)
  })
})

describe('isIpAllowed', () => {
  it('allows when list is empty', () => {
    expect(isIpAllowed('1.2.3.4', [])).toBe(true)
  })

  it('allows wildcard "*"', () => {
    expect(isIpAllowed('9.9.9.9', ['*'])).toBe(true)
  })

  it('matches exact IP', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4'])).toBe(true)
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false)
  })

  it('matches wildcard patterns', () => {
    expect(isIpAllowed('192.168.1.5', ['192.168.*.*'])).toBe(true)
    expect(isIpAllowed('10.0.0.1', ['192.168.*.*'])).toBe(false)
  })

  it('matches CIDR on byte boundaries', () => {
    expect(isIpAllowed('10.1.2.3', ['10.1.0.0/16'])).toBe(true)
    expect(isIpAllowed('10.2.0.1', ['10.1.0.0/16'])).toBe(false)
  })

  it('returns false when no match', () => {
    expect(isIpAllowed('5.5.5.5', ['1.2.3.4', '6.6.6.6'])).toBe(false)
  })
})

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>) {
    return { headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } } as any
  }

  it('returns first x-forwarded-for entry', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
    expect(getClientIp(req)).toBe('1.1.1.1')
  })

  it('falls back to x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '3.3.3.3' })
    expect(getClientIp(req)).toBe('3.3.3.3')
  })

  it('falls back to cf-connecting-ip', () => {
    const req = makeRequest({ 'cf-connecting-ip': '4.4.4.4' })
    expect(getClientIp(req)).toBe('4.4.4.4')
  })

  it('returns "unknown" when no headers set', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    cleanupRateLimitStore()
  })

  it('allows up to the limit in a window', () => {
    const id = `user-${Math.random()}`
    const a = checkRateLimit(id, 3, 60000)
    const b = checkRateLimit(id, 3, 60000)
    const c = checkRateLimit(id, 3, 60000)
    const d = checkRateLimit(id, 3, 60000)
    expect(a.allowed).toBe(true)
    expect(a.remaining).toBe(2)
    expect(b.remaining).toBe(1)
    expect(c.remaining).toBe(0)
    expect(d.allowed).toBe(false)
  })

  it('resets count after window elapses', () => {
    const id = `user-${Math.random()}`
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(1_000_000))
      const a = checkRateLimit(id, 1, 1000)
      const b = checkRateLimit(id, 1, 1000)
      expect(a.allowed).toBe(true)
      expect(b.allowed).toBe(false)
      vi.setSystemTime(new Date(1_000_000 + 2000))
      const c = checkRateLimit(id, 1, 1000)
      expect(c.allowed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('cleanupRateLimitStore', () => {
  it('removes entries with expired resetAt', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(10_000))
      const id = `exp-${Math.random()}`
      checkRateLimit(id, 5, 1000)
      vi.setSystemTime(new Date(20_000))
      cleanupRateLimitStore()
      // Next call begins a new window
      const next = checkRateLimit(id, 5, 1000)
      expect(next.remaining).toBe(4)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('generateWebhookSecret', () => {
  it('produces a hex string of 64 chars (32 bytes)', () => {
    const s = generateWebhookSecret()
    expect(s).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces unique values each call', () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret())
  })
})

describe('isTimestampValid', () => {
  it('accepts recent timestamps', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isTimestampValid(now)).toBe(true)
  })

  it('rejects old timestamps beyond maxAge', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600
    expect(isTimestampValid(tenMinutesAgo, 300)).toBe(false)
  })

  it('accepts timestamp as string', () => {
    const now = String(Math.floor(Date.now() / 1000))
    expect(isTimestampValid(now)).toBe(true)
  })
})

describe('sanitizePayload', () => {
  it('redacts keys containing sensitive substrings', () => {
    const result = sanitizePayload({ password: 'x', token: 'y', safe: 1 })
    expect(result.password).toBe('***REDACTED***')
    expect(result.token).toBe('***REDACTED***')
    expect(result.safe).toBe(1)
  })

  it('matches case-insensitively', () => {
    const result = sanitizePayload({ API_KEY: 'x', Authorization: 'y' })
    expect(result.API_KEY).toBe('***REDACTED***')
    expect(result.Authorization).toBe('***REDACTED***')
  })

  it('recurses into nested objects', () => {
    const result = sanitizePayload({ outer: { secret: 'x', ok: 2 } })
    expect(result.outer.secret).toBe('***REDACTED***')
    expect(result.outer.ok).toBe(2)
  })

  it('returns primitives unchanged', () => {
    expect(sanitizePayload(null)).toBe(null)
    expect(sanitizePayload('x')).toBe('x')
    expect(sanitizePayload(5)).toBe(5)
  })
})

describe('calculateHealthStatus', () => {
  it('returns inactive when never triggered', () => {
    expect(calculateHealthStatus(0, 0, 0, null)).toBe('inactive')
  })

  it('returns inactive when last trigger is stale', () => {
    const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    expect(calculateHealthStatus(5, 5, 0, stale)).toBe('inactive')
  })

  it('returns healthy when success rate >= 0.95', () => {
    expect(calculateHealthStatus(100, 96, 4, new Date())).toBe('healthy')
  })

  it('returns warning when success rate in [0.8, 0.95)', () => {
    expect(calculateHealthStatus(100, 85, 15, new Date())).toBe('warning')
  })

  it('returns error when success rate < 0.8', () => {
    expect(calculateHealthStatus(100, 50, 50, new Date())).toBe('error')
  })

  it('returns inactive when totalTriggers is 0 even with recent trigger', () => {
    expect(calculateHealthStatus(0, 0, 0, new Date())).toBe('inactive')
  })
})
