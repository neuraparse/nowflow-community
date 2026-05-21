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

describe('lib/auth/providers/_factory', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('returns null when client id or secret env vars are missing', async () => {
    delete process.env.FOO_CLIENT_ID
    delete process.env.FOO_CLIENT_SECRET

    const { createOAuthProvider } = await import('@/lib/auth/providers/_factory')

    const result = createOAuthProvider({
      providerId: 'foo',
      clientIdEnv: 'FOO_CLIENT_ID',
      clientSecretEnv: 'FOO_CLIENT_SECRET',
      authorizationUrl: 'https://foo.example/authorize',
      tokenUrl: 'https://foo.example/token',
      userInfoUrl: 'https://foo.example/me',
      scopes: ['read'],
    })

    expect(result).toBeNull()

    // Only one of the two set is also insufficient.
    process.env.FOO_CLIENT_ID = 'id-only'
    const partial = createOAuthProvider({
      providerId: 'foo',
      clientIdEnv: 'FOO_CLIENT_ID',
      clientSecretEnv: 'FOO_CLIENT_SECRET',
      authorizationUrl: 'https://foo.example/authorize',
      tokenUrl: 'https://foo.example/token',
      userInfoUrl: 'https://foo.example/me',
      scopes: ['read'],
    })
    expect(partial).toBeNull()
  })

  it('returns a fully-formed provider config when both env vars are set', async () => {
    process.env.FOO_CLIENT_ID = 'foo-id'
    process.env.FOO_CLIENT_SECRET = 'foo-secret'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'

    const { createOAuthProvider } = await import('@/lib/auth/providers/_factory')

    const provider = createOAuthProvider({
      providerId: 'foo',
      clientIdEnv: 'FOO_CLIENT_ID',
      clientSecretEnv: 'FOO_CLIENT_SECRET',
      authorizationUrl: 'https://foo.example/authorize',
      tokenUrl: 'https://foo.example/token',
      userInfoUrl: 'https://foo.example/me',
      scopes: ['read', 'write'],
      extra: { responseType: 'code', pkce: true },
    })

    expect(provider).toMatchObject({
      providerId: 'foo',
      clientId: 'foo-id',
      clientSecret: 'foo-secret',
      authorizationUrl: 'https://foo.example/authorize',
      tokenUrl: 'https://foo.example/token',
      userInfoUrl: 'https://foo.example/me',
      scopes: ['read', 'write'],
      redirectURI: 'https://app.test/api/auth/oauth2/callback/foo',
      responseType: 'code',
      pkce: true,
    })
    expect(typeof provider!.getUserInfo).toBe('function')

    // Default getUserInfo: fetches userInfoUrl with bearer token, applies
    // default mapProfileToUser to the JSON body.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 42,
          name: 'Ada',
          email: 'ada@example.com',
          avatar_url: 'https://example.com/a.png',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ) as any
    )

    const user = await provider!.getUserInfo({ accessToken: 'tok' })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://foo.example/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    )
    expect(user).toMatchObject({
      id: '42',
      name: 'Ada',
      email: 'ada@example.com',
      image: 'https://example.com/a.png',
      emailVerified: true,
    })
    expect(user!.createdAt).toBeInstanceOf(Date)
    expect(user!.updatedAt).toBeInstanceOf(Date)
  })

  it('respects custom getUserInfo and mapProfileToUser overrides', async () => {
    process.env.BAR_CLIENT_ID = 'bar-id'
    process.env.BAR_CLIENT_SECRET = 'bar-secret'

    const { createOAuthProvider, buildProviderList } = await import('@/lib/auth/providers/_factory')

    const customGetUserInfo = vi.fn(async () => ({
      id: 'custom-id',
      name: 'Custom Name',
      email: 'custom@example.com',
      emailVerified: true,
    }))

    // Custom mapProfileToUser should be ignored when getUserInfo is also
    // supplied (the override wins). Sanity check: it's still callable.
    const customMapProfileToUser = vi.fn((profile: any) => ({
      id: `prefix-${profile.id}`,
      email: profile.email,
      name: profile.fullName,
    }))

    const provider = createOAuthProvider({
      providerId: 'bar',
      clientIdEnv: 'BAR_CLIENT_ID',
      clientSecretEnv: 'BAR_CLIENT_SECRET',
      authorizationUrl: 'https://bar.example/authorize',
      tokenUrl: 'https://bar.example/token',
      userInfoUrl: 'https://bar.example/me',
      scopes: ['scope1'],
      getUserInfo: customGetUserInfo,
      mapProfileToUser: customMapProfileToUser,
    })

    expect(provider).not.toBeNull()
    const user = await provider!.getUserInfo({ accessToken: 'whatever' })
    expect(customGetUserInfo).toHaveBeenCalledTimes(1)
    expect(user).toEqual({
      id: 'custom-id',
      name: 'Custom Name',
      email: 'custom@example.com',
      emailVerified: true,
    })

    // Now exercise mapProfileToUser via the default getUserInfo path.
    process.env.BAZ_CLIENT_ID = 'baz-id'
    process.env.BAZ_CLIENT_SECRET = 'baz-secret'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 7, fullName: 'Grace H', email: 'grace@example.com' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any
    )

    const list = buildProviderList([
      {
        providerId: 'baz',
        clientIdEnv: 'BAZ_CLIENT_ID',
        clientSecretEnv: 'BAZ_CLIENT_SECRET',
        authorizationUrl: 'https://baz.example/authorize',
        tokenUrl: 'https://baz.example/token',
        userInfoUrl: 'https://baz.example/me',
        scopes: [],
        mapProfileToUser: customMapProfileToUser,
      },
    ])

    expect(list).toHaveLength(1)
    const bazUser = await list[0].getUserInfo({ accessToken: 'tok' })
    expect(fetchSpy).toHaveBeenCalled()
    expect(customMapProfileToUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, fullName: 'Grace H' })
    )
    expect(bazUser).toMatchObject({
      id: 'prefix-7',
      name: 'Grace H',
      email: 'grace@example.com',
    })
  })
})
