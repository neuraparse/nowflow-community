/**
 * Batch operation actions slice for the workflow store.
 * Handles batch block updates, batch edge updates, and batch deletions.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { useValidationStore } from '../../../validation/store'
import { validateBatchUpdates } from '../../common/validators'
import { pushHistory } from '../../middleware'
import { useWorkflowRegistry } from '../../registry/store'
import { useSubBlockStore } from '../../subblock/store'
import { workflowSync } from '../../sync'
import { BatchBlockUpdate, BatchEdgeUpdate } from '../types'

const logger = createLogger('WorkflowStore')

export type BatchActionsSliceDeps = {
  safeSet: any
  get: any
  batchBlockUpdater: (updates: BatchBlockUpdate[]) => any
  batchEdgeUpdater: (updates: BatchEdgeUpdate[]) => any
  batchBlockDeleter: (blockIds: string[]) => any
}

export function createBatchActionsSlice({
  safeSet,
  get,
  batchBlockUpdater,
  batchEdgeUpdater,
  batchBlockDeleter,
}: BatchActionsSliceDeps) {
  return {
    /**
     * Batch update multiple blocks at once for better performance
     */
    batchUpdateBlocks: (updates: BatchBlockUpdate[]) => {
      const validation = validateBatchUpdates(updates)
      if (!validation.valid) {
        logger.debug(validation.error ?? 'Batch block update validation failed')
        return
      }

      const newState = batchBlockUpdater(updates)
      if (!newState) return

      safeSet(newState)
      pushHistory(safeSet, get, newState, `Batch update ${updates.length} blocks`)
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    /**
     * Batch update multiple edges at once for better performance
     */
    batchUpdateEdges: (updates: BatchEdgeUpdate[]) => {
      const validation = validateBatchUpdates(updates)
      if (!validation.valid) {
        logger.debug(validation.error ?? 'Batch edge update validation failed')
        return
      }

      const newState = batchEdgeUpdater(updates)
      if (!newState) return

      safeSet(newState)
      pushHistory(safeSet, get, newState, `Batch update ${updates.length} edges`)
      get().updateLastSaved()
      workflowSync.syncImmediate()
    },

    /**
     * Batch delete multiple blocks and their connections
     */
    batchDeleteBlocks: (blockIds: string[]) => {
      if (!blockIds || blockIds.length === 0) {
        logger.debug('No block IDs provided for batch delete')
        return
      }

      // Filter out starter blocks — they cannot be deleted
      const blocks = get().blocks
      const filteredIds = blockIds.filter((id) => {
        if (blocks[id]?.type === 'starter') {
          logger.warn('Cannot delete the starter block')
          return false
        }
        return true
      })

      if (filteredIds.length === 0) {
        logger.debug('No deletable blocks after filtering starter blocks')
        return
      }

      const subBlockStore = useSubBlockStore.getState()
      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId

      const newState = batchBlockDeleter(filteredIds)
      if (!newState) return

      // Clean up subblock values
      if (activeWorkflowId) {
        const updatedWorkflowValues = {
          ...(subBlockStore.workflowValues[activeWorkflowId] || {}),
        }

        filteredIds.forEach((id) => {
          delete updatedWorkflowValues[id]
        })

        useSubBlockStore.setState((state: any) => ({
          workflowValues: {
            ...state.workflowValues,
            [activeWorkflowId]: updatedWorkflowValues,
          },
        }))
      }

      // Clean up validation errors for all deleted blocks
      const validationStore = useValidationStore.getState()
      filteredIds.forEach((id) => {
        validationStore.clearBlock(id)
      })

      safeSet(newState)
      pushHistory(safeSet, get, newState, `Batch delete ${filteredIds.length} blocks`)
      get().updateLastSaved()
      get().markDurableChange()
      workflowSync.syncImmediate()
    },
  }
}
