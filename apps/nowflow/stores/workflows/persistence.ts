/**
 * Centralized persistence layer for workflow stores
 * Handles localStorage interactions and synchronization
 */
import { createLogger } from '@/lib/logs/console-logger'
import { STORAGE_KEYS } from '../constants'
import { useWorkflowRegistry } from './registry/store'
import { useSubBlockStore } from './subblock/store'
import { stripTransientBlockFields } from './utils'
import { useWorkflowStore } from './workflow/store'

const logger = createLogger('WorkflowsPersistence')

/**
 * Save data to localStorage with error handling
 */
export function saveToStorage<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (error) {
    logger.error(`Failed to save data to ${key}:`, { error })
    return false
  }
}

/**
 * Load data from localStorage with error handling
 */
export function loadFromStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    logger.error(`Failed to load data from ${key}:`, { error })
    return null
  }
}

/**
 * Remove data from localStorage with error handling
 */
export function removeFromStorage(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    logger.error(`Failed to remove data from ${key}:`, { error })
    return false
  }
}

/**
 * Save workflow state to localStorage
 */
export function saveWorkflowState(workflowId: string, state: any): boolean {
  // We need to handle history separately since it's not part of the base WorkflowState
  const sanitized =
    state && state.blocks
      ? {
          ...state,
          blocks: stripTransientBlockFields(state.blocks),
        }
      : state
  return saveToStorage(STORAGE_KEYS.WORKFLOW(workflowId), sanitized)
}

/**
 * Load workflow state from localStorage
 */
export function loadWorkflowState(workflowId: string): any {
  const state = loadFromStorage<any>(STORAGE_KEYS.WORKFLOW(workflowId))
  if (!state || !state.blocks) return state
  return {
    ...state,
    blocks: stripTransientBlockFields(state.blocks),
  }
}

/**
 * Save subblock values to localStorage
 */
export function saveSubblockValues(workflowId: string, values: any): boolean {
  return saveToStorage(STORAGE_KEYS.SUBBLOCK(workflowId), values)
}

/**
 * Load subblock values from localStorage
 */
export function loadSubblockValues(workflowId: string): any {
  return loadFromStorage(STORAGE_KEYS.SUBBLOCK(workflowId))
}

/**
 * Save registry to localStorage
 */
export function saveRegistry(registry: any): boolean {
  return saveToStorage(STORAGE_KEYS.REGISTRY, registry)
}

/**
 * Load registry from localStorage
 */
export function loadRegistry(): any {
  return loadFromStorage(STORAGE_KEYS.REGISTRY)
}

/**
 * Clean up stale workflow data from localStorage
 * This removes workflow data that doesn't exist in the DB (source of truth)
 *
 * DB IS THE SOURCE OF TRUTH:
 * - If workflow exists in DB → keep in localStorage (cache)
 * - If workflow NOT in DB → remove from localStorage (was deleted on another device/session)
 *
 * @param validWorkflowIds - Workflow IDs that exist in the database
 * @param forceCleanup - If true, skip safety checks (use when DB fetch was successful)
 */
export function cleanupStaleWorkflowData(
  validWorkflowIds: string[],
  forceCleanup: boolean = false
): void {
  if (typeof window === 'undefined') return

  try {
    const allKeys = Object.keys(localStorage)
    const workflowKeys = allKeys.filter(
      (key) => key.startsWith('workflow-') || key.startsWith('subblock-values-')
    )

    // Count how many local workflows we have
    const localWorkflowIds = new Set<string>()
    workflowKeys.forEach((key) => {
      if (key.startsWith('workflow-')) {
        // Filter out special keys like 'workflow-registry' or 'workflow-xxx-readonly'
        const id = key.replace('workflow-', '')
        if (id && !id.includes('-') && id.length > 10) {
          localWorkflowIds.add(id)
        }
      }
    })

    const localCount = localWorkflowIds.size
    const validCount = validWorkflowIds?.length || 0
    const toBeCleanedIds = [...localWorkflowIds].filter((id) => !validWorkflowIds?.includes(id))
    const toBeCleanedCount = toBeCleanedIds.length

    // SAFETY CHECK: Only skip if NOT forced AND validWorkflowIds is empty/null
    // When forceCleanup is true, we trust that DB fetch was successful
    if (!forceCleanup && (!validWorkflowIds || validWorkflowIds.length === 0)) {
      logger.warn(
        '⚠️ Skipping localStorage cleanup - no valid workflow IDs and forceCleanup is false'
      )
      return
    }

    if (toBeCleanedCount > 0) {
      logger.info(
        `🧹 DB is source of truth: Cleaning ${toBeCleanedCount} local workflows not in DB. ` +
          `Local: ${localCount}, DB: ${validCount}, To clean: [${toBeCleanedIds.join(', ')}]`
      )
    }

    let cleanedCount = 0
    workflowKeys.forEach((key) => {
      let workflowId: string | null = null

      if (key.startsWith('workflow-') && !key.includes('registry')) {
        const id = key.replace('workflow-', '')
        // Only process actual workflow IDs (not readonly flags etc)
        if (id && !id.includes('-') && id.length > 10) {
          workflowId = id
        }
      } else if (key.startsWith('subblock-values-')) {
        workflowId = key.replace('subblock-values-', '')
      }

      if (!workflowId) return

      // If this workflow ID is not in the valid list (DB), remove it from localStorage
      if (!validWorkflowIds?.includes(workflowId)) {
        localStorage.removeItem(key)
        cleanedCount++
        logger.info(`🗑️ Removed local cache for workflow not in DB: ${key}`)
      }
    })

    if (cleanedCount > 0) {
      logger.info(
        `✅ Cleaned up ${cleanedCount} stale workflow entries from localStorage (DB is source of truth)`
      )
    }
  } catch (error) {
    logger.error('Error cleaning up stale workflow data:', { error })
  }
}

