/**
 * Common workflow store actions and utilities
 * Centralizes repeated patterns to reduce code duplication
 *
 * @module stores/workflows/common/actions
 *
 * Note: This module only contains state update utilities.
 * Validators are in validators.ts
 * Optimizations are in optimizations.ts
 */
import { WorkflowStoreWithHistory } from '../middleware'
import { workflowSync } from '../sync'

/**
 * Common state update pattern with history and sync
 */
export interface StateUpdateOptions {
  historyMessage?: string
  skipHistory?: boolean
  skipSync?: boolean
  skipSave?: boolean
}

/**
 * Creates a standardized state update function
 * Handles history, sync, and save operations consistently
 */
export function createStateUpdater(
  safeSet: (partial: any) => void,
  get: () => WorkflowStoreWithHistory,
  pushHistory: (safeSet: any, get: any, state: any, message: string) => void
) {
  return (newState: Partial<WorkflowStoreWithHistory>, options: StateUpdateOptions = {}) => {
    const {
      historyMessage = 'Update state',
      skipHistory = false,
      skipSync = false,
      skipSave = false,
    } = options

    // Apply state update
    safeSet(newState)

    // Add to history if not skipped
    if (!skipHistory) {
      pushHistory(safeSet, get, newState, historyMessage)
    }

    // Update last saved timestamp if not skipped
    if (!skipSave) {
      get().updateLastSaved()
    }

    // Sync with database if not skipped
    if (!skipSync) {
      workflowSync.syncUserAction()
    }
  }
}
