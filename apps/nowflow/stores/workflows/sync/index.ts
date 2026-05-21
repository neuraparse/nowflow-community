/**
 * Barrel file for the workflow sync module.
 * Re-exports all public APIs to maintain backward compatibility with imports from '../sync'.
 */

// State utilities
export {
  updateLastUserActionTime,
  getLastUserActionTime,
  isActivelyLoadingFromDB,
  isActivelyWorkspaceSwitching,
  startWorkspaceSwitch,
  endWorkspaceSwitch,
} from './state'

// Fetch
export { fetchWorkflowsFromDB } from './fetch'

// Sync manager
export { workflowSync } from './sync-manager'

// Polling
export { startAutoPolling, stopAutoPolling, pausePolling, resumePolling } from './polling'

// Auto-save
export { initAutoSave, stopAutoSave, triggerAutoSave, getAutoSaveStatus } from './auto-save'
