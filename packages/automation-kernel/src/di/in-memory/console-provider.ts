import type { ConsoleEntry, ConsoleProvider } from '../console-provider'

/**
 * In-memory `ConsoleProvider` used by tests and local development.
 */
export class InMemoryConsoleProvider implements ConsoleProvider {
  entries: ConsoleEntry[] = []

  append(entry: ConsoleEntry): void {
    this.entries.push({ ...entry })
  }

  update(id: string, patch: Partial<ConsoleEntry>): void {
    const idx = this.entries.findIndex((e) => e.id === id)
    if (idx === -1) return
    this.entries[idx] = { ...this.entries[idx], ...patch }
  }

  clear(): void {
    this.entries = []
  }

  list(): ConsoleEntry[] {
    return [...this.entries]
  }
}
