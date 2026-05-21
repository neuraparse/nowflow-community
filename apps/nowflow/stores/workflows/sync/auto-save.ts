/**
 * Auto-save integration for workflows.
 * Periodically creates auto-save versions of the active workflow.
 */
import { createAutoSaveVersion, shouldAutoSave } from '@/lib/workflows/auto-save-service'
import { useWorkflowStore } from '../workflow/store'
import { AUTO_SAVE_CHECK_INTERVAL, AUTO_SAVE_MIN_INTERVAL } from './constants'
import {
  autoSaveTimer,
  autoSaveUserId,
  autoSaveWorkflowId,
  lastAutoSaveState,
  lastAutoSaveTime,
  logger,
  setAutoSaveTimer,
  setAutoSaveUserId,
  setAutoSaveWorkflowId,
  setLastAutoSaveState,
  setLastAutoSaveTime,
} from './state'

/**
 * Initialize auto-save for a workflow
 * Called when a workflow becomes active
 */
export function initAutoSave(workflowId: string, userId: string): void {
  // Stop any existing auto-save
  stopAutoSave()

  setAutoSaveWorkflowId(workflowId)
  setAutoSaveUserId(userId)

  // Capture initial state for comparison
  const currentState = useWorkflowStore.getState()
  setLastAutoSaveState({
    blocks: JSON.parse(JSON.stringify(currentState.blocks || {})),
    edges: JSON.parse(JSON.stringify(currentState.edges || [])),
    loops: JSON.parse(JSON.stringify(currentState.loops || {})),
    groups: JSON.parse(JSON.stringify(currentState.groups || {})),
  })
  setLastAutoSaveTime(Date.now())

  // Start auto-save check interval
  setAutoSaveTimer(setInterval(checkAutoSave, AUTO_SAVE_CHECK_INTERVAL))
  logger.debug(`📦 Auto-save initialized for workflow ${workflowId}`)
}

/**
 * Stop auto-save for the current workflow
 */
export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    setAutoSaveTimer(null)
  }
  setAutoSaveWorkflowId(null)
  setAutoSaveUserId(null)
  setLastAutoSaveState(null)
  logger.debug('📦 Auto-save stopped')
}

/**
 * Check if auto-save should trigger
 * Called periodically by the auto-save timer
 */
async function checkAutoSave(): Promise<void> {
  if (!autoSaveWorkflowId || !autoSaveUserId) {
    return
  }

  // Check minimum interval
  const timeSinceLastAutoSave = Date.now() - lastAutoSaveTime
  if (timeSinceLastAutoSave < AUTO_SAVE_MIN_INTERVAL) {
    logger.debug(
      `⏸️ Auto-save skipped - too soon (${Math.round(timeSinceLastAutoSave / 1000)}s since last)`
    )
    return
  }

  try {
    // Get current state
    const currentState = useWorkflowStore.getState()
    const currentStateSnapshot = {
      blocks: currentState.blocks || {},
      edges: currentState.edges || [],
      loops: currentState.loops || {},
      groups: currentState.groups || {},
    }

    // Check if auto-save should trigger using the service
    const shouldSave = await shouldAutoSave(autoSaveWorkflowId)

    if (shouldSave) {
      logger.debug('📦 Auto-save triggered - significant changes detected')

      // Create auto-save version
      const version = await createAutoSaveVersion(
        autoSaveWorkflowId,
        autoSaveUserId,
        lastAutoSaveState,
        currentStateSnapshot
      )

      if (version) {
        logger.debug(`✅ Auto-save version created: v${version.versionNumber}`)

        // Update tracking state
        setLastAutoSaveTime(Date.now())
        setLastAutoSaveState(JSON.parse(JSON.stringify(currentStateSnapshot)))
      }
    } else {
      logger.debug('⏸️ Auto-save skipped - no significant changes')
    }
  } catch (error) {
    logger.error('❌ Auto-save check failed:', error)
  }
}

/**
 * Trigger auto-save manually (e.g., before closing or navigating away)
 */
export async function triggerAutoSave(): Promise<boolean> {
  if (!autoSaveWorkflowId || !autoSaveUserId) {
    return false
  }

  try {
    const currentState = useWorkflowStore.getState()
    const currentStateSnapshot = {
      blocks: currentState.blocks || {},
      edges: currentState.edges || [],
      loops: currentState.loops || {},
      groups: currentState.groups || {},
    }

    // Force create auto-save version
    const version = await createAutoSaveVersion(
      autoSaveWorkflowId,
      autoSaveUserId,
      lastAutoSaveState,
      currentStateSnapshot
    )

    if (version) {
      logger.debug(`✅ Manual auto-save created: v${version.versionNumber}`)
      setLastAutoSaveTime(Date.now())
      setLastAutoSaveState(JSON.parse(JSON.stringify(currentStateSnapshot)))
      return true
    }

    return false
  } catch (error) {
    logger.error('❌ Manual auto-save failed:', error)
    return false
  }
}

/**
 * Get auto-save status for UI display
 */
export function getAutoSaveStatus(): {
  isEnabled: boolean
  lastAutoSaveTime: number
  workflowId: string | null
} {
  return {
    isEnabled: autoSaveTimer !== null,
    lastAutoSaveTime,
    workflowId: autoSaveWorkflowId,
  }
}
