/**
 * Generic in-process metrics facade.
 *
 * Designed to be swap-backed by OpenTelemetry / Prometheus later via an adapter.
 * All APIs are synchronous and allocation-light — suitable for hot paths.
 */

export type TagValue = string | number | boolean
export type Tags = Record<string, TagValue>

export type Counter = {
  inc(tags?: Tags, value?: number): void
  value(tags?: Tags): number
}

export type HistogramSnapshot = {
  count: number
  sum: number
  buckets: Array<{ le: number; count: number }>
  p50: number
  p95: number
  min: number
  max: number
  avg: number
}

export type Histogram = {
  observe(value: number, tags?: Tags): void
  snapshot(tags?: Tags): HistogramSnapshot
}

export type CounterOptions = {
  labels?: string[]
  help?: string
}

export type HistogramOptions = {
  buckets: number[]
  labels?: string[]
  help?: string
}

export type MetricsRegistry = {
  counter(name: string, opts?: CounterOptions): Counter
  histogram(name: string, opts?: HistogramOptions): Histogram
  /**
   * Returns a JSON-serializable view of every registered metric.
   * Useful for a Prometheus-style exposition endpoint or debug dump.
   */
  snapshot(): Record<string, unknown>
  /** Reset all metric state. Primarily for tests. */
  reset(): void
}
