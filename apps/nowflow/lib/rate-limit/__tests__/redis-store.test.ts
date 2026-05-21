import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetFallbackStoreForTests,
  checkRateLimit,
  checkRateLimitSync,
  RedisRateLimitStore,
} from '@/lib/rate-limit/redis-store'
import { getRedisClient } from '@/lib/redis'

// Mock @/lib/redis BEFORE importing the module under test so the spy is
// attached when redis-store first resolves the import.
vi.mock('@/lib/redis', () => {
  return {
    getRedisClient: vi.fn(() => null),
  }
})

const mockedGetRedisClient = vi.mocked(getRedisClient)

type MultiResult = Array<[Error | null, unknown]>

const buildFakeRedis = (opts: {
  // INCR sequence returned by successive calls
  counts: number[]
  // PTTL returned by successive calls
  pttls?: number[]
  multiThrows?: boolean
  multiReturnsNull?: boolean
}) => {
  let incrCallIdx = 0
  let pttlCallIdx = 0

  const multi = () => {
    const ops: Array<() => MultiResult[number]> = []
    const chain = {
      incr(_key: string) {
        ops.push(() => {
          const v = opts.counts[incrCallIdx++]
          return [null, v]
        })
        return chain
      },
      expire(_key: string, _seconds: number, _flag?: string) {
        ops.push(() => [null, 1])
        return chain
      },
      pttl(_key: string) {
        ops.push(() => {
          const v = opts.pttls?.[pttlCallIdx++] ?? 30_000
          return [null, v]
        })
        return chain
      },
      async exec() {
        if (opts.multiThrows) throw new Error('boom')
        if (opts.multiReturnsNull) return null
        return ops.map((fn) => fn())
      },
    }
    return chain
  }

  return {
    multi,
    pexpire: vi.fn().mockResolvedValue(1),
  }
}

beforeEach(() => {
  __resetFallbackStoreForTests()
  vi.clearAllMocks()
  mockedGetRedisClient.mockReturnValue(null)
  delete process.env.REDIS_URL
  delete process.env.RATE_LIMIT_BACKEND
})

afterEach(() => {
  delete process.env.REDIS_URL
  delete process.env.RATE_LIMIT_BACKEND
})

describe('redis-store: in-memory fallback (no REDIS_URL)', () => {
  it('allows up to limit then denies', async () => {
    const id = 'fallback-deny'
    const r1 = await checkRateLimit(id, 3, 60_000)
    const r2 = await checkRateLimit(id, 3, 60_000)
    const r3 = await checkRateLimit(id, 3, 60_000)
    const r4 = await checkRateLimit(id, 3, 60_000)

    expect(r1).toMatchObject({ allowed: true, remaining: 2, backend: 'memory' })
    expect(r2).toMatchObject({ allowed: true, remaining: 1, backend: 'memory' })
    expect(r3).toMatchObject({ allowed: true, remaining: 0, backend: 'memory' })
    expect(r4).toMatchObject({ allowed: false, remaining: 0, backend: 'memory' })
  })

  it('resets the window once resetAt has elapsed', async () => {
    const id = 'fallback-expire'
    const realNow = Date.now
    let now = 1_000_000

    vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      const r1 = await checkRateLimit(id, 1, 1_000)
      expect(r1).toMatchObject({ allowed: true, remaining: 0 })

      const r2 = await checkRateLimit(id, 1, 1_000)
      expect(r2).toMatchObject({ allowed: false, remaining: 0 })

      now += 1_500
      const r3 = await checkRateLimit(id, 1, 1_000)
      expect(r3).toMatchObject({ allowed: true, remaining: 0 })
    } finally {
      vi.spyOn(Date, 'now').mockImplementation(realNow)
    }
  })

  it('checkRateLimitSync uses the in-memory store regardless of env', () => {
    process.env.REDIS_URL = 'redis://example:6379'
    const r = checkRateLimitSync('sync-id', 2, 1_000)
    expect(r.backend).toBe('memory')
    expect(r.allowed).toBe(true)
  })

  it('does not consult Redis when RATE_LIMIT_BACKEND=memory', async () => {
    process.env.REDIS_URL = 'redis://example:6379'
    process.env.RATE_LIMIT_BACKEND = 'memory'
    const fake = buildFakeRedis({ counts: [1] })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r = await checkRateLimit('opt-out', 5, 60_000)
    expect(r.backend).toBe('memory')
    expect(mockedGetRedisClient).not.toHaveBeenCalled()
  })
})

