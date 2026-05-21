/**
 * Observability runtime — Sentry + OpenTelemetry foundations.
 *
 * Loaded once from `instrumentation.ts` at server bootstrap. We deliberately
 * avoid hard dependencies on `@sentry/*` or `@opentelemetry/*`: providers are
 * loaded via dynamic `import()` only when their respective env vars are set.
 * If a provider package isn't installed, we log a warning and fall back to
 * no-op behaviour so the app still boots.
 *
 * Env-var contract:
 *   - SENTRY_DSN                    → enables Sentry error capture
 *   - SENTRY_ENVIRONMENT (optional) → maps to Sentry `environment`
 *   - SENTRY_TRACES_SAMPLE_RATE     → numeric, 0..1; defaults to 0.1
 *   - OTEL_EXPORTER_OTLP_ENDPOINT   → enables OTel tracing via the OTLP exporter
 *   - OTEL_SERVICE_NAME             → service.name resource attribute
 *
 * Public surface lives in `./types.ts` so callers never import provider types
 * directly. This is the "thin layer" we can swap later.
 */
import { createLogger } from '@/lib/logs/console-logger'
import type {
  Attributes,
  ExceptionContext,
  ObservabilityApi,
  ObservabilityInitResult,
  SpanFn,
  SpanHandle,
  UserContext,
} from './types'

const logger = createLogger('observability')

// ---------------------------------------------------------------------------
// Internal state — kept module-local; never exported.
// ---------------------------------------------------------------------------

type SentryLike = {
  init: (opts: Record<string, unknown>) => void
  captureException: (err: unknown, hint?: Record<string, unknown>) => void
  setUser: (user: Record<string, unknown> | null) => void
  withScope?: (cb: (scope: Record<string, unknown>) => void) => void
}

type TracerLike = {
  startActiveSpan: <T>(
    name: string,
    options: { attributes?: Record<string, unknown> },
    fn: (span: OtelSpanLike) => T
  ) => T
}

type OtelSpanLike = {
  setAttribute: (key: string, value: unknown) => void
  setAttributes: (attrs: Record<string, unknown>) => void
  recordException: (err: unknown) => void
  setStatus: (status: { code: number; message?: string }) => void
  end: () => void
}

let sentryClient: SentryLike | null = null
let otelTracer: TracerLike | null = null
let initPromise: Promise<ObservabilityInitResult> | null = null

// ---------------------------------------------------------------------------
// Test-only hooks
// ---------------------------------------------------------------------------

/**
 * Reset module state — only intended for unit tests. Not exported through the
 * `ObservabilityApi` type so production callers won't see it.
 */
export function __resetObservabilityForTests(): void {
  sentryClient = null
  otelTracer = null
  initPromise = null
}

/** Inject a fake Sentry client for tests. */
export function __setSentryClientForTests(client: SentryLike | null): void {
  sentryClient = client
}

/** Inject a fake OTel tracer for tests. */
export function __setOtelTracerForTests(tracer: TracerLike | null): void {
  otelTracer = tracer
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const parseSampleRate = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback
  return n
}

const loadSentry = async (): Promise<SentryLike | null> => {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return null
  try {
    // Dynamic import keeps `@sentry/node` out of the dependency graph when
    // unused. The eval-style spec prevents bundlers from trying to resolve it.
    const spec = '@sentry/node'
    const mod = (await import(/* @vite-ignore */ /* webpackIgnore: true */ spec)) as Record<
      string,
      unknown
    >
    const sentry = (mod.default ?? mod) as SentryLike
    sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    })
    logger.info('Sentry initialised')
    return sentry
  } catch (err) {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; falling back to no-op', err)
    return null
  }
}

const loadOtel = async (): Promise<TracerLike | null> => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) return null
  try {
    const spec = '@opentelemetry/api'
    const api = (await import(/* @vite-ignore */ /* webpackIgnore: true */ spec)) as {
      trace?: { getTracer: (name: string, version?: string) => TracerLike }
    }
    const tracer = api.trace?.getTracer('nowflow', '0.1.0') ?? null
    if (!tracer) {
      logger.warn('OpenTelemetry API loaded but tracer unavailable; falling back to no-op')
      return null
    }
    logger.info('OpenTelemetry tracer acquired', {
      endpoint,
      service: process.env.OTEL_SERVICE_NAME ?? 'nowflow',
    })
    return tracer
  } catch (err) {
    logger.warn(
      'OTEL_EXPORTER_OTLP_ENDPOINT is set but @opentelemetry/api is not installed; falling back to no-op',
      err
    )
    return null
  }
}

/**
 * Initialise observability providers. Idempotent — repeated calls return the
 * same in-flight promise. Safe to call from `instrumentation.ts` exactly once.
 */
export function initObservability(): Promise<ObservabilityInitResult> {
  if (initPromise) return initPromise
  initPromise = (async (): Promise<ObservabilityInitResult> => {
    const [sentry, otel] = await Promise.all([loadSentry(), loadOtel()])
    sentryClient = sentry
    otelTracer = otel
    return {
      sentryEnabled: sentry !== null,
      otelEnabled: otel !== null,
    }
  })()
  return initPromise
}

// ---------------------------------------------------------------------------
// captureException
// ---------------------------------------------------------------------------

