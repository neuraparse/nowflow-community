import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  cleanEdges,
  createBatchBlockDeleter,
  createBatchBlockUpdater,
  createBatchEdgeUpdater,
} from '../common/optimizations'
import { withHistory, WorkflowStoreWithHistory } from '../middleware'
import { createBatchActionsSlice } from './actions/batch-actions'
import { createBlockActionsSlice } from './actions/block-actions'
import { createEdgeActionsSlice } from './actions/edge-actions'
import { createGroupActionsSlice } from './actions/group-actions'
import { createLoopActionsSlice } from './actions/loop-actions'
import { createSelectionActionsSlice } from './actions/selection-actions'

const initialInteractionState = {
  isDragging: false,
  isEditing: false,
  lastInteractionTime: 0,
  lastDurableChangeTime: 0,
}

const initialState = {
  blocks: {},
  edges: [],
  loops: {},
  groups: {},
  selectedNodeIds: [],
  lastSaved: undefined,
  isDeployed: false,
  deployedAt: undefined,
  needsRedeployment: false,
  hasActiveSchedule: false,
  hasActiveWebhook: false,
  highlightedNodeId: null,
  highlightedEdgeIds: [],
  // Right sidebar state
  selectedBlockForSidebar: null,
  isRightSidebarOpen: false,
  // Interaction tracking
  interaction: initialInteractionState,
  // History will be added by withHistory middleware
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
        isPublished: false,
      },
      timestamp: Date.now(),
      action: 'Initial state',
      subblockValues: {},
    },
    future: [],
  },
}

export const useWorkflowStore = create<WorkflowStoreWithHistory>()(
  devtools(
    withHistory((set, get: any) => {
      // Override setState to clean edges when state is set
      const originalSet = set
      const safeSet = (partial: any) => {
        if (typeof partial === 'function') {
          return originalSet((state: any) => {
            const newState = partial(state)
            if (newState.blocks && newState.edges) {
              newState.edges = cleanEdges(newState.edges, newState.blocks)
            }
            return newState
          })
        } else {
          if (partial.blocks && partial.edges) {
            partial.edges = cleanEdges(partial.edges, partial.blocks)
          }
          return originalSet(partial)
        }
      }

      // Create optimized updater functions
      const batchBlockUpdater = createBatchBlockUpdater(safeSet, get)
      const batchEdgeUpdater = createBatchEdgeUpdater(safeSet, get)
      const batchBlockDeleter = createBatchBlockDeleter(safeSet, get)

      // Compose all action slices
      const deps = { safeSet, get }

      return {
        ...initialState,
        undo: () => {},
        redo: () => {},
        canUndo: () => false,
        canRedo: () => false,
        revertToHistoryState: () => {},

        // Block actions (add, remove, update, duplicate, toggle, etc.)
        ...createBlockActionsSlice(deps),

        // Edge actions (add, remove, style, color, animation, etc.)
        ...createEdgeActionsSlice(deps),

        // Group actions (create, delete, update, add/remove nodes)
        ...createGroupActionsSlice(deps),

        // Loop actions (iterations, type, forEach items)
        ...createLoopActionsSlice(deps),

        // Selection, sidebar, deployment, interaction tracking
        ...createSelectionActionsSlice(deps),

        // Batch operations (batch update blocks/edges, batch delete)
        ...createBatchActionsSlice({
          ...deps,
          batchBlockUpdater,
          batchEdgeUpdater,
          batchBlockDeleter,
        }),

        // Include all initial state fields
        ...initialState,
      }
    }),
    { name: 'workflow-store' }
  )
)
