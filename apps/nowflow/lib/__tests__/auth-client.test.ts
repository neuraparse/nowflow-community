import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@better-auth/stripe/client', () => ({
  stripeClient: vi.fn(() => ({ id: 'stripe-plugin' })),
}))

vi.mock('better-auth/client/plugins', () => ({
  emailOTPClient: vi.fn(() => ({ id: 'email-otp' })),
  genericOAuthClient: vi.fn(() => ({ id: 'oauth' })),
  organizationClient: vi.fn(() => ({ id: 'org' })),
}))

vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn((opts: any) => ({
    __opts: opts,
    useSession: vi.fn(),
    useActiveOrganization: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    subscription: {
      list: vi.fn(async () => ({ data: ['real'] })),
      upgrade: vi.fn(async () => ({ data: 'upgraded' })),
      cancel: vi.fn(async () => ({ data: 'canceled' })),
      restore: vi.fn(async () => ({ data: 'restored' })),
    },
  })),
}))

describe('lib/auth-client', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Start from a clean env each test
    delete process.env.VERCEL_ENV
    delete process.env.NEXT_PUBLIC_VERCEL_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...ORIGINAL_ENV }
    // Tear down any window stub
    if ('window' in globalThis) {
      delete (globalThis as any).window
    }
  })

  describe('getBaseURL', () => {
    it('returns window.location.origin when running in a browser', async () => {
      ;(globalThis as any).window = { location: { origin: 'https://browser.example' } }

      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('https://browser.example')
    })

    it('returns Vercel preview URL when VERCEL_ENV=preview', async () => {
      process.env.VERCEL_ENV = 'preview'
      process.env.NEXT_PUBLIC_VERCEL_URL = 'preview.vercel.app'

      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('https://preview.vercel.app')
    })

    it('returns Vercel development URL when VERCEL_ENV=development', async () => {
      process.env.VERCEL_ENV = 'development'
      process.env.NEXT_PUBLIC_VERCEL_URL = 'dev.vercel.app'

      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('https://dev.vercel.app')
    })

    it('prefers BETTER_AUTH_URL on server in production', async () => {
      process.env.BETTER_AUTH_URL = 'https://auth.example.com'
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('https://auth.example.com')
    })

    it('falls back to NEXT_PUBLIC_APP_URL when BETTER_AUTH_URL missing', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'

      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('https://app.example.com')
    })

    it('falls back to localhost:3000 when nothing is set', async () => {
      const mod = await import('@/lib/auth-client')
      expect(mod.getBaseURL()).toBe('http://localhost:3000')
    })
  })

  describe('useSubscription', () => {
    it('returns mocked methods in non-prod mode', async () => {
      vi.stubEnv('NODE_ENV', 'development')

      const mod = await import('@/lib/auth-client')
      const sub = mod.useSubscription()

      const list = await sub.list!({} as any)
      expect(list).toEqual({ data: [] })

      const upgrade = await sub.upgrade!({} as any)
      expect(upgrade).toEqual({
        error: { message: 'Subscriptions are disabled in development mode' },
      })

      const cancel = await sub.cancel!({} as any)
      expect(cancel).toEqual({ data: null })

      const restore = await sub.restore!({} as any)
      expect(restore).toEqual({ data: null })
    })

    it('returns real client subscription methods in prod mode', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      const mod = await import('@/lib/auth-client')
      const sub = mod.useSubscription()

      expect(sub.list).toBe(mod.client.subscription?.list)
      expect(sub.upgrade).toBe(mod.client.subscription?.upgrade)
      expect(sub.cancel).toBe(mod.client.subscription?.cancel)
      expect(sub.restore).toBe(mod.client.subscription?.restore)
    })
  })

  describe('client wiring', () => {
    it('exports useSession, useActiveOrganization, signIn, signUp, signOut', async () => {
      const mod = await import('@/lib/auth-client')
      expect(typeof mod.useSession).toBe('function')
      expect(typeof mod.useActiveOrganization).toBe('function')
      expect(typeof mod.signIn).toBe('function')
      expect(typeof mod.signUp).toBe('function')
      expect(typeof mod.signOut).toBe('function')
    })
  })
})
