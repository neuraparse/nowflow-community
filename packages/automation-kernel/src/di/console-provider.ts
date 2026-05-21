/**
 * A single entry in the workflow console (what the user sees while a
 * workflow runs). Kept loose at Phase 0.
 */
export interface ConsoleEntry {
  id: string
  blockId?: string
  blockName?: string
  level?: 'info' | 'warn' | 'error' | 'debug'
  message?: string
  output?: unknown
  input?: unknown
  error?: { message: string; stack?: string }
  startedAt?: number
  endedAt?: number
  durationMs?: number
  [key: string]: unknown
}

/**
 * Surface for the executor to append structured entries to the run console.
 */
export interface ConsoleProvider {
  append(entry: ConsoleEntry): void
  update(id: string, patch: Partial<ConsoleEntry>): void
  clear(): void
  list(): ConsoleEntry[]
}
