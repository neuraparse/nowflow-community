'use client'

/**
 * Browser-side observability facade — Sentry-only.
 *
 * Loaded by client components. Mirrors the server-side facade in
 * `./index.ts` but targets `@sentry/nextjs` (browser SDK). The package is
 * NOT a workspace dependency: we lazy-load it via dynamic `import()` only
 * when `NEXT_PUBLIC_SENTRY_DSN` is set, and fall back to a no-op (with a
 * console warning) if the package can't be resolved at runtime.
 *
 * Env-var contract:
 *   - NEXT_PUBLIC_SENTRY_DSN                  → required; enables browser Sentry capture
 *   - NEXT_PUBLIC_SENTRY_ENVIRONMENT          → optional; maps to Sentry `environment`
 *                                               (defaults to NODE_ENV)
 *   - NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE   → optional; numeric 0..1 (default 0.1)
 *   - NEXT_PUBLIC_SENTRY_REPLAY_SESSION_RATE  → optional; numeric 0..1 (default 0.1).
 *                                               Sample rate for routine session replays.
 *   - NEXT_PUBLIC_SENTRY_REPLAY_ERROR_RATE    → optional; numeric 0..1 (default 1.0).
 *                                               Sample rate for replays that include an error.
 *
 * The 'use client' directive ensures this module is only ever bundled into
 * client chunks; route handlers and RSC must keep importing from
 * `@/lib/observability` instead.
 *
 * Public surface (kept structurally identical to server-side intent):
 *   - initBrowserObservability()
 *   - captureBrowserException(err, context?)
 *   - setBrowserUserContext({ userId, email })
 *   - withBrowserSpan(name, fn)
 */
import type { Attributes, ExceptionContext, SpanFn, SpanHandle, UserContext } from './types'

// ---------------------------------------------------------------------------
// Internal state — kept module-local; never exported through the public API.
// ---------------------------------------------------------------------------

type SentryBrowserLike = {
  init: (opts: Record<string, unknown>) => void
  captureException: (err: unknown, hint?: Record<string, unknown>) => void
  setUser: (user: Record<string, unknown> | null) => void
  withScope?: (cb: (scope: Record<string, unknown>) => void) => void
  startSpan?: <T>(
    options: { name: string; attributes?: Record<string, unknown> },
    fn: (span: BrowserSpanLike) => T
  ) => T
  replayIntegration?: (opts?: Record<string, unknown>) => unknown
  browserTracingIntegration?: (opts?: Record<string, unknown>) => unknown
}

type BrowserSpanLike = {
  setAttribute: (key: string, value: unknown) => void
  setAttributes: (attrs: Record<string, unknown>) => void
  recordException?: (err: unknown) => void
  setStatus?: (status: { code: number; message?: string }) => void
}

let sentryBrowser: SentryBrowserLike | null = null
let initPromise: Promise<{ sentryEnabled: boolean }> | null = null
let testLoaderOverride: (() => Promise<SentryBrowserLike | null>) | null = null

// ---------------------------------------------------------------------------
// Test-only hooks
// ---------------------------------------------------------------------------

/** Reset module state — only intended for unit tests. */
export function __resetBrowserObservabilityForTests(): void {
  sentryBrowser = null
  initPromise = null
  testLoaderOverride = null
}

/** Inject a fake Sentry browser client for tests. */
export function __setBrowserSentryClientForTests(client: SentryBrowserLike | null): void {
  sentryBrowser = client
}

/**
 * Override the dynamic `@sentry/nextjs` loader for tests. The override receives
 * full control over what `loadSentryBrowser` returns, so tests can simulate a
 * working SDK (with replay/browserTracing) without adding the real package.
 */
export function __setBrowserSentryLoaderForTests(
  loader: (() => Promise<SentryBrowserLike | null>) | null
): void {
  testLoaderOverride = loader
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

/**
 * Build the optional `integrations` array for the browser SDK. Each entry is
 * added independently behind its own try/catch so an older SDK that doesn't
 * expose `replayIntegration` / `browserTracingIntegration` still initialises
 * successfully — we just skip the missing one.
 */
const buildBrowserIntegrations = (sentry: SentryBrowserLike): unknown[] => {
  const integrations: unknown[] = []
  try {
    if (typeof sentry.replayIntegration === 'function') {
      const replay = sentry.replayIntegration({ maskAllText: true, blockAllMedia: false })
      if (replay) integrations.push(replay)
    }
  } catch (err) {
    console.warn('[observability] Sentry replayIntegration threw; skipping replay', err)
  }
  try {
    if (typeof sentry.browserTracingIntegration === 'function') {
      const tracing = sentry.browserTracingIntegration()
      if (tracing) integrations.push(tracing)
    }
  } catch (err) {
    console.warn('[observability] Sentry browserTracingIntegration threw; skipping tracing', err)
  }
  return integrations
}

/**
 * Build the `Sentry.init` options object from the current environment + the
 * loaded SDK. Exposed structurally (not exported) so the call site stays
 * concise; integrations missing from older SDKs are silently dropped.
 */
const buildBrowserInitOptions = (
  sentry: SentryBrowserLike,
  dsn: string
): Record<string, unknown> => {
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: parseSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.1),
    replaysSessionSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_RATE,
      0.1
    ),
    replaysOnErrorSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAY_ERROR_RATE,
      1.0
    ),
    integrations: buildBrowserIntegrations(sentry),
    tracePropagationTargets: ['localhost', /^https?:\/\/[^/]+\.nowflow\.io/],
  }
}

