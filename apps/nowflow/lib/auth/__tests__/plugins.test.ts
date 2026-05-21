import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bearer: vi.fn(() => ({ id: 'bearer' })),
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
  captcha: vi.fn((cfg: any) => ({ id: 'captcha', __cfg: cfg })),
  emailOTP: vi.fn((cfg: any) => ({ id: 'email-otp', __cfg: cfg })),
  genericOAuth: vi.fn((cfg: any) => ({ id: 'generic-oauth', __cfg: cfg })),
  organization: vi.fn((cfg: any) => ({ id: 'organization', __cfg: cfg })),
  stripe: vi.fn((cfg: any) => ({ id: 'stripe', __cfg: cfg })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendEmail: vi.fn(async () => ({ success: true })),
  renderEmail: vi.fn(async () => ({ subject: 's', html: '<p>h</p>' })),
}))

vi.mock('@better-auth/stripe', () => ({
  stripe: mocks.stripe,
}))

vi.mock('better-auth/next-js', () => ({
  nextCookies: mocks.nextCookies,
}))

vi.mock('better-auth/plugins', () => ({
  bearer: mocks.bearer,
  captcha: mocks.captcha,
  emailOTP: mocks.emailOTP,
  genericOAuth: mocks.genericOAuth,
  organization: mocks.organization,
}))

vi.mock('@/db', () => ({ db: { select: vi.fn() } }))
vi.mock('@/db/schema', () => ({
  member: {},
  subscription: {},
  subscriptionPlan: {},
  invitation: {},
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}))
vi.mock('@/lib/email-templates/service', () => ({
  renderEmail: mocks.renderEmail,
}))
vi.mock('@/lib/config/app-urls', () => ({
  ONBOARDING_FROM: 'welcome@example.com',
  TEAM_FROM: 'team@example.com',
}))
vi.mock('@/lib/mailer', () => ({
  sendEmail: mocks.sendEmail,
}))
vi.mock('@/lib/auth/providers', () => ({
  genericOAuthProviders: [{ providerId: 'x' }],
}))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))

// helpers mock — isProd / stripeClient override via reset
const helpersMockState = { isProd: false, stripeClient: null as any }
vi.mock('@/lib/auth/helpers', () => ({
  logger: mocks.logger,
  get isProd() {
    return helpersMockState.isProd
  },
  get stripeClient() {
    return helpersMockState.stripeClient
  },
  resend: { emails: { send: mocks.sendEmail } },
}))

describe('lib/auth/plugins', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    helpersMockState.isProd = false
    helpersMockState.stripeClient = null
    delete process.env.TURNSTILE_SECRET_KEY
  })

  afterEach(() => {
    helpersMockState.isProd = false
    helpersMockState.stripeClient = null
    delete process.env.TURNSTILE_SECRET_KEY
  })

  it('returns bearer, nextCookies, emailOTP, genericOAuth in non-prod', async () => {
    const { buildPlugins } = await import('@/lib/auth/plugins')
    const plugins = buildPlugins()
    const ids = plugins.map((p: any) => p.id)

    expect(ids).toContain('bearer')
    expect(ids).toContain('next-cookies')
    expect(ids).toContain('email-otp')
    expect(ids).toContain('generic-oauth')
    expect(ids).not.toContain('captcha')
    expect(ids).not.toContain('stripe')
    expect(ids).not.toContain('organization')
    expect(ids.at(-1)).toBe('next-cookies')
  })

  it('includes the captcha plugin when TURNSTILE_SECRET_KEY is set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'

    const { buildPlugins } = await import('@/lib/auth/plugins')
    const plugins = buildPlugins()
    const ids = plugins.map((p: any) => p.id)

    expect(ids).toContain('captcha')
    const cfg = mocks.captcha.mock.calls[0][0] as any
    expect(cfg.provider).toBe('cloudflare-turnstile')
    expect(cfg.secretKey).toBe('test-secret')
    expect(cfg.endpoints).toContain('/sign-up/email')
    expect(cfg.endpoints).toContain('/sign-in/email')
    expect(cfg.endpoints).toContain('/forget-password')
  })

  it('includes stripe and organization plugins when isProd && stripeClient present', async () => {
    helpersMockState.isProd = true
    helpersMockState.stripeClient = { mock: 'stripe' }

    const { buildPlugins } = await import('@/lib/auth/plugins')
    const plugins = buildPlugins()
    const ids = plugins.map((p: any) => p.id)

    expect(ids).toContain('stripe')
    expect(ids).toContain('organization')
  })

  it('still omits stripe plugins if stripeClient is null even when isProd', async () => {
    helpersMockState.isProd = true
    helpersMockState.stripeClient = null

    const { buildPlugins } = await import('@/lib/auth/plugins')
    const plugins = buildPlugins()
    const ids = plugins.map((p: any) => p.id)

    expect(ids).not.toContain('stripe')
    expect(ids).not.toContain('organization')
  })

  it('emailOTP sendVerificationOTP sends a rendered email and throws if email missing', async () => {
    const { buildPlugins } = await import('@/lib/auth/plugins')
    buildPlugins()

    const cfg = mocks.emailOTP.mock.calls[0][0] as any
    expect(cfg.otpLength).toBe(6)
    expect(cfg.expiresIn).toBe(15 * 60)

    await expect(
      cfg.sendVerificationOTP({ email: '', otp: '123', type: 'sign-in' })
    ).rejects.toThrow(/Email is required/)

    await cfg.sendVerificationOTP({
      email: 'u@example.com',
      otp: '123456',
      type: 'sign-in',
    })
    expect(mocks.renderEmail).toHaveBeenCalledWith('sign-in', {
      otp: '123456',
      email: 'u@example.com',
    })
    expect(mocks.sendEmail).toHaveBeenCalled()
  })

  it('emailOTP sendVerificationOTP throws when sendEmail fails', async () => {
    const { buildPlugins } = await import('@/lib/auth/plugins')
    buildPlugins()

    const cfg = mocks.emailOTP.mock.calls[0][0] as any
    mocks.sendEmail.mockResolvedValueOnce({ success: false, message: 'smtp down' } as any)

    await expect(
      cfg.sendVerificationOTP({
        email: 'u@example.com',
        otp: '000000',
        type: 'email-verification',
      })
    ).rejects.toThrow(/Failed to send verification code/)
  })
})
