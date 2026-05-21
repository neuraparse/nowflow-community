import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const limitMock = vi.fn(async () => [] as any[])
  const whereMock = vi.fn(() => ({ limit: limitMock }))
  const innerJoinMock = vi.fn(() => ({ where: whereMock }))
  const fromMock = vi.fn(() => ({ innerJoin: innerJoinMock, where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))
  const headersMock = vi.fn(async () => new Headers())
  const getSessionApiMock = vi.fn(async () => null as any)
  const ensureFreeSubscriptionForUserMock = vi.fn(async () => undefined)

  return {
    db: { select: selectMock },
    selectMock,
    fromMock,
    innerJoinMock,
    whereMock,
    limitMock,
    headersMock,
    getSessionApiMock,
    ensureFreeSubscriptionForUserMock,
    betterAuthFactory: vi.fn(() => ({
      api: {
        getSession: getSessionApiMock,
        signInEmail: vi.fn(),
        signUpEmail: vi.fn(),
      },
    })),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('next/headers', () => ({
  headers: mocks.headersMock,
}))

vi.mock('better-auth', () => ({
  betterAuth: mocks.betterAuthFactory,
}))

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => ({ __adapter: 'drizzle' })),
}))

vi.mock('@/db', () => ({ db: mocks.db }))

vi.mock('@/db/schema', () => ({
  session: {
    id: 's.id',
    token: 's.token',
    expiresAt: 's.expiresAt',
    userId: 's.userId',
  },
  user: {
    id: 'u.id',
    name: 'u.name',
    email: 'u.email',
    emailVerified: 'u.emailVerified',
    image: 'u.image',
    role: 'u.role',
    createdAt: 'u.createdAt',
    updatedAt: 'u.updatedAt',
  },
  member: { userId: 'm.userId', organizationId: 'm.organizationId' },
  subscription: {
    status: 'sub.status',
    planId: 'sub.planId',
    referenceId: 'sub.referenceId',
    seats: 'sub.seats',
  },
  subscriptionPlan: { id: 'sp.id', name: 'sp.name' },
  invitation: { organizationId: 'i.organizationId', status: 'i.status' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ __eq: [a, b] })),
  and: vi.fn((...args: any[]) => ({ __and: args })),
  gt: vi.fn((a: any, b: any) => ({ __gt: [a, b] })),
}))

vi.mock('@/lib/subscription-plan', () => ({
  ensureFreeSubscriptionForUser: mocks.ensureFreeSubscriptionForUserMock,
}))

vi.mock('@/lib/config/app-urls', () => ({
  ALL_DOMAINS: ['https://example.com'],
  TEAM_FROM: 'team@example.com',
  ONBOARDING_FROM: 'welcome@example.com',
}))

vi.mock('@/lib/auth/helpers', () => ({
  logger: mocks.logger,
  isProd: false,
  stripeClient: null,
  resend: { emails: { send: vi.fn() } },
}))

vi.mock('@/lib/auth/providers', () => ({
  socialProviders: {},
  trustedProviders: ['github'],
  genericOAuthProviders: [],
}))

vi.mock('@/lib/auth/plugins', () => ({
  buildPlugins: vi.fn(() => []),
}))

