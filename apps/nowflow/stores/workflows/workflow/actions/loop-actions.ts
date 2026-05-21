/**
 * Loop management actions slice for the workflow store.
 */
import { pushHistory } from '../../middleware'
import { workflowSync } from '../../sync'
import { Loop } from '../types'

export type LoopActionsSliceDeps = {
  safeSet: any
  get: any
}

export function createLoopActionsSlice({ safeSet, get }: LoopActionsSliceDeps) {
  return {
    updateLoopIterations: (loopId: string, iterations: number) => {
      const newState = {
        blocks: { ...get().blocks },
        edges: [...get().edges],
        loops: {
          ...get().loops,
          [loopId]: {
            ...get().loops[loopId],
            iterations: Math.max(1, Math.min(50, iterations)),
          },
        },
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Update loop iterations')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateLoopType: (loopId: string, loopType: Loop['loopType']) => {
      const newState = {
        blocks: { ...get().blocks },
        edges: [...get().edges],
        loops: {
          ...get().loops,
          [loopId]: {
            ...get().loops[loopId],
            loopType,
          },
        },
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Update loop type')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    updateLoopForEachItems: (loopId: string, items: string) => {
      const newState = {
        blocks: { ...get().blocks },
        edges: [...get().edges],
        loops: {
          ...get().loops,
          [loopId]: {
            ...get().loops[loopId],
            forEachItems: items,
          },
        },
      }

      safeSet(newState)
      pushHistory(safeSet, get, newState, 'Update forEach items')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },
  }
}
