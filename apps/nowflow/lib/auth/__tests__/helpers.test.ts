import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stripeCtor: vi.fn(),
  sendEmail: vi.fn(async () => ({ success: true, message: 'ok' })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('stripe', () => ({
  default: class {
    constructor(...args: any[]) {
      mocks.stripeCtor(...args)
    }
  },
}))

vi.mock('@/lib/mailer', () => ({
  sendEmail: mocks.sendEmail,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => mocks.logger,
}))

describe('lib/auth/helpers', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.STRIPE_SECRET_KEY
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...ORIGINAL_ENV }
  })

  describe('isProd', () => {
    it('is true when NODE_ENV=production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const mod = await import('@/lib/auth/helpers')
      expect(mod.isProd).toBe(true)
    })

    it('is false when NODE_ENV=development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const mod = await import('@/lib/auth/helpers')
      expect(mod.isProd).toBe(false)
    })
  })

  describe('stripeClient', () => {
    it('is null when STRIPE_SECRET_KEY is missing', async () => {
      const mod = await import('@/lib/auth/helpers')
      expect(mod.stripeClient).toBeNull()
      expect(mocks.stripeCtor).not.toHaveBeenCalled()
    })

    it('is null when STRIPE_SECRET_KEY is the literal "placeholder"', async () => {
      process.env.STRIPE_SECRET_KEY = 'placeholder'
      const mod = await import('@/lib/auth/helpers')
      expect(mod.stripeClient).toBeNull()
    })

    it('is null when STRIPE_SECRET_KEY is empty-ish whitespace', async () => {
      process.env.STRIPE_SECRET_KEY = '   '
      const mod = await import('@/lib/auth/helpers')
      expect(mod.stripeClient).toBeNull()
    })

    it('constructs a Stripe client when a real secret key is set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_real'
      const mod = await import('@/lib/auth/helpers')
      expect(mod.stripeClient).not.toBeNull()
      expect(mocks.stripeCtor).toHaveBeenCalledWith('sk_test_real', {
        apiVersion: '2026-02-25.clover',
      })
    })
  })

  describe('resend.emails.send', () => {
    it('sends an email via the mailer and returns a generated id on success', async () => {
      const mod = await import('@/lib/auth/helpers')
      const result = await mod.resend.emails.send({
        to: 'u@example.com',
        subject: 'hi',
        html: '<b>hi</b>',
        from: 'team@example.com',
      })

      expect(result).toEqual({ id: expect.stringMatching(/^smtp-\d+$/) })
      expect(mocks.sendEmail).toHaveBeenCalledWith({
        to: 'u@example.com',
        subject: 'hi',
        html: '<b>hi</b>',
        from: 'team@example.com',
      })
    })

    it('throws when the mailer reports failure', async () => {
      mocks.sendEmail.mockResolvedValueOnce({ success: false, message: 'smtp off' })
      const mod = await import('@/lib/auth/helpers')

      await expect(
        mod.resend.emails.send({
          to: 'x@example.com',
          subject: 's',
          html: 'h',
          from: 'f@example.com',
        })
      ).rejects.toThrow(/smtp off/)
    })

    it('rethrows unexpected errors from the mailer', async () => {
      mocks.sendEmail.mockRejectedValueOnce(new Error('network'))
      const mod = await import('@/lib/auth/helpers')

      await expect(
        mod.resend.emails.send({
          to: 'x@example.com',
          subject: 's',
          html: 'h',
          from: 'f@example.com',
        })
      ).rejects.toThrow(/network/)
    })
  })

  describe('logger', () => {
    it('is an object with standard log methods', async () => {
      const mod = await import('@/lib/auth/helpers')
      expect(typeof mod.logger.info).toBe('function')
      expect(typeof mod.logger.warn).toBe('function')
      expect(typeof mod.logger.error).toBe('function')
    })
  })
})