/**
 * Initialize all stores from localStorage
 * This is the main initialization function that should be called once at app startup
 */
export function initializeStores(): void {
  if (typeof window === 'undefined') return

  // Initialize registry first
  const workflows = loadRegistry()
  if (workflows) {
    useWorkflowRegistry.setState({ workflows })

    // If there's an active workflow ID in the registry, load it
    const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
    if (activeWorkflowId) {
      // Load workflow state
      const workflowState = loadWorkflowState(activeWorkflowId)
      if (workflowState) {
        // Validate and clean blocks before loading
        const validBlocks = Object.fromEntries(
          Object.entries(workflowState.blocks || {}).filter(([blockId, block]) => {
            if (!block || typeof block !== 'object' || !('type' in block) || !('name' in block)) {
              logger.warn(`Removing invalid block during initialization: ${blockId}`, {
                hasBlock: !!block,
                type: (block as any)?.type,
                name: (block as any)?.name,
              })
              return false
            }
            return true
          })
        )

        // Initialize workflow store with saved state
        useWorkflowStore.setState({
          ...workflowState,
          blocks: validBlocks,
        })

        // Initialize subblock store with workflow values
        const subblockValues = loadSubblockValues(activeWorkflowId)
        if (subblockValues) {
          useSubBlockStore.setState((state) => ({
            workflowValues: {
              ...state.workflowValues,
              [activeWorkflowId]: subblockValues,
            },
          }))
        } else if (workflowState.blocks) {
          // If no saved subblock values, initialize from blocks
          useSubBlockStore.getState().initializeFromWorkflow(activeWorkflowId, workflowState.blocks)
        }
      }
    }
  }

  // Setup unload persistence
  setupUnloadPersistence()
}

/**
 * Setup persistence for page unload events
 */
export function setupUnloadPersistence(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeunload', (event) => {
    // Check if we're on an authentication page and skip confirmation if we are
    const path = window.location.pathname
    // Skip confirmation for auth-related pages
    if (
      path === '/login' ||
      path === '/signup' ||
      path === '/setup' ||
      path === '/reset-password' ||
      path === '/verify'
    ) {
      return
    }

    const currentId = useWorkflowRegistry.getState().activeWorkflowId
    if (currentId) {
      // Save workflow state
      const currentState = useWorkflowStore.getState()

      // Save the complete state including history which is added by middleware
      saveWorkflowState(currentId, {
        blocks: currentState.blocks,
        edges: currentState.edges,
        loops: currentState.loops,
        groups: currentState.groups, // FIX: Include groups in persistence
        selectedNodeIds: currentState.selectedNodeIds,
        isDeployed: currentState.isDeployed,
        deployedAt: currentState.deployedAt,
        lastSaved: Date.now(),
        history: currentState.history,
      })

      // Save subblock values
      const subblockValues = useSubBlockStore.getState().workflowValues[currentId]
      if (subblockValues) {
        saveSubblockValues(currentId, subblockValues)
      }
    }

    // Save registry
    saveRegistry(useWorkflowRegistry.getState().workflows)

    // Only prevent navigation on non-auth pages
    event.preventDefault()
    event.returnValue = ''
  })
}