describe('redis-store: Redis path', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://example:6379'
  })

  it('returns allowed=true while count <= limit', async () => {
    const fake = buildFakeRedis({ counts: [1, 2, 3], pttls: [60_000, 50_000, 40_000] })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r1 = await checkRateLimit('redis-allow', 3, 60_000)
    const r2 = await checkRateLimit('redis-allow', 3, 60_000)
    const r3 = await checkRateLimit('redis-allow', 3, 60_000)

    expect(r1).toMatchObject({ allowed: true, remaining: 2, backend: 'redis' })
    expect(r2).toMatchObject({ allowed: true, remaining: 1, backend: 'redis' })
    expect(r3).toMatchObject({ allowed: true, remaining: 0, backend: 'redis' })
  })

  it('returns allowed=false once count exceeds limit', async () => {
    const fake = buildFakeRedis({ counts: [4], pttls: [30_000] })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r = await checkRateLimit('redis-deny', 3, 60_000)
    expect(r).toMatchObject({ allowed: false, remaining: 0, backend: 'redis' })
    expect(r.resetAt).toBeGreaterThan(Date.now())
  })

  it('resetAt is derived from PTTL', async () => {
    const fake = buildFakeRedis({ counts: [1], pttls: [12_345] })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const before = Date.now()
    const r = await checkRateLimit('redis-pttl', 5, 60_000)
    const after = Date.now()

    expect(r.backend).toBe('redis')
    // resetAt = now + pttl, so should be in [before+12345, after+12345]
    expect(r.resetAt).toBeGreaterThanOrEqual(before + 12_345)
    expect(r.resetAt).toBeLessThanOrEqual(after + 12_345)
  })

  it('falls back to in-memory when Redis multi/exec returns null', async () => {
    const fake = buildFakeRedis({ counts: [], multiReturnsNull: true })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r = await checkRateLimit('redis-null', 2, 60_000)
    expect(r.backend).toBe('memory')
    expect(r.allowed).toBe(true)
  })

  it('falls back to in-memory when Redis throws', async () => {
    const fake = buildFakeRedis({ counts: [], multiThrows: true })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r = await checkRateLimit('redis-throw', 2, 60_000)
    expect(r.backend).toBe('memory')
    expect(r.allowed).toBe(true)
  })

  it('falls back to in-memory when getRedisClient returns null', async () => {
    mockedGetRedisClient.mockReturnValue(null)
    const r = await checkRateLimit('redis-no-client', 2, 60_000)
    expect(r.backend).toBe('memory')
    expect(r.allowed).toBe(true)
  })

  it('sets pexpire as a safety net when PTTL is -1 (no TTL stamped)', async () => {
    const fake = buildFakeRedis({ counts: [1], pttls: [-1] })
    mockedGetRedisClient.mockReturnValue(fake as never)

    const r = await checkRateLimit('redis-no-ttl', 5, 30_000)
    expect(r.backend).toBe('redis')
    expect(fake.pexpire).toHaveBeenCalledWith(expect.stringContaining('redis-no-ttl'), 30_000)
  })
})

describe('RedisRateLimitStore class wrapper', () => {
  it('delegates to the module-level functions', async () => {
    const store = new RedisRateLimitStore()
    const r = await store.checkRateLimit('class-id', 2, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.backend).toBe('memory')
    expect(store.checkRateLimitSync('class-id-2', 1, 1_000).allowed).toBe(true)
  })
})
