import type { BlockMetrics } from '../handlers/types'

/**
 * Surface for the executor to publish block-level runtime state
 * (active/completed/errored blocks, per-block metrics) to whatever outer
 * state container the host application uses (e.g. a Zustand store in the
 * UI, a no-op sink on the server).
 */
export interface StateProvider {
  setActiveBlocks(ids: string[]): void
  setCompletedBlock(id: string, output: unknown): void
  setErrorBlock(id: string, error: Error): void
  setBlockMetrics(id: string, metrics: BlockMetrics): void
  reset(): void
}
