/**
 * Code-execution dispatcher.
 *
 * The Function/Code block calls `selectRunner()` and runs whatever comes back.
 * Runner order in `RUNNERS` is priority order — the first runner whose
 * `isAvailable()` returns true wins. An operator can pin a specific backend
 * via `CODE_RUNNER=<id>` for forced testing.
 *
 * To add a new backend (Python, Docker, isolated-vm, …): implement the
 * `CodeRunner` interface in a sibling file and append it to `RUNNERS`.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { quickjsRunner } from './quickjs-runner'
import type { CodeRunner } from './types'

export type { CodeRunRequest, CodeRunResult, CodeRunner } from './types'
export { quickjsRunner } from './quickjs-runner'

const logger = createLogger('CodeRunner')

const RUNNERS: readonly CodeRunner[] = [quickjsRunner]

/**
 * Returns the first available runner, optionally honouring a `CODE_RUNNER`
 * environment override.
 *
 * Throws if a forced runner is set but unavailable, or if no runner at all is
 * available. The dispatcher does NOT silently fall back when a forced runner
 * fails its availability check — that would mask configuration mistakes.
 */
export function selectRunner(): CodeRunner {
  const forcedId = process.env.CODE_RUNNER?.trim()
  if (forcedId) {
    const forced = RUNNERS.find((r) => r.id === forcedId)
    if (!forced) {
      throw new Error(
        `CODE_RUNNER='${forcedId}' but no runner is registered with that id ` +
          `(known: ${RUNNERS.map((r) => r.id).join(', ')})`
      )
    }
    if (!forced.isAvailable()) {
      throw new Error(`CODE_RUNNER='${forcedId}' is registered but not available in this env`)
    }
    return forced
  }
  for (const r of RUNNERS) {
    if (r.isAvailable()) return r
  }
  throw new Error('No code runner is available')
}

/**
 * Diagnostic helper for `/api/health` or operator scripts: returns every
 * runner along with its current availability + capabilities. Cheap (no
 * execution), safe to call on every request.
 */
export function listRunners() {
  return RUNNERS.map((r) => ({
    id: r.id,
    name: r.name,
    available: r.isAvailable(),
    capabilities: r.capabilities,
  }))
}

// One-time startup snapshot so operators can see the runner topology in the
// boot logs without running a healthcheck. Emitted at WARN so it survives the
// production logger's INFO-and-below filter (lib/logs/console-logger.ts sets
// `minLevel: WARN` in NODE_ENV=production); fires exactly once per process.
let bootSnapshotLogged = false
export function logRunnerSnapshotOnce() {
  if (bootSnapshotLogged) return
  bootSnapshotLogged = true
  const snapshot = listRunners()
  const active = snapshot.find((r) => r.available)
  logger.warn('Code runner topology', {
    activeRunner: active?.id ?? null,
    runners: snapshot,
  })
}
