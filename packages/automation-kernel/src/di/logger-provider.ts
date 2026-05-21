/**
 * Structured logger the executor uses for diagnostic events. Mirrors the
 * small subset of the NowFlow app logger so it can be adapted trivially.
 */
export interface LoggerProvider {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
  child?(bindings: Record<string, unknown>): LoggerProvider
}
