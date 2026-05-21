import type { ClockProvider } from './clock-provider'
import type { ConsoleProvider } from './console-provider'
import type { ExecutionStateProvider } from './execution-state-provider'
import type { ExperimentProvider } from './experiment-provider'
import type { HttpProvider } from './http-provider'
import type { LoggerProvider } from './logger-provider'
import type { SecretProvider } from './secret-provider'
import type { StateProvider } from './state-provider'

/**
 * Aggregate of every provider the kernel executor depends on. Hosts
 * construct one of these (typically once per request / run) and hand it to
 * the executor entry point.
 */
export interface ExecutorDeps {
  state: StateProvider
  console: ConsoleProvider
  secrets: SecretProvider
  http: HttpProvider
  executionState: ExecutionStateProvider
  clock: ClockProvider
  logger: LoggerProvider
  experiments: ExperimentProvider
}
