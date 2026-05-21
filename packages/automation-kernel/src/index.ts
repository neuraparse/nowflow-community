/**
 * `@nowflow/automation-kernel` — public entry point.
 *
 * Re-exports the DI provider interfaces, handler contracts and the in-memory
 * implementations used by tests and local development.
 */

// DI provider interfaces
export * from './di/state-provider'
export * from './di/console-provider'
export * from './di/secret-provider'
export * from './di/http-provider'
export * from './di/execution-state-provider'
export * from './di/clock-provider'
export * from './di/logger-provider'
export * from './di/experiment-provider'
export * from './di/executor-deps'

// Handler contracts + registry
export * from './handlers/types'
export * from './handlers/registry'

// In-memory implementations (tests / dev)
export { InMemoryStateProvider } from './di/in-memory/state-provider'
export { InMemoryConsoleProvider } from './di/in-memory/console-provider'
export { SystemClockProvider } from './di/in-memory/clock-provider'
