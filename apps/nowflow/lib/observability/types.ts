/**
 * Public observability surface.
 *
 * These types are the thin abstraction layer between application code and
 * concrete observability providers (Sentry, OpenTelemetry, ...). Callers must
 * only depend on these types so we can swap providers without rippling
 * changes through the codebase.
 *
 * No imports from `@sentry/*` or `@opentelemetry/*` — those are loaded
 * dynamically in the runtime module so the codebase remains free of hard
 * dependencies on them.
 */

/** Primitive values allowed as span/exception attributes. */
export type AttributeValue = string | number | boolean | null | undefined

/** Structured key/value tags carried with a span or exception. */
export type Attributes = Record<string, AttributeValue>

/**
 * Optional context attached to a captured exception. Keep this provider-agnostic;
 * the runtime adapter is responsible for translating it into Sentry tags/extras.
 */
export type ExceptionContext = {
  /** Logical area of the codebase (e.g. 'api/workflows/execute'). */
  module?: string
  /** Free-form tags, passed through to the underlying provider. */
  tags?: Attributes
  /** Free-form extra payload (request id, workspace id, ...). */
  extra?: Attributes
  /** Severity hint; defaults to 'error' when omitted. */
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
}

/** Identifies the current authenticated principal for the active scope. */
export type UserContext = {
  userId?: string
  email?: string
  workspaceId?: string
}

/**
 * Subset of an OTel Span surface that we expose to callers. Adapters wrapping
 * OTel/Sentry must satisfy this shape. Returned by withSpan via callback so
 * call sites can attach attributes without knowing the provider.
 */
export type SpanHandle = {
  setAttribute: (key: string, value: AttributeValue) => void
  setAttributes: (attrs: Attributes) => void
  recordException: (err: unknown) => void
}

/** Callback executed inside an active span context. */
export type SpanFn<T> = (span: SpanHandle) => T | Promise<T>

/**
 * Public initialisation result. Boolean flags reflect which providers were
 * actually loaded — useful for diagnostic logging at boot time.
 */
export type ObservabilityInitResult = {
  sentryEnabled: boolean
  otelEnabled: boolean
}

/**
 * The runtime API exposed by `lib/observability/index.ts`. Defined here so
 * tests can mock it cleanly.
 */
export type ObservabilityApi = {
  initObservability: () => Promise<ObservabilityInitResult>
  captureException: (err: unknown, context?: ExceptionContext) => void
  withSpan: <T>(name: string, fn: SpanFn<T>, attrs?: Attributes) => Promise<T>
  setUserContext: (user: UserContext) => void
}