const loadSentryBrowser = async (): Promise<SentryBrowserLike | null> => {
  if (testLoaderOverride) {
    return await testLoaderOverride()
  }
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  try {
    // Eval-style spec + webpackIgnore keeps `@sentry/nextjs` out of the
    // dependency graph and out of the build when it isn't installed.
    const spec = '@sentry/nextjs'
    const mod = (await import(/* @vite-ignore */ /* webpackIgnore: true */ spec)) as Record<
      string,
      unknown
    >
    const sentry = (mod.default ?? mod) as SentryBrowserLike
    sentry.init(buildBrowserInitOptions(sentry, dsn))
    return sentry
  } catch (err) {
    console.warn(
      '[observability] NEXT_PUBLIC_SENTRY_DSN is set but @sentry/nextjs is not installed; falling back to no-op',
      err
    )
    return null
  }
}

/**
 * Run the SDK's own `init` against the constructed options. Exported for tests
 * that want to drive a fake SDK end-to-end via `__setBrowserSentryLoaderForTests`.
 */
export function __initSentryBrowserForTests(sentry: SentryBrowserLike, dsn: string): void {
  sentry.init(buildBrowserInitOptions(sentry, dsn))
}

/**
 * Initialise the browser Sentry SDK. Idempotent — repeated calls return the
 * same in-flight promise. Safe to call from a top-level client provider.
 */
export function initBrowserObservability(): Promise<{ sentryEnabled: boolean }> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const client = await loadSentryBrowser()
    sentryBrowser = client
    return { sentryEnabled: client !== null }
  })()
  return initPromise
}

// ---------------------------------------------------------------------------
// captureBrowserException
// ---------------------------------------------------------------------------

/**
 * Record an exception from the browser. Routes to Sentry when loaded,
 * otherwise prints to `console.error` so failures aren't silently dropped.
 */
export function captureBrowserException(err: unknown, context?: ExceptionContext): void {
  if (sentryBrowser) {
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
        sentryBrowser!.captureException(err)
      }
      if (typeof sentryBrowser.withScope === 'function') {
        sentryBrowser.withScope((scope) => apply(scope))
      } else {
        apply(null)
      }
      return
    } catch (innerErr) {
      console.warn(
        '[observability] Sentry browser captureException threw; logging fallback',
        innerErr
      )
    }
  }

  console.error(
    `[observability] captureBrowserException${context?.module ? ` [${context.module}]` : ''}`,
    err,
    context?.extra ?? {}
  )
}

// ---------------------------------------------------------------------------
// setBrowserUserContext
// ---------------------------------------------------------------------------

/**
 * Bind the active user to the Sentry browser scope so subsequent
 * captureBrowserException calls carry user identity. No-op when the browser
 * SDK isn't loaded.
 */
export function setBrowserUserContext(user: UserContext): void {
  if (!sentryBrowser) return
  try {
    const payload: Record<string, unknown> = {}
    if (user.userId) payload.id = user.userId
    if (user.email) payload.email = user.email
    if (user.workspaceId) payload.workspaceId = user.workspaceId
    sentryBrowser.setUser(Object.keys(payload).length === 0 ? null : payload)
  } catch (err) {
    console.warn('[observability] Sentry browser setUser threw; ignoring', err)
  }
}

// ---------------------------------------------------------------------------
// withBrowserSpan
// ---------------------------------------------------------------------------

const noopSpan: SpanHandle = {
  setAttribute: () => {},
  setAttributes: () => {},
  recordException: () => {},
}

const wrapBrowserSpan = (span: BrowserSpanLike): SpanHandle => ({
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
  recordException: (err) => {
    span.recordException?.(err)
  },
})

/**
 * Run `fn` inside a client-side custom span. When the Sentry browser SDK is
 * loaded and exposes `startSpan`, the call is recorded as a tracing span.
 * Otherwise it collapses to a direct invocation against a no-op span handle.
 *
 * Always returns whatever `fn` returns; rethrows after recording the
 * exception on the span so callers retain control flow.
 */
export async function withBrowserSpan<T>(
  name: string,
  fn: SpanFn<T>,
  attrs?: Attributes
): Promise<T> {
  if (!sentryBrowser || typeof sentryBrowser.startSpan !== 'function') {
    return await fn(noopSpan)
  }
  return await sentryBrowser.startSpan(
    { name, attributes: attrs as Record<string, unknown> | undefined },
    async (span) => {
      const handle = wrapBrowserSpan(span)
      try {
        return await fn(handle)
      } catch (err) {
        span.recordException?.(err)
        span.setStatus?.({ code: 2, message: errorMessage(err) })
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
