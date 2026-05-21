import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createWorkflowCrudActions } from './actions/workflow-crud-actions'
import { createWorkflowSwitchActions } from './actions/workflow-switch-actions'
import { createWorkspaceActions } from './actions/workspace-actions'
import { WorkflowRegistry } from './types'

// Storage key for active workspace
const ACTIVE_WORKSPACE_KEY = 'active-workspace-id'

export const useWorkflowRegistry = create<WorkflowRegistry>()(
  devtools(
    (set, get) => {
      const deps = { set, get }

      return {
        // Store state
        workflows: {},
        activeWorkflowId: null,
        activeWorkspaceId:
          typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null,
        creatingWorkflowIds: {},
        pendingCreationIds: {},
        pendingDeletionIds: {},
        isLoading: false,
        isLoadingWorkflow: false,
        error: null,

        // Set loading state
        setLoading: (loading: boolean) => {
          if (!loading || Object.keys(get().workflows).length === 0) {
            set({ isLoading: loading })
          }
        },

        // Set workflow loading state
        setLoadingWorkflow: (loading: boolean) => {
          set({ isLoadingWorkflow: loading })
        },

        // Workspace actions (switch, deletion handling)
        ...createWorkspaceActions(deps),

        // Workflow switching
        ...createWorkflowSwitchActions(deps),

        // Workflow CRUD (create, duplicate, delete, update)
        ...createWorkflowCrudActions(deps),
      }
    },
    { name: 'workflow-registry' }
  )
)
