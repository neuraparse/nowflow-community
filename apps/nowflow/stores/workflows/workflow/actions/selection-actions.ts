/**
 * Selection, sidebar, deployment, and interaction tracking actions slice.
 * These are mostly ephemeral (no sync needed) or lightweight operations.
 */
import { pushHistory } from '../../middleware'
import { saveWorkflowState } from '../../persistence'
import { useWorkflowRegistry } from '../../registry/store'
import { useSubBlockStore } from '../../subblock/store'
import { updateLastUserActionTime, workflowSync } from '../../sync'
import { WorkflowState } from '../types'

export type SelectionActionsSliceDeps = {
  safeSet: any
  get: any
}

export function createSelectionActionsSlice({ safeSet, get }: SelectionActionsSliceDeps) {
  return {
    // Selection management actions (EPHEMERAL - no sync needed)
    setSelectedNodes: (nodeIds: string[]) => {
      safeSet({ selectedNodeIds: [...nodeIds] })
      get().markInteraction()
    },

    addToSelection: (nodeId: string) => {
      const current = get().selectedNodeIds
      if (!current.includes(nodeId)) {
        safeSet({ selectedNodeIds: [...current, nodeId] })
        get().markInteraction()
      }
    },

    removeFromSelection: (nodeId: string) => {
      const current = get().selectedNodeIds
      safeSet({ selectedNodeIds: current.filter((id: string) => id !== nodeId) })
      get().markInteraction()
    },

    clearSelection: () => {
      safeSet({ selectedNodeIds: [] })
      get().markInteraction()
    },

    toggleNodeSelection: (nodeId: string) => {
      const current = get().selectedNodeIds
      if (current.includes(nodeId)) {
        get().removeFromSelection(nodeId)
      } else {
        get().addToSelection(nodeId)
      }
    },

    // Right sidebar actions (EPHEMERAL - no sync needed)
    openRightSidebar: (blockId: string) => {
      safeSet({
        selectedBlockForSidebar: blockId,
        isRightSidebarOpen: true,
      })
      get().markInteraction()
    },

    closeRightSidebar: () => {
      safeSet({
        selectedBlockForSidebar: null,
        isRightSidebarOpen: false,
      })
      get().markInteraction()
    },

    toggleRightSidebar: (blockId?: string) => {
      const current = get()
      if (current.isRightSidebarOpen && current.selectedBlockForSidebar === blockId) {
        get().closeRightSidebar()
      } else if (blockId) {
        get().openRightSidebar(blockId)
      } else {
        get().closeRightSidebar()
      }
    },

    // Highlight connections for a node (EPHEMERAL - no sync needed)
    highlightConnections: (nodeId: string) => {
      const connectedEdgeIds = get()
        .edges.filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
        .map((edge: any) => edge.id)

      safeSet({
        highlightedNodeId: nodeId,
        highlightedEdgeIds: connectedEdgeIds,
      })
      get().markInteraction()
    },

    resetHighlightedConnections: () => {
      safeSet({
        highlightedNodeId: null,
        highlightedEdgeIds: [],
      })
      get().markInteraction()
    },

    // Deployment status
    setNeedsRedeploymentFlag: (needsRedeployment: boolean) => {
      safeSet({ needsRedeployment })
    },

    setDeploymentStatus: (isDeployed: boolean, deployedAt?: Date) => {
      const newState = {
        ...get(),
        isDeployed,
        deployedAt: deployedAt || (isDeployed ? new Date() : undefined),
        needsRedeployment: isDeployed ? false : get().needsRedeployment,
      }

      safeSet(newState)
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    setScheduleStatus: (hasActiveSchedule: boolean) => {
      if (get().hasActiveSchedule !== hasActiveSchedule) {
        safeSet({ hasActiveSchedule })
        get().updateLastSaved()
      }
    },

    setWebhookStatus: (hasActiveWebhook: boolean) => {
      if (get().hasActiveWebhook !== hasActiveWebhook) {
        if (get().hasActiveSchedule) {
          get().setScheduleStatus(false)
        }

        safeSet({ hasActiveWebhook })
        get().updateLastSaved()
      }
    },

    triggerUpdate: () => {
      safeSet((state: any) => ({
        ...state,
        lastUpdate: Date.now(),
      }))
    },

    updateLastSaved: () => {
      safeSet({ lastSaved: Date.now() })

      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (activeWorkflowId) {
        const currentState = get()
        saveWorkflowState(activeWorkflowId, {
          blocks: currentState.blocks,
          edges: currentState.edges,
          loops: currentState.loops,
          groups: currentState.groups,
          history: currentState.history,
          isDeployed: currentState.isDeployed,
          deployedAt: currentState.deployedAt,
          lastSaved: Date.now(),
        })
      }
    },

    // Revert to deployed state
    revertToDeployedState: (deployedState: WorkflowState) => {
      const newState = {
        blocks: deployedState.blocks,
        edges: deployedState.edges,
        loops: deployedState.loops,
        isDeployed: true,
        needsRedeployment: false,
        hasActiveWebhook: false,
      }

      safeSet(newState)

      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (!activeWorkflowId) return

      const subBlockStore = useSubBlockStore.getState()
      const values: Record<string, Record<string, any>> = {}

      Object.entries(deployedState.blocks).forEach(([blockId, block]) => {
        values[blockId] = {}
        Object.entries(block.subBlocks || {}).forEach(([subBlockId, subBlock]) => {
          values[blockId][subBlockId] = subBlock.value
        })
      })

      useSubBlockStore.setState({
        workflowValues: {
          ...subBlockStore.workflowValues,
          [activeWorkflowId]: values,
        },
      })

      const starterBlock = Object.values(deployedState.blocks).find(
        (block) => block.type === 'starter'
      )
      if (starterBlock && starterBlock.subBlocks?.startWorkflow?.value === 'webhook') {
        safeSet({ hasActiveWebhook: true })
      }

      pushHistory(safeSet, get, newState, 'Reverted to deployed state')
      get().updateLastSaved()
      workflowSync.syncUserAction()
    },

    // Clear workflow
    clear: () => {
      const newState = {
        blocks: {},
        edges: [],
        loops: {},
        groups: {},
        selectedNodeIds: [],
        history: {
          past: [],
          present: {
            state: {
              blocks: {},
              edges: [],
              loops: {},
              groups: {},
              isDeployed: false,
              isPublished: false,
            },
            timestamp: Date.now(),
            action: 'Initial state',
            subblockValues: {},
          },
          future: [],
        },
        lastSaved: Date.now(),
        isDeployed: false,
        isPublished: false,
        hasActiveSchedule: false,
        hasActiveWebhook: false,
      }
      safeSet(newState)
      workflowSync.syncUserAction()

      return newState
    },

    // Interaction tracking methods
    setDragging: (isDragging: boolean) => {
      safeSet({
        interaction: {
          ...get().interaction,
          isDragging,
          lastInteractionTime: Date.now(),
        },
      })
      if (isDragging) {
        workflowSync.pausePolling()
      }
    },

    setEditing: (isEditing: boolean) => {
      safeSet({
        interaction: {
          ...get().interaction,
          isEditing,
          lastInteractionTime: Date.now(),
        },
      })
    },

    markInteraction: () => {
      safeSet({
        interaction: {
          ...get().interaction,
          lastInteractionTime: Date.now(),
        },
      })
    },

    markDurableChange: () => {
      const now = Date.now()
      safeSet({
        interaction: {
          ...get().interaction,
          lastInteractionTime: now,
          lastDurableChangeTime: now,
        },
      })
      updateLastUserActionTime()
    },
  }
}