vi.mock('@/lib/auth/callbacks', () => ({
  databaseHooks: {},
  emailAndPasswordConfig: {},
  onAfterSignUp: vi.fn(),
  pages: {},
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))

const getAuthConfig = () => {
  const calls = mocks.betterAuthFactory.mock.calls as any[][]
  const cfg = calls[0]?.[0]
  expect(cfg).toBeDefined()
  return cfg
}

describe('lib/auth/index', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.limitMock.mockResolvedValue([])
    mocks.getSessionApiMock.mockResolvedValue(null)
    mocks.headersMock.mockResolvedValue(new Headers())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('auth setup', () => {
    it('creates a betterAuth instance with expected config options', async () => {
      await import('@/lib/auth')

      expect(mocks.betterAuthFactory).toHaveBeenCalledTimes(1)
      const cfg = getAuthConfig()
      expect(cfg).toMatchObject({
        session: expect.objectContaining({
          expiresIn: 30 * 24 * 60 * 60,
          updateAge: 24 * 60 * 60,
        }),
        account: expect.objectContaining({
          accountLinking: expect.objectContaining({ enabled: true }),
        }),
      })
      // trustedOrigins should be a function that produces origins
      expect(typeof cfg.trustedOrigins).toBe('function')
    })

    it('trustedOrigins includes localhost in non-production', async () => {
      vi.stubEnv('NODE_ENV', 'development')

      await import('@/lib/auth')
      const cfg = getAuthConfig()
      const origins = cfg.trustedOrigins()
      expect(origins).toContain('http://localhost:3000')
      expect(origins).toContain('http://127.0.0.1:3000')
    })

    it('trustedOrigins parses EXTRA_TRUSTED_ORIGINS', async () => {
      vi.stubEnv('EXTRA_TRUSTED_ORIGINS', 'https://a.test, https://b.test')
      vi.stubEnv('NODE_ENV', 'production')

      await import('@/lib/auth')
      const cfg = getAuthConfig()
      const origins = cfg.trustedOrigins()
      expect(origins).toContain('https://a.test')
      expect(origins).toContain('https://b.test')
    })
  })

  describe('getSession', () => {
    it('returns cookie-based session and ensures FREE subscription', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce({ user: { id: 'u-1' } })

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()

      expect(result).toEqual({ user: { id: 'u-1' } })
      expect(mocks.ensureFreeSubscriptionForUserMock).toHaveBeenCalledWith('u-1')
    })

    it('falls back to Bearer token when no cookie session', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      const hdrs = new Headers({ authorization: 'Bearer mytoken123' })
      mocks.headersMock.mockResolvedValueOnce(hdrs)

      const now = new Date()
      mocks.limitMock.mockResolvedValueOnce([
        {
          sessionId: 's-1',
          sessionToken: 'mytoken123',
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60),
          userId: 'u-2',
          userName: 'User Two',
          userEmail: 'u2@example.com',
          userEmailVerified: true,
          userImage: null,
          userRole: 'user',
          userCreatedAt: now,
          userUpdatedAt: now,
        },
      ])

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()

      expect(result).toMatchObject({
        session: { id: 's-1', token: 'mytoken123', userId: 'u-2' },
        user: { id: 'u-2', email: 'u2@example.com' },
      })
      expect(mocks.ensureFreeSubscriptionForUserMock).toHaveBeenCalledWith('u-2')
    })

    it('returns null when no cookie session and no bearer token', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      mocks.headersMock.mockResolvedValueOnce(new Headers())

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()

      expect(result).toBeNull()
    })

    it('returns null when bearer token is present but DB lookup finds nothing', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      mocks.headersMock.mockResolvedValueOnce(new Headers({ authorization: 'Bearer tok' }))
      mocks.limitMock.mockResolvedValueOnce([])

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()
      expect(result).toBeNull()
    })

    it('returns null when bearer DB lookup throws', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      mocks.headersMock.mockResolvedValueOnce(new Headers({ authorization: 'Bearer tok' }))
      mocks.limitMock.mockRejectedValueOnce(new Error('db-fail'))

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()
      expect(result).toBeNull()
    })

    it('swallows errors from ensureFreeSubscriptionForUser', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce({ user: { id: 'u-err' } })
      mocks.ensureFreeSubscriptionForUserMock.mockRejectedValueOnce(new Error('sub-fail'))

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()
      expect(result).toEqual({ user: { id: 'u-err' } })
      expect(mocks.logger.error).toHaveBeenCalled()
    })

    it('ignores malformed Authorization header (not Bearer)', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      mocks.headersMock.mockResolvedValueOnce(new Headers({ authorization: 'Basic abc' }))

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()
      expect(result).toBeNull()
    })

    it('ignores Bearer with whitespace-only token', async () => {
      mocks.getSessionApiMock.mockResolvedValueOnce(null)
      mocks.headersMock.mockResolvedValueOnce(new Headers({ authorization: 'Bearer    ' }))

      const { getSession } = await import('@/lib/auth')
      const result = await getSession()
      expect(result).toBeNull()
    })
  })

  describe('signIn/signUp exports', () => {
    it('re-exports auth.api.signInEmail and signUpEmail', async () => {
      const mod = await import('@/lib/auth')
      expect(typeof mod.signIn).toBe('function')
      expect(typeof mod.signUp).toBe('function')
    })
  })
})
