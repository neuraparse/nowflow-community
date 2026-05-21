/**
 * Workspace switching and deletion actions for the registry store.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { endWorkspaceSwitch, fetchWorkflowsFromDB, startWorkspaceSwitch } from '../../sync'
import { resetWorkflowStores } from '../helpers'

const logger = createLogger('WorkflowRegistry')

// Storage key for active workspace
const ACTIVE_WORKSPACE_KEY = 'active-workspace-id'

export type WorkspaceActionsDeps = {
  set: any
  get: any
}

export function createWorkspaceActions({ set, get }: WorkspaceActionsDeps) {
  return {
    handleWorkspaceDeletion: (newWorkspaceId: string) => {
      const currentWorkspaceId = get().activeWorkspaceId

      if (!newWorkspaceId || newWorkspaceId === currentWorkspaceId) {
        logger.error('Cannot switch to invalid workspace after deletion')
        return
      }

      logger.info(`🗑️ Switching from deleted workspace ${currentWorkspaceId} to ${newWorkspaceId}`)

      startWorkspaceSwitch()
      resetWorkflowStores()

      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, newWorkspaceId)
      }

      set({
        isLoading: true,
        workflows: {},
        activeWorkspaceId: newWorkspaceId,
        activeWorkflowId: null,
        creatingWorkflowIds: {},
        pendingCreationIds: {},
      })

      fetchWorkflowsFromDB()
        .then(() => {
          set({ isLoading: false })
          endWorkspaceSwitch()
          logger.info(`✅ Workspace deletion switch to ${newWorkspaceId} completed`)
        })
        .catch((error) => {
          logger.error('Error fetching workflows after workspace deletion:', {
            error,
            workspaceId: newWorkspaceId,
          })
          set({ isLoading: false, error: 'Failed to load workspace data' })
          endWorkspaceSwitch()
        })
    },

    setActiveWorkspace: (id: string) => {
      const currentWorkspaceId = get().activeWorkspaceId

      if (id === currentWorkspaceId) {
        return
      }

      logger.info(`🔄 Switching workspace from ${currentWorkspaceId} to ${id}`)

      startWorkspaceSwitch()
      resetWorkflowStores()

      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
      }

      set({
        isLoading: true,
        workflows: {},
        activeWorkspaceId: id,
        activeWorkflowId: null,
        creatingWorkflowIds: {},
        pendingCreationIds: {},
      })

      fetchWorkflowsFromDB()
        .then(() => {
          set({ isLoading: false })
          endWorkspaceSwitch()
          logger.info(`✅ Workspace switch to ${id} completed successfully`)
        })
        .catch((error) => {
          logger.error('Error fetching workflows for workspace:', { error, workspaceId: id })
          set({ isLoading: false, error: 'Failed to load workspace data' })
          endWorkspaceSwitch()
        })
    },
  }
}
