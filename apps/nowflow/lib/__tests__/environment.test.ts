import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// environment.ts evaluates process.env at module-load time into module-level
// constants, so we must reset modules between configurations and re-import to
// observe different values.
describe('lib/environment', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('isProd / isDev / isTest', () => {
    it('reports production when NODE_ENV is "production"', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const env = await import('../environment')
      expect(env.isProd).toBe(true)
      expect(env.isDev).toBe(false)
      expect(env.isTest).toBe(false)
    })

    it('reports development when NODE_ENV is "development"', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const env = await import('../environment')
      expect(env.isProd).toBe(false)
      expect(env.isDev).toBe(true)
      expect(env.isTest).toBe(false)
    })

    it('reports test when NODE_ENV is "test"', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const env = await import('../environment')
      expect(env.isProd).toBe(false)
      expect(env.isDev).toBe(false)
      expect(env.isTest).toBe(true)
    })

    it('is false for all three flags when NODE_ENV is unknown', async () => {
      vi.stubEnv('NODE_ENV', 'staging')
      const env = await import('../environment')
      expect(env.isProd).toBe(false)
      expect(env.isDev).toBe(false)
      expect(env.isTest).toBe(false)
    })
  })

  describe('isHosted', () => {
    it('is true when NEXT_PUBLIC_IS_HOSTED === "true"', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', 'true')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
      const env = await import('../environment')
      expect(env.isHosted).toBe(true)
    })

    it('is true when APP_URL matches http://localhost:3000', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', 'false')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
      const env = await import('../environment')
      expect(env.isHosted).toBe(true)
    })

    it('is true when APP_URL matches http://localhost:3000', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', '')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
      const env = await import('../environment')
      expect(env.isHosted).toBe(true)
    })

    it('is true when APP_URL matches http://localhost:3000', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', '')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
      const env = await import('../environment')
      expect(env.isHosted).toBe(true)
    })

    it('is true when APP_URL matches http://localhost:3000', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', '')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
      const env = await import('../environment')
      expect(env.isHosted).toBe(true)
    })

    it('is false for a self-hosted URL with the flag off', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', 'false')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://my-self-host.example.com')
      const env = await import('../environment')
      expect(env.isHosted).toBe(false)
    })

    it('is false when both the flag and URL are unset', async () => {
      vi.stubEnv('NEXT_PUBLIC_IS_HOSTED', '')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
      const env = await import('../environment')
      expect(env.isHosted).toBe(false)
    })
  })

  describe('getCostMultiplier', () => {
    it('returns 1 in development regardless of COST_MULTIPLIER', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('COST_MULTIPLIER', '3.5')
      const env = await import('../environment')
      expect(env.getCostMultiplier()).toBe(1)
    })

    it('returns 1 in test regardless of COST_MULTIPLIER', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      vi.stubEnv('COST_MULTIPLIER', '2')
      const env = await import('../environment')
      expect(env.getCostMultiplier()).toBe(1)
    })

    it('returns parsed COST_MULTIPLIER in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('COST_MULTIPLIER', '2.5')
      const env = await import('../environment')
      expect(env.getCostMultiplier()).toBe(2.5)
    })

    it('falls back to 1 in production when COST_MULTIPLIER is not a number', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('COST_MULTIPLIER', 'not-a-number')
      const env = await import('../environment')
      expect(env.getCostMultiplier()).toBe(1)
    })

    it('falls back to 1 in production when COST_MULTIPLIER parses to 0', async () => {
      // parseFloat('0') is 0 which is falsy, so the `|| 1` fallback kicks in.
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('COST_MULTIPLIER', '0')
      const env = await import('../environment')
      expect(env.getCostMultiplier()).toBe(1)
    })
  })
})
