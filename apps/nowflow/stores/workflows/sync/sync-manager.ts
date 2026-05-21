'use client'

/**
 * Workflow sync manager - orchestrates sync operations with different strategies.
 * Provides background sync, user-action sync, and immediate sync.
 */
import { getAllWorkflowsWithValues } from '..'
import { API_ENDPOINTS } from '../../constants'
import { createSingletonSyncManager } from '../../sync'
import { performSync } from '../../sync-core'
import { useWorkflowRegistry } from '../registry/store'
import { useWorkflowStore } from '../workflow/store'
import {
  BACKGROUND_SYNC_DEBOUNCE,
  IMMEDIATE_SYNC_DEBOUNCE,
  MAX_CONSECUTIVE_FAILURES,
  USER_ACTION_DEBOUNCE,
} from './constants'
import { _setWorkflowSyncRef, fetchWorkflowsFromDB, throttledFetchWorkflows } from './fetch'
import { getAdaptivePollingInterval, isSSEHealthy, pausePolling, resumePolling } from './polling'
import {
  backgroundSyncTimer,
  consecutiveFailures,
  hasLoggedPendingSync,
  hasPendingSync,
  immediateSyncTimer,
  incrementConsecutiveFailures,
  isActivelyLoadingFromDB,
  isActivelyWorkspaceSwitching,
  isOnline,
  isSyncInProgress,
  loadingFromDBStartTime,
  loadingFromDBToken,
  logger,
  pendingSyncAfterCurrent,
  setBackgroundSyncTimer,
  setConsecutiveFailures,
  setHasLoggedPendingSync,
  setHasPendingSync,
  setImmediateSyncTimer,
  setIsOnline,
  setIsSyncInProgress,
  setLoadingFromDBToken,
  setPendingSyncAfterCurrent,
  setUserActionSyncTimer,
  userActionSyncTimer,
} from './state'
import {
  isSSEConnected,
  lastSSEUpdateTime,
  setIsSSEConnected,
  setLastSSEUpdateTime,
  setSSEDebounceTimer,
  setSSEUpdateReceived,
  sseDebounceTimer,
} from './state'

/**
 * SMART SYNC LOGIC: Check if we should sync based on interaction state
 */
function shouldSyncBasedOnInteraction(): boolean {
  if (typeof window === 'undefined') return true

  const workflowState = useWorkflowStore.getState()
  const interaction = workflowState.interaction

  if (interaction?.isDragging) {
    logger.debug('⏸️ Skipping sync - user is dragging')
    return false
  }

  if (interaction?.isEditing) {
    logger.debug('⏸️ Skipping sync - user is editing')
    return false
  }

  const timeSinceLastInteraction = Date.now() - (interaction?.lastInteractionTime || 0)
  const timeSinceLastDurableChange = Date.now() - (interaction?.lastDurableChangeTime || 0)

  if (timeSinceLastInteraction < 500 && timeSinceLastDurableChange > 5000) {
    logger.debug('⏸️ Skipping sync - ephemeral interaction (no durable changes)')
    return false
  }

  return true
}

