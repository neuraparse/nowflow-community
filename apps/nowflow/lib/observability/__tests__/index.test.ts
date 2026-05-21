import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetObservabilityForTests,
  __setOtelTracerForTests,
  __setSentryClientForTests,
  captureException,
  initObservability,
  setUserContext,
  withSpan,
} from '@/lib/observability'

// ---------------------------------------------------------------------------
// Helpers — minimal fakes that satisfy the structural contracts.
// ---------------------------------------------------------------------------

const buildFakeSentry = () => {
  const setTag = vi.fn()
  const setExtra = vi.fn()
  const setLevel = vi.fn()
  const captureException = vi.fn()
  const setUser = vi.fn()
  const init = vi.fn()
  const withScope = vi.fn((cb: (scope: Record<string, unknown>) => void) => {
    cb({ setTag, setExtra, setLevel })
  })
  return {
    client: { init, captureException, setUser, withScope },
    spies: { setTag, setExtra, setLevel, captureException, setUser, withScope },
  }
}

const buildFakeOtelTracer = () => {
  const setAttribute = vi.fn()
  const setAttributes = vi.fn()
  const recordException = vi.fn()
  const setStatus = vi.fn()
  const end = vi.fn()
  const startActiveSpan = vi.fn(
    <T>(
      _name: string,
      _opts: { attributes?: Record<string, unknown> },
      fn: (span: {
        setAttribute: typeof setAttribute
        setAttributes: typeof setAttributes
        recordException: typeof recordException
        setStatus: typeof setStatus
        end: typeof end
      }) => T
    ): T => fn({ setAttribute, setAttributes, recordException, setStatus, end })
  )
  return {
    tracer: { startActiveSpan } as unknown as Parameters<typeof __setOtelTracerForTests>[0],
    spies: { startActiveSpan, setAttribute, setAttributes, recordException, setStatus, end },
  }
}

// ---------------------------------------------------------------------------

describe('lib/observability', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    __resetObservabilityForTests()
  })

  afterEach(() => {
    __resetObservabilityForTests()
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('initObservability — env-var contract', () => {
    it('returns disabled flags when no env vars are set', async () => {
      delete process.env.SENTRY_DSN
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT

      const result = await initObservability()
      expect(result).toEqual({ sentryEnabled: false, otelEnabled: false })
    })

    it('falls back gracefully when @sentry/node is not installed', async () => {
      // @sentry/node is not a workspace dependency, so even with SENTRY_DSN
      // set the dynamic import should fail gracefully and report disabled.
      process.env.SENTRY_DSN = 'https://example@sentry.example/1'
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT

      const result = await initObservability()
      expect(result.sentryEnabled).toBe(false)
      expect(result.otelEnabled).toBe(false)
    })

    it('enables OTel when @opentelemetry/api is resolvable and endpoint is set', async () => {
      // The OTel API package is present transitively in the workspace, so
      // setting the endpoint should yield a working tracer handle.
      delete process.env.SENTRY_DSN
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'

      const result = await initObservability()
      expect(result.sentryEnabled).toBe(false)
      expect(result.otelEnabled).toBe(true)
    })

    it('memoises the init promise across repeated calls', async () => {
      delete process.env.SENTRY_DSN
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT

      const first = initObservability()
      const second = initObservability()
      expect(first).toBe(second)
      await first
    })
  })

  describe('captureException — fallback behaviour', () => {
    it('falls back to console.error when Sentry is not loaded', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const err = new Error('boom')

      captureException(err, { module: 'tests' })

      expect(errSpy).toHaveBeenCalled()
      const lastCall = errSpy.mock.calls.at(-1) ?? []
      const joined = lastCall.map(String).join(' ')
      expect(joined).toContain('captureException')
      expect(joined).toContain('tests')
    })

    it('routes to Sentry when a client is bound, with tags/extra/level', () => {
      const { client, spies } = buildFakeSentry()
      __setSentryClientForTests(client)

      const err = new Error('routed')
      captureException(err, {
        module: 'api/test',
        tags: { route: '/x' },
        extra: { requestId: 'r-1' },
        level: 'warning',
      })

      expect(spies.withScope).toHaveBeenCalledTimes(1)
      expect(spies.setTag).toHaveBeenCalledWith('route', '/x')
      expect(spies.setTag).toHaveBeenCalledWith('module', 'api/test')
      expect(spies.setExtra).toHaveBeenCalledWith('requestId', 'r-1')
      expect(spies.setLevel).toHaveBeenCalledWith('warning')
      expect(spies.captureException).toHaveBeenCalledWith(err)
    })
  })

  describe('withSpan — execution semantics', () => {
    it('executes fn and returns its result when OTel is not loaded', async () => {
      const result = await withSpan('test.span', async (span) => {
        // The no-op span handle should accept attribute writes silently.
        span.setAttribute('k', 'v')
        span.setAttributes({ a: 1, b: 'x' })
        return 42
      })
      expect(result).toBe(42)
    })

    it('rethrows errors when OTel is not loaded', async () => {
      await expect(
        withSpan('test.span', async () => {
          throw new Error('inner')
        })
      ).rejects.toThrow('inner')
    })

    it('starts an active span via the OTel tracer when bound', async () => {
      const { tracer, spies } = buildFakeOtelTracer()
      __setOtelTracerForTests(tracer)

      const result = await withSpan(
        'mocked.span',
        async (span) => {
          span.setAttribute('phase', 'work')
          span.setAttributes({ count: 3, dropped: undefined })
          return 'ok'
        },
        { initial: 'attr' }
      )

      expect(result).toBe('ok')
      expect(spies.startActiveSpan).toHaveBeenCalledTimes(1)
      expect(spies.startActiveSpan).toHaveBeenCalledWith(
        'mocked.span',
        { attributes: { initial: 'attr' } },
        expect.any(Function)
      )
      expect(spies.setAttribute).toHaveBeenCalledWith('phase', 'work')
      // undefined values must be stripped before reaching the OTel span.
      expect(spies.setAttributes).toHaveBeenCalledWith({ count: 3 })
      expect(spies.end).toHaveBeenCalledTimes(1)
      expect(spies.recordException).not.toHaveBeenCalled()
    })

    it('records exception + error status on the OTel span and rethrows', async () => {
      const { tracer, spies } = buildFakeOtelTracer()
      __setOtelTracerForTests(tracer)

      const err = new Error('span-fail')
      await expect(
        withSpan('failing.span', async () => {
          throw err
        })
      ).rejects.toBe(err)

      expect(spies.recordException).toHaveBeenCalledWith(err)
      expect(spies.setStatus).toHaveBeenCalledWith({ code: 2, message: 'span-fail' })
      expect(spies.end).toHaveBeenCalledTimes(1)
    })
  })

  describe('setUserContext', () => {
    it('is a no-op when Sentry is not loaded', () => {
      // No throw; nothing observable beyond returning undefined.
      expect(() => setUserContext({ userId: 'u-1', email: 'a@b' })).not.toThrow()
    })

    it('forwards to Sentry.setUser when bound', () => {
      const { client, spies } = buildFakeSentry()
      __setSentryClientForTests(client)

      setUserContext({ userId: 'u-1', email: 'a@b', workspaceId: 'w-1' })

      expect(spies.setUser).toHaveBeenCalledWith({
        id: 'u-1',
        email: 'a@b',
        workspaceId: 'w-1',
      })
    })

    it('clears Sentry user context for an empty payload', () => {
      const { client, spies } = buildFakeSentry()
      __setSentryClientForTests(client)

      setUserContext({})

      expect(spies.setUser).toHaveBeenCalledWith(null)
    })
  })
})
