import type { BlockMetrics } from '../../handlers/types'
import type { StateProvider } from '../state-provider'

/**
 * In-memory `StateProvider` used by tests and local development. Captures
 * the last state transitions so assertions can introspect them directly.
 */
export class InMemoryStateProvider implements StateProvider {
  activeBlocks: string[] = []
  completed = new Map<string, unknown>()
  errors = new Map<string, Error>()
  metrics = new Map<string, BlockMetrics>()

  setActiveBlocks(ids: string[]): void {
    this.activeBlocks = [...ids]
  }

  setCompletedBlock(id: string, output: unknown): void {
    this.completed.set(id, output)
  }

  setErrorBlock(id: string, error: Error): void {
    this.errors.set(id, error)
  }

  setBlockMetrics(id: string, metrics: BlockMetrics): void {
    this.metrics.set(id, metrics)
  }

  reset(): void {
    this.activeBlocks = []
    this.completed.clear()
    this.errors.clear()
    this.metrics.clear()
  }
}