// Create the basic sync configuration
const workflowSyncConfig = {
  endpoint: API_ENDPOINTS.SYNC,
  preparePayload: () => {
    if (typeof window === 'undefined') return {}

    if (isActivelyWorkspaceSwitching()) {
      logger.warn(
        '⏸️ CRITICAL: Skipping workflow sync during workspace transition to prevent data loss'
      )
      return { skipSync: true }
    }

    if (isActivelyLoadingFromDB()) {
      logger.debug('⏸️ Skipping background sync while loading from DB')
      return { skipSync: true }
    }

    const allWorkflowsData = getAllWorkflowsWithValues()

    logger.debug(`AI Sync Debug: Raw workflow data from getAllWorkflowsWithValues:`, {
      workflowCount: Object.keys(allWorkflowsData).length,
      workflowIds: Object.keys(allWorkflowsData),
      sampleWorkflow: Object.values(allWorkflowsData)[0]
        ? {
            id: Object.values(allWorkflowsData)[0].id,
            hasState: !!Object.values(allWorkflowsData)[0].state,
            stateKeys: Object.values(allWorkflowsData)[0].state
              ? Object.keys(Object.values(allWorkflowsData)[0].state)
              : [],
            edgesCount: Object.values(allWorkflowsData)[0].state?.edges?.length || 'undefined',
            edgesType: typeof Object.values(allWorkflowsData)[0].state?.edges,
            loopsType: typeof Object.values(allWorkflowsData)[0].state?.loops,
            loopsValue: Object.values(allWorkflowsData)[0].state?.loops,
          }
        : 'no workflows',
    })

    const activeWorkspaceId = useWorkflowRegistry.getState().activeWorkspaceId

    if (Object.keys(allWorkflowsData).length === 0) {
      const registryWorkflows = useWorkflowRegistry.getState().workflows
      if (Object.keys(registryWorkflows).length > 0) {
        logger.warn(
          'Potential data loss prevented: Registry has workflows but sync payload is empty'
        )
        return { skipSync: true }
      }

      logger.debug('Skipping workflow sync - no workflows to sync')
      return { skipSync: true }
    }

    const workflowsData: Record<string, any> = {}
    Object.entries(allWorkflowsData).forEach(([id, workflow]) => {
      if (!workflow.workspaceId && activeWorkspaceId) {
        workflow.workspaceId = activeWorkspaceId
        logger.debug(`Assigning workspace ${activeWorkspaceId} to orphaned workflow ${id}`)
      }

      logger.debug(`AI Sync Validation for workflow ${id}:`, {
        hasState: !!workflow.state,
        stateKeys: workflow.state ? Object.keys(workflow.state) : [],
        edgesType: typeof workflow.state?.edges,
        edgesValue: workflow.state?.edges,
        edgesLength: Array.isArray(workflow.state?.edges)
          ? workflow.state.edges.length
          : 'not array',
        loopsType: typeof workflow.state?.loops,
        loopsValue: workflow.state?.loops,
        workspaceId: workflow.workspaceId,
        activeWorkspace: activeWorkspaceId,
      })

      workflowsData[id] = workflow

      if (workflow.workspaceId !== activeWorkspaceId && workflow.workspaceId) {
        logger.debug(
          `Including workflow ${id} from workspace ${workflow.workspaceId} (active: ${activeWorkspaceId})`
        )
      }
    })

    if (Object.keys(workflowsData).length === 0) {
      logger.debug('Skipping workflow sync - no workflows for active workspace to sync')
      return { skipSync: true }
    }

    return {
      workflows: workflowsData,
      workspaceId: activeWorkspaceId,
    }
  },
  method: 'POST' as const,
  syncOnInterval: true,
  syncInterval: BACKGROUND_SYNC_DEBOUNCE,
  syncOnExit: true,
  onSyncSuccess: async () => {
    logger.debug('Workflows synced to DB successfully')
  },
}

// Create the base sync manager
const baseWorkflowSync = createSingletonSyncManager('workflow-sync', () => workflowSyncConfig)

/**
 * Smart sync manager with different strategies for different sync scenarios.
 */
