import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const limitMock = vi.fn(async () => [] as any[])
  const whereMock = vi.fn(() => ({ limit: limitMock }))
  const fromMock = vi.fn(() => ({ where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))
  return {
    db: { select: selectMock },
    selectMock,
    fromMock,
    whereMock,
    limitMock,
    eq: vi.fn((a: any, b: any) => ({ __eq: [a, b] })),
    renderEmail: vi.fn(async () => ({ subject: 'Subj', html: '<p>hi</p>' })),
    ensureFreeSubscriptionForUser: vi.fn(async () => undefined),
    sendEmail: vi.fn(async () => ({ success: true, message: 'ok' })),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/db', () => ({ db: mocks.db }))
vi.mock('@/db/schema', () => ({
  member: { userId: 'member.userId', organizationId: 'member.organizationId' },
}))
vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: vi.fn(),
  gt: vi.fn(),
}))
vi.mock('@/lib/email-templates/service', () => ({
  renderEmail: mocks.renderEmail,
}))
vi.mock('@/lib/subscription-plan', () => ({
  ensureFreeSubscriptionForUser: mocks.ensureFreeSubscriptionForUser,
}))
vi.mock('@/lib/config/app-urls', () => ({
  TEAM_FROM: 'team@example.com',
  ONBOARDING_FROM: 'welcome@example.com',
  ALL_DOMAINS: ['https://example.com'],
}))
vi.mock('@/lib/mailer', () => ({
  sendEmail: mocks.sendEmail,
}))
vi.mock('@/lib/auth/helpers', () => ({
  logger: mocks.logger,
  isProd: false,
  stripeClient: null,
  resend: { emails: { send: mocks.sendEmail } },
}))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))

describe('lib/auth/callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.limitMock.mockResolvedValue([])
  })

  describe('databaseHooks.session.create.before', () => {
    it('injects activeOrganizationId when user has a membership', async () => {
      mocks.limitMock.mockResolvedValueOnce([{ organizationId: 'org-1' }])

      const { databaseHooks } = await import('@/lib/auth/callbacks')
      const result = await databaseHooks.session.create.before({
        userId: 'u1',
        token: 't1',
      })

      expect(result).toEqual({
        data: expect.objectContaining({
          userId: 'u1',
          token: 't1',
          activeOrganizationId: 'org-1',
        }),
      })
    })

    it('returns session unchanged when no membership', async () => {
      mocks.limitMock.mockResolvedValueOnce([])

      const { databaseHooks } = await import('@/lib/auth/callbacks')
      const result = await databaseHooks.session.create.before({ userId: 'u2' })

      expect(result).toEqual({ data: { userId: 'u2' } })
    })

    it('gracefully returns session when DB throws', async () => {
      mocks.limitMock.mockRejectedValueOnce(new Error('db-fail'))

      const { databaseHooks } = await import('@/lib/auth/callbacks')
      const session = { userId: 'u3' }
      const result = await databaseHooks.session.create.before(session)

      expect(result).toEqual({ data: session })
      expect(mocks.logger.error).toHaveBeenCalled()
    })
  })

  describe('emailAndPasswordConfig.sendResetPassword', () => {
    it('sends reset-password email with rendered content', async () => {
      const { emailAndPasswordConfig } = await import('@/lib/auth/callbacks')

      await emailAndPasswordConfig.sendResetPassword(
        {
          user: { name: 'Alice', email: 'a@example.com' },
          url: 'https://reset.link',
          token: 'tkn',
        },
        {}
      )

      expect(mocks.renderEmail).toHaveBeenCalledWith('reset-password', {
        username: 'Alice',
        resetLink: 'https://reset.link',
      })
      expect(mocks.sendEmail).toHaveBeenCalledWith({
        from: 'team@example.com',
        to: 'a@example.com',
        subject: 'Subj',
        html: '<p>hi</p>',
      })
    })

    it('defaults to empty username when user.name is missing', async () => {
      const { emailAndPasswordConfig } = await import('@/lib/auth/callbacks')

      await emailAndPasswordConfig.sendResetPassword(
        { user: { email: 'b@example.com' }, url: 'u', token: 't' },
        {}
      )

      expect(mocks.renderEmail).toHaveBeenCalledWith('reset-password', {
        username: '',
        resetLink: 'u',
      })
    })

    it('throws when sendEmail reports failure', async () => {
      mocks.sendEmail.mockResolvedValueOnce({ success: false, message: 'smtp down' })
      const { emailAndPasswordConfig } = await import('@/lib/auth/callbacks')

      await expect(
        emailAndPasswordConfig.sendResetPassword(
          { user: { email: 'c@example.com' }, url: 'u', token: 't' },
          {}
        )
      ).rejects.toThrow(/smtp down/)
    })
  })

  describe('onAfterSignUp', () => {
    it('invokes ensureFreeSubscriptionForUser', async () => {
      const { onAfterSignUp } = await import('@/lib/auth/callbacks')

      await onAfterSignUp({ id: 'u-new', email: 'n@example.com' })

      expect(mocks.ensureFreeSubscriptionForUser).toHaveBeenCalledWith('u-new')
    })

    it('swallows errors and logs them', async () => {
      mocks.ensureFreeSubscriptionForUser.mockRejectedValueOnce(new Error('boom'))
      const { onAfterSignUp } = await import('@/lib/auth/callbacks')

      await expect(onAfterSignUp({ id: 'u', email: 'e' })).resolves.toBeUndefined()
      expect(mocks.logger.error).toHaveBeenCalled()
    })
  })

  describe('pages', () => {
    it('exports the expected path map', async () => {
      const { pages } = await import('@/lib/auth/callbacks')
      expect(pages).toEqual({
        signIn: '/login',
        signUp: '/signup',
        error: '/error',
        verify: '/verify',
        verifyRequest: '/verify-request',
      })
    })
  })

  describe('emailAndPasswordConfig flags', () => {
    it('has expected defaults', async () => {
      const { emailAndPasswordConfig } = await import('@/lib/auth/callbacks')
      expect(emailAndPasswordConfig.enabled).toBe(true)
      expect(emailAndPasswordConfig.requireEmailVerification).toBe(false)
      expect(emailAndPasswordConfig.sendVerificationOnSignUp).toBe(false)
      expect(emailAndPasswordConfig.throwOnMissingCredentials).toBe(true)
      expect(emailAndPasswordConfig.throwOnInvalidCredentials).toBe(true)
    })
  })
})
