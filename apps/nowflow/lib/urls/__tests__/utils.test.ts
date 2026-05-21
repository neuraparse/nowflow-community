/**
 * Unit tests for URL helpers
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}))

vi.mock('@/lib/environment', () => ({
  isProd: false,
  isDev: true,
  isTest: false,
  isHosted: false,
  getCostMultiplier: () => 1,
}))

vi.mock('@/lib/config/app-urls', () => ({
  APP_HOSTNAME: 'example.com',
}))

describe('URL utils', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Clear relevant env vars
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.NEXTAUTH_URL
    delete (process.env as any).NODE_ENV
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...originalEnv }
    // Ensure no lingering window
    delete (globalThis as any).window
    vi.restoreAllMocks()
  })

  describe('getBaseUrl', () => {
    it('returns window.location.origin when in browser context', async () => {
      // Simulate a browser environment
      ;(globalThis as any).window = {
        location: { origin: 'https://browser.example.com' },
      }

      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://browser.example.com')
    })

    it('returns NEXT_PUBLIC_APP_URL when set with https prefix', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://example.com')
    })

    it('returns NEXT_PUBLIC_APP_URL when set with http prefix', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://example.com'
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('http://example.com')
    })

    it('prepends http:// in non-prod when URL lacks scheme', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'dev.example.com'
      vi.stubEnv('NODE_ENV', 'development')
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('http://dev.example.com')
    })

    it('prepends https:// in prod when URL lacks scheme', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'prod.example.com'
      vi.stubEnv('NODE_ENV', 'production')
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://prod.example.com')
    })

    it('falls back to BETTER_AUTH_URL when NEXT_PUBLIC_APP_URL is not set', async () => {
      process.env.BETTER_AUTH_URL = 'https://auth.example.com'
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://auth.example.com')
    })

    it('falls back to NEXTAUTH_URL when others are not set', async () => {
      process.env.NEXTAUTH_URL = 'https://nextauth.example.com'
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://nextauth.example.com')
    })

    it('returns localhost fallback when no env vars set', async () => {
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('http://localhost:3000')
    })

    it('prefers NEXT_PUBLIC_APP_URL over BETTER_AUTH_URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://primary.com'
      process.env.BETTER_AUTH_URL = 'https://secondary.com'
      const { getBaseUrl } = await import('../utils')
      expect(getBaseUrl()).toBe('https://primary.com')
    })
  })

  describe('getBaseDomain', () => {
    it('returns host with port for localhost', async () => {
      const { getBaseDomain } = await import('../utils')
      expect(getBaseDomain()).toBe('localhost:3000')
    })

    it('returns host only for production-style URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const { getBaseDomain } = await import('../utils')
      expect(getBaseDomain()).toBe('example.com')
    })

    it('returns host with non-standard port', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com:8080'
      const { getBaseDomain } = await import('../utils')
      expect(getBaseDomain()).toBe('example.com:8080')
    })

    it('returns browser host in browser context', async () => {
      ;(globalThis as any).window = {
        location: { origin: 'https://browser.example.com:4000' },
      }
      const { getBaseDomain } = await import('../utils')
      expect(getBaseDomain()).toBe('browser.example.com:4000')
    })
  })
})
