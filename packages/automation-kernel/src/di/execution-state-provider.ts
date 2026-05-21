/**
 * Persists per-execution state so a run can survive process boundaries
 * (e.g. durable execution, pause/resume, cross-request webhook triggers).
 *
 * The stored shape is opaque to the kernel — hosts choose serialization.
 */
export interface ExecutionStateProvider {
  load(executionId: string): Promise<unknown | undefined>
  save(executionId: string, state: unknown): Promise<void>
  delete(executionId: string): Promise<void>
}
