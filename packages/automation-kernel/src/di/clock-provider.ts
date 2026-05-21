/**
 * Time source for the executor. Injected so tests can use a fake clock and
 * so schedulers can share a single authoritative clock.
 */
export interface ClockProvider {
  now(): number
  sleep(ms: number, signal?: AbortSignal): Promise<void>
}
