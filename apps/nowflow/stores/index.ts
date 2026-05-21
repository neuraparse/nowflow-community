import { useEffect } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { useAgentProfilesStore } from './agent-profiles/store'
import { useCustomToolsStore } from './custom-tools/store'
import { useExecutionStore } from './execution/store'
import { useNotificationStore } from './notifications/store'
import { useConsoleStore } from './panel/console/store'
import { useVariablesStore } from './panel/variables/store'
import { useEnvironmentStore } from './settings/environment/store'
import { getSyncManagers, initializeSyncManagers, resetSyncManagers } from './sync-registry'
import {
  loadRegistry,
  loadSubblockValues,
  loadWorkflowState,
  saveSubblockValues,
  saveWorkflowState,
} from './workflows/persistence'
import { useWorkflowRegistry } from './workflows/registry/store'
import { useSubBlockStore } from './workflows/subblock/store'
import { startAutoPolling } from './workflows/sync'
import { useWorkflowStore } from './workflows/workflow/store'

const logger = createLogger('Stores')

// Track initialization state
let isInitializing = false

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/setup' ||
    pathname.startsWith('/setup/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/verify' ||
    pathname.startsWith('/verify/')
  )
}

/**
 * Initialize the application state and sync system
 *
 * Note: Workflow scheduling is handled automatically by the workflowSync manager
 * when workflows are synced to the database. The scheduling logic checks if a
 * workflow has scheduling enabled in its starter block and updates the schedule
 * accordingly.
 */
async function initializeApplication(): Promise<void> {
  if (typeof window === 'undefined' || isInitializing) return

  if (isPublicAuthPath(window.location.pathname)) {
    return
  }

  isInitializing = true

  try {
    // Load environment variables directly from DB
    await useEnvironmentStore.getState().loadEnvironmentVariables()

    // Load custom tools from server (only if user is authenticated)
    try {
      await useCustomToolsStore.getState().loadCustomTools()
    } catch (error) {
      // Ignore auth errors during initialization
      logger.warn('Failed to load custom tools during initialization:', error)
    }

    // Load agent profiles from server
    try {
      await useAgentProfilesStore.getState().loadProfiles()
    } catch (error) {
      logger.warn('Failed to load agent profiles during initialization:', error)
    }

    // CRITICAL: Detect new browser/incognito mode to prioritize DB loading
    // This prevents data loss when users switch browsers or use private browsing
    const isNewBrowser = !localStorage.getItem('app_ever_initialized')
    const isNewSession = !sessionStorage.getItem('app_initialized')

    if (isNewBrowser) {
      logger.warn('🔍 NEW BROWSER DETECTED - Will prioritize database as source of truth')
      localStorage.setItem('app_ever_initialized', 'true')
    }

    if (isNewSession) {
      logger.debug('🔍 NEW SESSION DETECTED')
    }

    sessionStorage.setItem('app_initialized', 'true')

    // Initialize sync system for other stores
    await initializeSyncManagers()

    // CRITICAL: Always prioritize DB on new browser/session
    const registryState = useWorkflowRegistry.getState()
    const hasDbWorkflows = Object.keys(registryState.workflows).length > 0

    if (!hasDbWorkflows) {
      if (isNewBrowser || isNewSession) {
        // For new browsers/sessions, ONLY use DB - ignore localStorage completely
        logger.warn(
          '⚠️ New browser/session with no DB workflows - localStorage will be IGNORED to prevent sync conflicts'
        )

        // Check if this is truly a new user or if DB just hasn't loaded yet
        const workflows = loadRegistry()
        const hasLocalData = workflows && Object.keys(workflows).length > 0

        if (hasLocalData) {
          logger.error(
            `🚨 CRITICAL: Found ${Object.keys(workflows).length} workflows in localStorage but NOT in DB on new browser. This suggests DB hasn't synced yet. Preventing localStorage load to avoid overwriting DB.`
          )
          // Do NOT load from localStorage - wait for DB or create new workflow
        }

        // REMOVED: Auto-create first workflow - causes race condition
        // Users will create their first workflow via sidebar "+" button
        // This prevents 429 errors when limit is exceeded
        logger.debug('No workflows found - user will create first workflow via UI')
      } else {
        // Existing session - can use localStorage as fallback
        const workflows = loadRegistry()
        if (workflows && Object.keys(workflows).length > 0) {
          logger.debug('Loading workflows from localStorage as fallback (existing session)')
          useWorkflowRegistry.setState({ workflows })

          const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
          if (activeWorkflowId) {
            initializeWorkflowState(activeWorkflowId)
          }
        }
      }
    } else {
      logger.debug('✅ Using workflows loaded from DB (source of truth)')
    }

    // 2. Register cleanup
    window.addEventListener('beforeunload', handleBeforeUnload)

    // CRITICAL FIX: Start auto-polling for cross-device real-time updates
    // This ensures changes from other devices/countries appear within 10 seconds
    startAutoPolling()
    logger.debug('✅ Auto-polling enabled for cross-device collaboration')
  } catch (error) {
    logger.error('Error during application initialization:', { error })
  } finally {
    isInitializing = false
  }
}

