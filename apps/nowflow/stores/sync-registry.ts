'use client'

import { createLogger } from '@/lib/logs/console-logger'
import { SyncManager } from './sync'
import { isLocalStorageMode } from './sync-core'
import { useWorkflowRegistry } from './workflows/registry/store'
import { fetchWorkflowsFromDB, workflowSync } from './workflows/sync'

const logger = createLogger('SyncRegistry')

// Initialize managers lazily
let initialized = false
let initializing = false
let managers: SyncManager[] = []
let initializationPromise: Promise<boolean> | null = null

const ACTIVE_WORKSPACE_KEY = 'active-workspace-id'

async function ensureActiveWorkspaceId(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const response = await fetch('/api/workspaces', { method: 'GET' })
    if (!response.ok) return

    const data = await response.json()
    const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : []
    if (workspaces.length === 0) return

    const { activeWorkspaceId } = useWorkflowRegistry.getState()
    const activeWorkspaceExists = activeWorkspaceId
      ? workspaces.some((workspace: { id?: string }) => workspace.id === activeWorkspaceId)
      : false
    const workspaceId = activeWorkspaceExists ? activeWorkspaceId : workspaces[0]?.id

    if (!workspaceId || activeWorkspaceExists) return

    useWorkflowRegistry.setState({ activeWorkspaceId: workspaceId })
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId)
    logger.info('Active workspace initialized before sync', {
      workspaceId,
      previousWorkspaceId: activeWorkspaceId || 'none',
    })
  } catch (error) {
    logger.debug('Workspace bootstrap skipped', { error })
  }
}

/**
 * Initialize sync managers and fetch data from DB
 * Returns a promise that resolves when initialization is complete
 *
 * Note: Workflow scheduling is handled automatically by the workflowSync manager
 * when workflows are synced to the database. The scheduling logic checks if a
 * workflow has scheduling enabled in its starter block and updates the schedule
 * accordingly.
 */
export async function initializeSyncManagers(): Promise<boolean> {
  // Skip if already initialized or initializing
  if (initialized) {
    return true
  }

  if (initializing && initializationPromise) {
    return initializationPromise
  }

  initializing = true
  initializationPromise = (async () => {
    try {
      // Skip DB sync in local storage mode
      if (isLocalStorageMode()) {
        managers = [workflowSync]
        initialized = true
        return true
      }

      // Initialize sync managers
      managers = [workflowSync]

      // Ensure active workspace is set before first fetch to avoid duplicate loads
      await ensureActiveWorkspaceId()

      // Fetch data from DB
      try {
        // Remove environment variables fetch
        await fetchWorkflowsFromDB()
      } catch (error) {
        logger.error('Error fetching data from DB:', { error })
      }

      initialized = true
      return true
    } catch (error) {
      logger.error('Error initializing sync managers:', { error })
      return false
    } finally {
      initializing = false
    }
  })()

  const result = await initializationPromise
  if (!result) {
    initializationPromise = null
  }
  return result
}

/**
 * Check if sync managers are initialized
 */
export function isSyncInitialized(): boolean {
  return initialized
}

/**
 * Get all sync managers
 */
export function getSyncManagers(): SyncManager[] {
  return managers
}

/**
 * Reset all sync managers
 */
export function resetSyncManagers(): void {
  initialized = false
  initializing = false
  managers = []
  initializationPromise = null
}

// Export individual sync managers for direct use
export { workflowSync }
