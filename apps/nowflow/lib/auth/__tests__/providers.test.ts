import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/auth/helpers', () => ({
  logger: mocks.logger,
  isProd: false,
  stripeClient: null,
  resend: { emails: { send: vi.fn() } },
}))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))

describe('lib/auth/providers', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe('socialProviders', () => {
    it('includes github when GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set', async () => {
      process.env.GITHUB_CLIENT_ID = 'gh-id'
      process.env.GITHUB_CLIENT_SECRET = 'gh-secret'
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET

      const mod = await import('@/lib/auth/providers')
      expect(mod.socialProviders.github).toMatchObject({
        clientId: 'gh-id',
        clientSecret: 'gh-secret',
      })
      expect(mod.socialProviders.google).toBeUndefined()
    })

    it('includes google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set', async () => {
      delete process.env.GITHUB_CLIENT_ID
      delete process.env.GITHUB_CLIENT_SECRET
      process.env.GOOGLE_CLIENT_ID = 'g-id'
      process.env.GOOGLE_CLIENT_SECRET = 'g-secret'

      const mod = await import('@/lib/auth/providers')
      expect(mod.socialProviders.google).toMatchObject({
        clientId: 'g-id',
        clientSecret: 'g-secret',
      })
      expect(mod.socialProviders.github).toBeUndefined()
    })

    it('is empty when neither set', async () => {
      delete process.env.GITHUB_CLIENT_ID
      delete process.env.GITHUB_CLIENT_SECRET
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET

      const mod = await import('@/lib/auth/providers')
      expect(Object.keys(mod.socialProviders)).toHaveLength(0)
    })
  })

  describe('genericOAuthProviders', () => {
    it('contains known provider ids', async () => {
      const mod = await import('@/lib/auth/providers')
      const ids = mod.genericOAuthProviders.map((p: any) => p.providerId)
      expect(ids).toContain('github-repo')
      expect(ids).toContain('google-email')
      expect(ids).toContain('google-calendar')
      expect(ids).toContain('supabase')
    })
  })

  describe('github-repo.getUserInfo', () => {
    it('returns a mapped OAuth user profile on success', async () => {
      const mod = await import('@/lib/auth/providers')
      const ghProvider: any = mod.genericOAuthProviders.find(
        (p: any) => p.providerId === 'github-repo'
      )

      const profile = {
        id: 42,
        login: 'octocat',
        name: 'Octo Cat',
        email: 'octo@example.com',
        avatar_url: 'https://gh/avatar',
      }
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => profile,
        }))
      )

      const result = await ghProvider.getUserInfo({ accessToken: 'token' })
      expect(result).toMatchObject({
        id: '42',
        name: 'Octo Cat',
        email: 'octo@example.com',
        image: 'https://gh/avatar',
        emailVerified: false,
      })
    })

    it('fetches emails separately when profile.email is null', async () => {
      const mod = await import('@/lib/auth/providers')
      const ghProvider: any = mod.genericOAuthProviders.find(
        (p: any) => p.providerId === 'github-repo'
      )

      const profile = {
        id: 1,
        login: 'noemail',
        name: null,
        email: null,
        avatar_url: null,
      }
      const emails = [
        { email: 'secondary@example.com', primary: false, verified: true },
        { email: 'primary@example.com', primary: true, verified: true },
      ]

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => profile,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => emails,
        })
      vi.stubGlobal('fetch', fetchMock)

      const result = await ghProvider.getUserInfo({ accessToken: 'tok' })
      expect(result.email).toBe('primary@example.com')
      expect(result.emailVerified).toBe(true)
      expect(result.name).toBe('noemail') // falls back to login
    })

    it('throws when GitHub profile request fails', async () => {
      const mod = await import('@/lib/auth/providers')
      const ghProvider: any = mod.genericOAuthProviders.find(
        (p: any) => p.providerId === 'github-repo'
      )

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          json: async () => ({}),
        }))
      )

      await expect(ghProvider.getUserInfo({ accessToken: 'x' })).rejects.toThrow(
        /Failed to fetch GitHub profile/
      )
    })
  })

  describe('supabase.getUserInfo', () => {
    it('parses a JWT id_token and derives a userId from sub', async () => {
      const mod = await import('@/lib/auth/providers')
      const supa: any = mod.genericOAuthProviders.find((p: any) => p.providerId === 'supabase')
      if (!supa || !supa.getUserInfo) return

      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({ sub: 'supabase-abc' })).toString('base64')
      const idToken = `${header}.${payload}.sig`

      const result = await supa.getUserInfo({ idToken, accessToken: 'a' })
      // The Supabase handler synthesizes some user-like object. We only assert
      // that something is returned and that the sub made it into an identifier.
      expect(result).toBeDefined()
      const serialized = JSON.stringify(result)
      expect(serialized).toContain('supabase-abc')
    })
  })
})