function initializeWorkflowState(workflowId: string): void {
  // Load the specific workflow state from localStorage
  const workflowState = loadWorkflowState(workflowId)
  if (!workflowState) {
    logger.warn(`No saved state found for workflow ${workflowId}`)
    return
  }

  // Set the workflow store state with the loaded state
  useWorkflowStore.setState(workflowState)

  // Initialize subblock values for this workflow
  const subblockValues = loadSubblockValues(workflowId)
  if (subblockValues) {
    // Update the subblock store with the loaded values
    useSubBlockStore.setState((state) => ({
      workflowValues: {
        ...state.workflowValues,
        [workflowId]: subblockValues,
      },
    }))
  } else if (workflowState.blocks) {
    // If no saved subblock values, initialize from blocks
    useSubBlockStore.getState().initializeFromWorkflow(workflowId, workflowState.blocks)
  }

  logger.debug(`Initialized workflow state for ${workflowId}`)
}

/**
 * Handle application cleanup before unload
 */
function handleBeforeUnload(event: BeforeUnloadEvent): void {
  // Check if we're on an authentication page and skip confirmation if we are
  if (typeof window !== 'undefined') {
    if (isPublicAuthPath(window.location.pathname)) {
      return
    }
  }

  // 1. Persist current state
  const currentId = useWorkflowRegistry.getState().activeWorkflowId
  if (currentId) {
    const currentState = useWorkflowStore.getState()

    // Save the current workflow state with its ID
    saveWorkflowState(currentId, {
      blocks: currentState.blocks,
      edges: currentState.edges,
      loops: currentState.loops,
      isDeployed: currentState.isDeployed,
      deployedAt: currentState.deployedAt,
      lastSaved: Date.now(),
      // Include history for undo/redo functionality
      history: currentState.history,
    })

    // Save subblock values for the current workflow
    const subblockValues = useSubBlockStore.getState().workflowValues[currentId]
    if (subblockValues) {
      saveSubblockValues(currentId, subblockValues)
    }
  }

  // 2. Final sync for managers that need it
  getSyncManagers()
    .filter((manager) => manager.config.syncOnExit)
    .forEach((manager) => {
      manager.sync()
    })

  // 3. Cleanup managers
  getSyncManagers().forEach((manager) => manager.dispose())

  // Standard beforeunload pattern
  event.preventDefault()
  event.returnValue = ''
}

/**
 * Clean up sync system
 */
function cleanupApplication(): void {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  getSyncManagers().forEach((manager) => manager.dispose())
}

/**
 * Clear all user data when signing out
 * This ensures data from one account doesn't persist to another
 */
export async function clearUserData(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // 1. Reset all sync managers to prevent any pending syncs
    resetSyncManagers()

    // 2. Reset all stores to their initial state
    resetAllStores()

    // 3. Clear localStorage except for essential app settings
    const keysToKeep = ['next-favicon', 'theme']
    const keysToRemove = Object.keys(localStorage).filter((key) => !keysToKeep.includes(key))
    keysToRemove.forEach((key) => localStorage.removeItem(key))

    logger.info('User data cleared successfully')
  } catch (error) {
    logger.error('Error clearing user data:', { error })
  }
}

/**
 * Hook to manage application lifecycle
 */
export function useAppInitialization() {
  useEffect(() => {
    // Use Promise to handle async initialization
    initializeApplication()

    return () => {
      cleanupApplication()
    }
  }, [])
}

/**
 * Hook to reinitialize the application after successful login
 * Use this in the login success handler or post-login page
 */
export function useLoginInitialization() {
  useEffect(() => {
    reinitializeAfterLogin()
  }, [])
}

// Initialize immediately when imported on client
if (typeof window !== 'undefined') {
  initializeApplication()
}

// Export all stores
export {
  useWorkflowStore,
  useWorkflowRegistry,
  useNotificationStore,
  useEnvironmentStore,
  useExecutionStore,
  useConsoleStore,
  useCustomToolsStore,
  useVariablesStore,
}

// Helper function to reset all stores
export const resetAllStores = () => {
  // Reset all stores to initial state
  useWorkflowRegistry.setState({
    workflows: {},
    activeWorkflowId: null,
    isLoading: false,
    error: null,
  })
  useWorkflowStore.getState().clear()
  useSubBlockStore.getState().clear()
  useSubBlockStore.getState().clearToolParams()
  useNotificationStore.setState({ notifications: [] })
  useEnvironmentStore.setState({
    variables: {},
    isLoading: false,
    error: null,
  })
  useExecutionStore.getState().reset()
  useConsoleStore.setState({ entries: [], isOpen: false })
  useCustomToolsStore.setState({ tools: {} })
  useAgentProfilesStore.getState().clearProfiles()
  useVariablesStore.getState().resetLoaded() // Reset variables store tracking
}

// Helper function to log all store states
export const logAllStores = () => {
  const state = {
    workflow: useWorkflowStore.getState(),
    workflowRegistry: useWorkflowRegistry.getState(),
    notifications: useNotificationStore.getState(),
    environment: useEnvironmentStore.getState(),
    execution: useExecutionStore.getState(),
    console: useConsoleStore.getState(),
    customTools: useCustomToolsStore.getState(),
    subBlock: useSubBlockStore.getState(),
    variables: useVariablesStore.getState(),
  }

  return state
}

/**
 * Reinitialize the application after login
 * This ensures we load fresh data from the database for the new user
 */
export async function reinitializeAfterLogin(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // Reset sync managers to prevent any active syncs during reinitialization
    resetSyncManagers()

    // Clean existing state to avoid stale data
    resetAllStores()

    // Mark as a new login session
    sessionStorage.removeItem('app_initialized')

    // Reset initialization flags to force a fresh load
    isInitializing = false

    // Reinitialize the application
    await initializeApplication()

    logger.info('Application reinitialized after login')
  } catch (error) {
    logger.error('Error reinitializing application:', { error })
  }
}

// Re-export sync managers
export { workflowSync } from './workflows/sync'