/**
 * Record an exception. Routes to Sentry if loaded, otherwise prints to stderr
 * via the canonical console logger so failures aren't silently dropped.
 */
export function captureException(err: unknown, context?: ExceptionContext): void {
  if (sentryClient) {
    try {
      const apply = (scope: Record<string, unknown> | null) => {
        if (scope && context) {
          if (context.tags) {
            for (const [k, v] of Object.entries(context.tags)) {
              ;(scope as { setTag?: (k: string, v: unknown) => void }).setTag?.(k, v)
            }
          }
          if (context.extra) {
            for (const [k, v] of Object.entries(context.extra)) {
              ;(scope as { setExtra?: (k: string, v: unknown) => void }).setExtra?.(k, v)
            }
          }
          if (context.module) {
            ;(scope as { setTag?: (k: string, v: unknown) => void }).setTag?.(
              'module',
              context.module
            )
          }
          if (context.level) {
            ;(scope as { setLevel?: (l: string) => void }).setLevel?.(context.level)
          }
        }
        sentryClient!.captureException(err)
      }
      if (typeof sentryClient.withScope === 'function') {
        sentryClient.withScope((scope) => apply(scope))
      } else {
        apply(null)
      }
      return
    } catch (innerErr) {
      // Sentry failure must not mask the original error — fall through.
      logger.warn('Sentry captureException threw; logging fallback', innerErr)
    }
  }
  // Last-resort fallback: write directly to console.error so the failure is
  // never swallowed, even in environments where the canonical logger is
  // disabled (unit tests). Keeps a parallel logger.error() for the regular
  // dev/prod log stream.
  const prefix = `[observability] captureException${context?.module ? ` [${context.module}]` : ''}`
  console.error(prefix, err, context?.extra ?? {})
  logger.error(prefix, err, context?.extra ?? {})
}

// ---------------------------------------------------------------------------
// withSpan
// ---------------------------------------------------------------------------

const SPAN_STATUS_ERROR = 2 // OTel SpanStatusCode.ERROR

const noopSpan: SpanHandle = {
  setAttribute: () => {},
  setAttributes: () => {},
  recordException: () => {},
}

const wrapOtelSpan = (span: OtelSpanLike): SpanHandle => ({
  setAttribute: (key, value) => {
    if (value === undefined) return
    span.setAttribute(key, value as unknown)
  },
  setAttributes: (attrs) => {
    const filtered: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) filtered[k] = v
    }
    span.setAttributes(filtered)
  },
  recordException: (err) => span.recordException(err),
})

/**
 * Run `fn` inside a tracing span. When OTel is loaded the span is started via
 * `tracer.startActiveSpan` so nested calls form a proper tree. Without OTel
 * this collapses to invoking `fn(noopSpan)` directly.
 *
 * Always returns whatever `fn` returns; rethrows after recording exception
 * status on the span so callers control control-flow.
 */
export async function withSpan<T>(name: string, fn: SpanFn<T>, attrs?: Attributes): Promise<T> {
  if (!otelTracer) {
    return await fn(noopSpan)
  }
  return await otelTracer.startActiveSpan(
    name,
    { attributes: attrs as Record<string, unknown> | undefined },
    async (span) => {
      const handle = wrapOtelSpan(span)
      try {
        const result = await fn(handle)
        span.end()
        return result
      } catch (err) {
        span.recordException(err)
        span.setStatus({ code: SPAN_STATUS_ERROR, message: errorMessage(err) })
        span.end()
        throw err
      }
    }
  )
}

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'unknown error'
}

// ---------------------------------------------------------------------------
// setUserContext
// ---------------------------------------------------------------------------

/**
 * Bind the active user to the Sentry scope so subsequent captureException
 * calls carry user identity. No-op when Sentry isn't loaded.
 */
export function setUserContext(user: UserContext): void {
  if (!sentryClient) return
  try {
    const payload: Record<string, unknown> = {}
    if (user.userId) payload.id = user.userId
    if (user.email) payload.email = user.email
    if (user.workspaceId) payload.workspaceId = user.workspaceId
    sentryClient.setUser(Object.keys(payload).length === 0 ? null : payload)
  } catch (err) {
    logger.warn('Sentry setUser threw; ignoring', err)
  }
}

// ---------------------------------------------------------------------------
// Re-export the public API shape for callers who want a single object.
// ---------------------------------------------------------------------------

export const observability: ObservabilityApi = {
  initObservability,
  captureException,
  withSpan,
  setUserContext,
}

export type {
  Attributes,
  ExceptionContext,
  ObservabilityApi,
  ObservabilityInitResult,
  SpanFn,
  SpanHandle,
  UserContext,
} from './types'

// ---------------------------------------------------------------------------
// Browser-side facade — re-exported for type-only resolution.
//
// IMPORTANT: do NOT import from './browser' at module-top-level. That file
// carries `'use client'` and contains a dynamic import for `@sentry/nextjs`,
// neither of which belongs in the server graph. Instead, callers in client
// components should `import { ... } from '@/lib/observability/browser'`
// directly. We only re-export the *types* here so server-side code can refer
// to them (e.g. for shared SpanFn / ExceptionContext signatures).
// ---------------------------------------------------------------------------