export const workflowSync = {
  ...baseWorkflowSync,

  // Background sync - long debounce for automatic syncing
  sync: () => {
    if (!isOnline) {
      setHasPendingSync(true)
      logger.debug('📴 Offline - sync queued for when connection returns')
      return
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.debug('Skipping background sync due to consecutive failures')
      return
    }

    if (backgroundSyncTimer) {
      clearTimeout(backgroundSyncTimer)
    }

    setBackgroundSyncTimer(
      setTimeout(async () => {
        try {
          logger.debug('Performing background sync')
          const success = await performSync(workflowSyncConfig)

          if (success) {
            setConsecutiveFailures(0)
            setHasPendingSync(false)
            if (typeof window !== 'undefined') {
              localStorage.setItem('last_db_sync_timestamp', Date.now().toString())
            }
          } else {
            incrementConsecutiveFailures()
            setHasPendingSync(true)
          }
        } catch (error) {
          incrementConsecutiveFailures()
          setHasPendingSync(true)
          logger.debug(
            `Background sync failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
            error
          )
        }
      }, BACKGROUND_SYNC_DEBOUNCE)
    )
  },

  // User action sync - INSTANT sync for user interactions
  syncUserAction: () => {
    if (!shouldSyncBasedOnInteraction()) {
      logger.debug('⏸️ User action sync skipped - ephemeral interaction')
      return
    }

    if (loadingFromDBToken) {
      const elapsedTime = Date.now() - loadingFromDBStartTime

      if (!hasLoggedPendingSync) {
        logger.debug(
          `⏸️ User action sync deferred while loading from DB (${elapsedTime}ms elapsed)`
        )
        setHasLoggedPendingSync(true)
      }

      setPendingSyncAfterCurrent(true)

      if (elapsedTime > 2000) {
        logger.warn('⚠️ Loading timeout - forcing user action sync to proceed')
        setLoadingFromDBToken(null)
        setHasLoggedPendingSync(false)
      } else {
        setTimeout(() => {
          if (!loadingFromDBToken) {
            logger.debug('🔄 Loading complete - executing queued user action sync')
            setHasLoggedPendingSync(false)
            workflowSync.syncUserAction()
          }
        }, 100)
        return
      }
    }

    if (!isOnline) {
      setHasPendingSync(true)
      logger.debug('📴 Offline - user action sync queued for when connection returns')
      return
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.debug('Skipping user action sync due to consecutive failures')
      return
    }

    const performUserActionSyncNow = async () => {
      try {
        logger.debug('⚡ Performing ultra-fast user action sync')
        const success = await performSync(workflowSyncConfig)

        if (success) {
          setConsecutiveFailures(0)
          setHasPendingSync(false)
          if (typeof window !== 'undefined') {
            localStorage.setItem('last_db_sync_timestamp', Date.now().toString())
          }
        } else {
          incrementConsecutiveFailures()
          setHasPendingSync(true)
          logger.warn('User action sync failed')
        }
      } catch (error) {
        incrementConsecutiveFailures()
        setHasPendingSync(true)
        logger.error(
          `User action sync error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
          error
        )
      } finally {
        setUserActionSyncTimer(null)
      }
    }

    if (!userActionSyncTimer) {
      logger.debug('⚡ First user action - executing sync immediately (0ms delay)')
      setUserActionSyncTimer(setTimeout(performUserActionSyncNow, 0))
    } else {
      logger.debug(`📦 Batching rapid user action (${USER_ACTION_DEBOUNCE}ms debounce)`)
      clearTimeout(userActionSyncTimer)
      setUserActionSyncTimer(setTimeout(performUserActionSyncNow, USER_ACTION_DEBOUNCE))
    }
  },

  // IMMEDIATE sync for critical operations (block add/delete/connect)
  syncImmediate: async () => {
    if (loadingFromDBToken) {
      const elapsedTime = Date.now() - loadingFromDBStartTime

      if (!hasLoggedPendingSync) {
        logger.warn(
          `⚠️ Sync requested while loading from DB (${elapsedTime}ms elapsed) - will retry after load completes`
        )
        setHasLoggedPendingSync(true)
      }

      setPendingSyncAfterCurrent(true)

      if (elapsedTime > 2000) {
        logger.warn('⚠️ Loading timeout - forcing sync to proceed')
        setLoadingFromDBToken(null)
        setHasLoggedPendingSync(false)
      } else {
        setTimeout(() => {
          if (!loadingFromDBToken) {
            logger.debug('🔄 Loading complete - executing queued immediate sync')
            setHasLoggedPendingSync(false)
            workflowSync.syncImmediate()
          }
        }, 100)
        return
      }
    }

    if (userActionSyncTimer) {
      clearTimeout(userActionSyncTimer)
      setUserActionSyncTimer(null)
    }
    if (backgroundSyncTimer) {
      clearTimeout(backgroundSyncTimer)
      setBackgroundSyncTimer(null)
    }

    if (!isOnline) {
      setHasPendingSync(true)
      logger.warn(
        '📴 OFFLINE - Cannot sync to database immediately, but data is safe in localStorage and will sync when connection returns'
      )
      return
    }

    if (isSyncInProgress) {
      setPendingSyncAfterCurrent(true)
      logger.debug('🔒 Sync in progress - queuing next sync')
      return
    }

    const performImmediateSyncNow = async () => {
      if (isSyncInProgress) {
        setPendingSyncAfterCurrent(true)
        logger.debug('🔒 Sync started during execution - queuing')
        return
      }

      setIsSyncInProgress(true)
      logger.debug('⚡ ULTRA-FAST SYNC - Immediate execution')

      if (typeof window !== 'undefined') {
        localStorage.removeItem('last_db_sync_timestamp')
      }

      try {
        const success = await performSync(workflowSyncConfig)

        if (success) {
          setConsecutiveFailures(0)
          setHasPendingSync(false)
          logger.debug('✅ Immediate sync completed successfully')
          if (typeof window !== 'undefined') {
            localStorage.setItem('last_db_sync_timestamp', Date.now().toString())
          }
        } else {
          incrementConsecutiveFailures()
          setHasPendingSync(true)
          logger.warn('❌ Immediate sync failed')
        }
      } catch (error) {
        incrementConsecutiveFailures()
        setHasPendingSync(true)
        logger.error('❌ IMMEDIATE SYNC FAILED:', error)
      } finally {
        setIsSyncInProgress(false)
        setImmediateSyncTimer(null)

        if (pendingSyncAfterCurrent) {
          setPendingSyncAfterCurrent(false)
          logger.debug('🔄 Executing queued sync after previous completed')
          setTimeout(() => {
            workflowSync.syncImmediate()
          }, 10)
        }
      }
    }

    if (!immediateSyncTimer) {
      logger.debug('⚡ First operation - executing sync immediately (0ms delay)')
      setImmediateSyncTimer(setTimeout(performImmediateSyncNow, 0))
    } else {
      logger.debug(`📦 Batching rapid operation (${IMMEDIATE_SYNC_DEBOUNCE}ms debounce)`)
      clearTimeout(immediateSyncTimer)
      setImmediateSyncTimer(setTimeout(performImmediateSyncNow, IMMEDIATE_SYNC_DEBOUNCE))
    }
  },

  // Check if sync is currently in progress
  isSyncing: () => {
    return baseWorkflowSync.isSyncing()
  },

  // Get last sync timestamp
  getLastSyncTime: () => {
    if (typeof window === 'undefined') return null
    const timestamp = localStorage.getItem('last_db_sync_timestamp')
    return timestamp ? parseInt(timestamp, 10) : null
  },

  // Pause polling during user interactions
  pausePolling,

  // Resume polling after user interactions
  resumePolling,

  // Notify that SSE update was received (indicates healthy connection)
  notifySSEUpdate: () => {
    setSSEUpdateReceived(true)
    setLastSSEUpdateTime(Date.now())
    setIsSSEConnected(true)
    logger.debug('📥 SSE update received - debouncing fetch (2s)')

    if (sseDebounceTimer) {
      clearTimeout(sseDebounceTimer)
    }

    setSSEDebounceTimer(
      setTimeout(() => {
        if (!isActivelyLoadingFromDB() && !isActivelyWorkspaceSwitching()) {
          logger.debug('🔄 Executing debounced SSE fetch')
          fetchWorkflowsFromDB()
        }
        setSSEDebounceTimer(null)
      }, 100)
    )
  },

  // Notify that SSE connection status changed
  setSSEConnected: (connected: boolean) => {
    const wasConnected = isSSEConnected
    setIsSSEConnected(connected)

    if (connected && !wasConnected) {
      logger.debug('🔌 SSE connected - switching to backup polling mode (10s)')
      setLastSSEUpdateTime(Date.now())
    } else if (!connected && wasConnected) {
      logger.debug('🔌 SSE disconnected - switching to primary polling mode (2s)')
    }
  },

  // Get current SSE health status (for debugging)
  getSSEHealth: () => ({
    isConnected: isSSEConnected,
    lastUpdateTime: lastSSEUpdateTime,
    isHealthy: isSSEHealthy(),
    currentPollingInterval: getAdaptivePollingInterval(),
  }),
}

// Wire up the circular reference for fetch module
_setWorkflowSyncRef(workflowSync)

// Setup online/offline listeners for automatic sync recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setIsOnline(true)
    logger.debug('🌐 ONLINE - Internet connection restored')

    if (hasPendingSync) {
      logger.debug('🔄 Triggering pending sync after reconnection')
      setHasPendingSync(false)
      workflowSync.syncImmediate()
      throttledFetchWorkflows()
    }
  })

  window.addEventListener('offline', () => {
    setIsOnline(false)
    logger.warn('📴 OFFLINE - Internet connection lost. Syncs will be queued.')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      logger.debug('👁️ Tab hidden - triggering immediate sync')
      workflowSync.syncImmediate()
    }
  })

  window.addEventListener('beforeunload', () => {
    logger.debug('🔄 Page unloading - triggering final sync')
    workflowSync.syncImmediate()
  })
}
