import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __evictIfOverCapForTests,
  __inMemoryCacheForTests,
  hasProcessedMessage,
  markMessageAsProcessed,
} from '@/lib/redis'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Force the in-memory fallback path: no Redis client.
vi.mock('ioredis', () => {
  return {
    default: class FakeRedis {
      on() {}
      async exists() {
        throw new Error('forced fallback')
      }
      async set() {
        throw new Error('forced fallback')
      }
      async get() {
        return null
      }
      async del() {}
      async quit() {}
    },
  }
})

describe('redis in-memory fallback cache', () => {
  beforeEach(() => {
    __inMemoryCacheForTests.clear()
  })

  afterEach(() => {
    __inMemoryCacheForTests.clear()
  })

  it('LRU eviction trims to MAX_CACHE_SIZE (1000) when overflowed', () => {
    // Seed with > 1000 entries: oldest accessed first.
    for (let i = 0; i < 1100; i++) {
      __inMemoryCacheForTests.set(`k${i}`, {
        value: '1',
        expiry: null,
        lastAccessed: i, // strictly increasing
      })
    }
    expect(__inMemoryCacheForTests.size).toBe(1100)
    __evictIfOverCapForTests()
    expect(__inMemoryCacheForTests.size).toBe(1000)
    // Oldest 100 (k0..k99) should be evicted; k1099 should remain.
    expect(__inMemoryCacheForTests.has('k0')).toBe(false)
    expect(__inMemoryCacheForTests.has('k99')).toBe(false)
    expect(__inMemoryCacheForTests.has('k100')).toBe(true)
    expect(__inMemoryCacheForTests.has('k1099')).toBe(true)
  })

  it('expired entries are dropped on cap-driven sweep', () => {
    const now = Date.now()
    for (let i = 0; i < 1050; i++) {
      __inMemoryCacheForTests.set(`exp${i}`, {
        value: '1',
        expiry: now - 1000, // already expired
        lastAccessed: i,
      })
    }
    __evictIfOverCapForTests()
    // All expired entries should have been removed first.
    expect(__inMemoryCacheForTests.size).toBe(0)
  })

  it('markMessageAsProcessed + hasProcessedMessage round-trip via fallback', async () => {
    await markMessageAsProcessed('abc', 60)
    const present = await hasProcessedMessage('abc')
    expect(present).toBe(true)
  })
})
