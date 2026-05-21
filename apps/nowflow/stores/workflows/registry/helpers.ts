/**
 * Helper functions for the workflow registry store.
 * Includes localStorage cleanup and workflow store reset logic.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { clearWorkflowVariablesTracking } from '@/stores/panel/variables/store'
import { saveWorkflowState } from '../persistence'
import { useSubBlockStore } from '../subblock/store'
import { useWorkflowStore } from '../workflow/store'

const logger = createLogger('WorkflowRegistry')

// Helper to create empty interaction state
export const createEmptyInteraction = () => ({
  isDragging: false,
  isEditing: false,
  lastInteractionTime: 0,
  lastDurableChangeTime: 0,
})

/**
 * Resets workflow and subblock stores to prevent data leakage between workspaces
 */
export function resetWorkflowStores() {
  // Reset variable tracking to prevent stale API calls
  clearWorkflowVariablesTracking()

  // Reset the workflow store to prevent data leakage between workspaces
  useWorkflowStore.setState({
    blocks: {},
    edges: [],
    loops: {},
    isDeployed: false,
    deployedAt: undefined,
    hasActiveSchedule: false,
    interaction: createEmptyInteraction(),
    history: {
      past: [],
      present: {
        state: {
          blocks: {},
          edges: [],
          loops: {},
          groups: {},
          selectedNodeIds: [],
          highlightedNodeId: null,
          highlightedEdgeIds: [],
          selectedBlockForSidebar: null,
          isRightSidebarOpen: false,
          isDeployed: false,
          deployedAt: undefined,
          needsRedeployment: false,
          hasActiveSchedule: false,
          hasActiveWebhook: false,
          lastSaved: undefined,
          lastUpdate: undefined,
          interaction: createEmptyInteraction(),
        },
        timestamp: Date.now(),
        action: 'Initial state',
        subblockValues: {},
      },
      future: [],
    },
    lastSaved: Date.now(),
  })

  // Reset the subblock store
  useSubBlockStore.setState({
    workflowValues: {},
    toolParams: {},
  })
}

/**
 * Cleans up any localStorage data that isn't needed for the current workspace
 */
export function cleanupLocalStorageForWorkspace(workspaceId: string): void {
  if (typeof window === 'undefined') return

  // We need a lazy import to avoid circular dependency
  const { useWorkflowRegistry } = require('./store')

  try {
    const { workflows } = useWorkflowRegistry.getState()
    const workflowIds = Object.keys(workflows)

    const localStorageKeys = Object.keys(localStorage)
    const workflowKeys = localStorageKeys.filter(
      (key) => key.startsWith('workflow-') || key.startsWith('subblock-values-')
    )

    for (const key of workflowKeys) {
      let workflowId: string | null = null

      if (key.startsWith('workflow-')) {
        workflowId = key.replace('workflow-', '')
      } else if (key.startsWith('subblock-values-')) {
        workflowId = key.replace('subblock-values-', '')
      }

      if (workflowId) {
        if (!workflowIds.includes(workflowId)) {
          const exists = localStorage.getItem(`workflow-${workflowId}`)
          if (exists) {
            try {
              const parsed = JSON.parse(exists)
              if (!parsed || !parsed.workspaceId) continue

              if (parsed.workspaceId === workspaceId) {
                localStorage.removeItem(key)
                logger.debug(`Removed stale localStorage data for workflow ${workflowId}`)
              }
            } catch {
              continue
            }
          } else {
            localStorage.removeItem(key)
            logger.debug(`Removed stale localStorage data for workflow ${workflowId}`)
          }
        } else {
          const exists = localStorage.getItem(`workflow-${workflowId}`)
          if (exists) {
            try {
              const parsed = JSON.parse(exists)
              if (parsed && parsed.workspaceId && parsed.workspaceId !== workspaceId) {
                const workspacesData = localStorage.getItem('workspaces')
                if (workspacesData) {
                  try {
                    const workspaces = JSON.parse(workspacesData)
                    const workspaceExists = workspaces.some((w: any) => w.id === parsed.workspaceId)

                    if (!workspaceExists) {
                      parsed.workspaceId = workspaceId
                      saveWorkflowState(workflowId, parsed)
                      logger.debug(
                        `Updated workflow ${workflowId} to use current workspace ${workspaceId}`
                      )
                    }
                  } catch {
                    // Skip
                  }
                }
              }
            } catch {
              // Skip
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up localStorage:', error)
  }
}
