/**
 * Metrics recorded by the kernel for a single block execution.
 * Kept intentionally loose at Phase 0 — concrete shape will be tightened
 * when the executor is migrated in Phase 1.
 */
export interface BlockMetrics {
  startedAt: number
  endedAt: number
  durationMs: number
  cost?: number
  tokens?: {
    input?: number
    output?: number
    total?: number
  }
  [key: string]: unknown
}

/**
 * Contract every block handler must satisfy.
 *
 * Handlers are registered with `HandlerRegistry` by `blockType` and invoked
 * by the executor. `context` is intentionally `unknown` at Phase 0; it will
 * be narrowed to `ExecutionContext` once the executor is migrated.
 */
export interface BlockHandler<TInput = unknown, TOutput = unknown> {
  readonly blockType: string
  execute(input: TInput, context: unknown): Promise<TOutput>
}
