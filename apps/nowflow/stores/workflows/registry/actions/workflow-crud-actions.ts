/**
 * Workflow CRUD actions for the registry store.
 * Handles create, duplicate, delete, and update operations.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { generateUUID } from '@/lib/utils'
import { API_ENDPOINTS, STORAGE_KEYS } from '../../../constants'
import {
  loadWorkflowState,
  removeFromStorage,
  saveRegistry,
  saveSubblockValues,
  saveWorkflowState,
} from '../../persistence'
import { useSubBlockStore } from '../../subblock/store'
import { workflowSync } from '../../sync'
import { useWorkflowStore } from '../../workflow/store'
import { BlockState } from '../../workflow/types'
import { createEmptyInteraction } from '../helpers'
import { WorkflowMetadata } from '../types'
import { generateUniqueName, getNextWorkflowColor } from '../utils'

const logger = createLogger('WorkflowRegistry')

type WorkflowActionError = Error & {
  status?: number
  code?: string
}

function extractWorkflowActionMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error && typeof error === 'object') {
    if (typeof (error as any).message === 'string' && (error as any).message.trim()) {
      return (error as any).message
    }

    if (typeof (error as any).error === 'string' && (error as any).error.trim()) {
      return (error as any).error
    }
  }

  return fallback
}

function normalizeWorkflowActionError(error: unknown, fallback: string): WorkflowActionError {
  if (error instanceof Error) {
    return error as WorkflowActionError
  }

  const normalizedError = new Error(
    extractWorkflowActionMessage(error, fallback)
  ) as WorkflowActionError

  if (error && typeof error === 'object') {
    if (typeof (error as any).status === 'number') {
      normalizedError.status = (error as any).status
    }

    if (typeof (error as any).code === 'string') {
      normalizedError.code = (error as any).code
    }
  }

  return normalizedError
}

function createWorkflowActionError(
  errorData: unknown,
  status: number,
  fallback: string
): WorkflowActionError {
  const actionError = normalizeWorkflowActionError(errorData, fallback)
  actionError.status = actionError.status ?? status

  if (errorData && typeof errorData === 'object' && typeof (errorData as any).code === 'string') {
    actionError.code = (errorData as any).code
  }

  return actionError
}

function serializeWorkflowActionError(error: unknown) {
  const normalizedError = normalizeWorkflowActionError(error, 'Unknown workflow action error')

  return {
    name: normalizedError.name,
    message: normalizedError.message,
    status: normalizedError.status,
    code: normalizedError.code,
  }
}

export type WorkflowCrudActionsDeps = {
  set: any
  get: any
}

export function createWorkflowCrudActions({ set, get }: WorkflowCrudActionsDeps) {
  return {
    createWorkflow: async (options: any = {}) => {
      const { workflows, activeWorkspaceId } = get()
      const id = generateUUID()
      const creationRequestedAt = Date.now()

      set((state: any) => ({
        creatingWorkflowIds: {
          ...state.creatingWorkflowIds,
          [id]: creationRequestedAt,
        },
        pendingCreationIds: {
          ...state.pendingCreationIds,
          [id]: creationRequestedAt,
        },
      }))

      const clearCreatingWorkflow = () => {
        const creatingWorkflowIds = get().creatingWorkflowIds
        if (!creatingWorkflowIds[id]) return
        set((state: any) => {
          const updatedCreating = { ...state.creatingWorkflowIds }
          delete updatedCreating[id]
          return { creatingWorkflowIds: updatedCreating }
        })
      }

      const clearPendingCreation = () => {
        const pendingCreationIds = get().pendingCreationIds
        if (!pendingCreationIds[id]) return
        set((state: any) => {
          const updatedPending = { ...state.pendingCreationIds }
          delete updatedPending[id]
          return { pendingCreationIds: updatedPending }
        })
      }

      const workspaceId = options.workspaceId || activeWorkspaceId || undefined

      logger.info(`Creating new workflow in workspace: ${workspaceId || 'none'}`)

      const newWorkflow: WorkflowMetadata = {
        id,
        name: options.name || generateUniqueName(workflows),
        lastModified: new Date(),
        description: options.description || 'New workflow',
        color: options.marketplaceId ? '#808080' : getNextWorkflowColor(workflows),
        marketplaceData: options.marketplaceId
          ? { id: options.marketplaceId, status: 'temp' as const }
          : undefined,
        workspaceId,
      }

      let initialState: any

      if (options.marketplaceId && options.marketplaceState) {
        initialState = {
          blocks: options.marketplaceState.blocks || {},
          edges: options.marketplaceState.edges || [],
          loops: options.marketplaceState.loops || {},
          groups: options.marketplaceState.groups || {},
          selectedNodeIds: options.marketplaceState.selectedNodeIds || [],
          isDeployed: false,
          deployedAt: undefined,
          workspaceId,
          history: {
            past: [],
            present: {
              state: {
                blocks: options.marketplaceState.blocks || {},
                edges: options.marketplaceState.edges || [],
                loops: options.marketplaceState.loops || {},
                groups: options.marketplaceState.groups || {},
                selectedNodeIds: options.marketplaceState.selectedNodeIds || [],
                isDeployed: false,
                deployedAt: undefined,
                workspaceId,
              },
              timestamp: Date.now(),
              action: 'Imported from marketplace',
              subblockValues: {},
            },
            future: [],
          },
          lastSaved: Date.now(),
        }

        logger.info(`Created workflow from marketplace: ${options.marketplaceId}`)
      } else {
        const starterId = generateUUID()
        const starterBlock = {
          id: starterId,
          type: 'starter' as const,
          name: 'Start',
          position: { x: 100, y: 100 },
          subBlocks: {
            startWorkflow: { id: 'startWorkflow', type: 'dropdown' as const, value: 'manual' },
            webhookPath: { id: 'webhookPath', type: 'short-input' as const, value: '' },
            webhookSecret: { id: 'webhookSecret', type: 'short-input' as const, value: '' },
            scheduleType: { id: 'scheduleType', type: 'dropdown' as const, value: 'daily' },
            minutesInterval: { id: 'minutesInterval', type: 'short-input' as const, value: '' },
            minutesStartingAt: { id: 'minutesStartingAt', type: 'short-input' as const, value: '' },
            hourlyMinute: { id: 'hourlyMinute', type: 'short-input' as const, value: '' },
            dailyTime: { id: 'dailyTime', type: 'short-input' as const, value: '' },
            weeklyDay: { id: 'weeklyDay', type: 'dropdown' as const, value: 'MON' },
            weeklyDayTime: { id: 'weeklyDayTime', type: 'short-input' as const, value: '' },
            monthlyDay: { id: 'monthlyDay', type: 'short-input' as const, value: '' },
            monthlyTime: { id: 'monthlyTime', type: 'short-input' as const, value: '' },
            cronExpression: { id: 'cronExpression', type: 'short-input' as const, value: '' },
            timezone: { id: 'timezone', type: 'dropdown' as const, value: 'UTC' },
          },
          outputs: {
            response: {
              type: {
                input: 'any',
              },
            },
          },
          enabled: true,
          horizontalHandles: true,
          isWide: false,
          height: 0,
        }

        initialState = {
          blocks: { [starterId]: starterBlock },
          edges: [],
          loops: {},
          groups: {},
          selectedNodeIds: [],
          isDeployed: false,
          deployedAt: undefined,
          workspaceId,
          history: {
            past: [],
            present: {
              state: {
                blocks: { [starterId]: starterBlock },
                edges: [],
                loops: {},
                groups: {},
                selectedNodeIds: [],
                isDeployed: false,
                deployedAt: undefined,
                workspaceId,
              },
              timestamp: Date.now(),
              action: 'Initial state',
              subblockValues: {},
            },
            future: [],
          },
          lastSaved: Date.now(),
        }
      }

      logger.info('📤 Creating workflow in DB via explicit CREATE API')

      try {
        const response = await fetch('/api/workflows/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: newWorkflow.name,
            description: newWorkflow.description,
            color: newWorkflow.color,
            icon: newWorkflow.icon,
            state: initialState,
            workspaceId,
            marketplaceData: newWorkflow.marketplaceData,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const actionError = createWorkflowActionError(
            errorData,
            response.status,
            `Failed to create workflow (${response.status})`
          )

          logger.error(`Failed to create workflow ${id} in database:`, {
            status: response.status,
            message: actionError.message,
            code: actionError.code,
          })
          throw actionError
        }

        logger.info(`✅ Workflow ${id} created in database successfully`)

        set((state: any) => ({
          workflows: {
            ...state.workflows,
            [id]: newWorkflow,
          },
          error: null,
        }))

        const updatedWorkflows = get().workflows
        saveRegistry(updatedWorkflows)
        saveWorkflowState(id, initialState)

        if (options.marketplaceId && options.marketplaceState?.blocks) {
          useSubBlockStore.getState().initializeFromWorkflow(id, options.marketplaceState.blocks)
        }

        if (options.isInitial || Object.keys(updatedWorkflows).length === 1) {
          set({ activeWorkflowId: id })
          useWorkflowStore.setState(initialState)
        } else {
          set({ activeWorkflowId: id })
          useWorkflowStore.setState(initialState)
        }

        logger.info(`Created new workflow with ID ${id} in workspace ${workspaceId || 'none'}`)

        clearCreatingWorkflow()
        return id
      } catch (error) {
        const actionError = normalizeWorkflowActionError(error, 'Failed to create workflow.')
        set({ error: actionError.message })
        logger.error(`Error creating workflow ${id}:`, serializeWorkflowActionError(actionError))
        clearCreatingWorkflow()
        clearPendingCreation()
        throw actionError
      }
    },

    createMarketplaceWorkflow: async (
      marketplaceId: string,
      state: any,
      metadata: Partial<WorkflowMetadata>
    ) => {
      const { workflows } = get()
      const id = generateUUID()

      const newWorkflow: WorkflowMetadata = {
        id,
        name: metadata.name || `Marketplace workflow`,
        lastModified: new Date(),
        description: metadata.description || 'Imported from marketplace',
        color: metadata.color || getNextWorkflowColor(workflows),
        marketplaceData: { id: marketplaceId, status: 'temp' as const },
      }

      const initialState = {
        blocks: state.blocks || {},
        edges: state.edges || [],
        loops: state.loops || {},
        isDeployed: false,
        deployedAt: undefined,
        history: {
          past: [],
          present: {
            state: {
              blocks: state.blocks || {},
              edges: state.edges || [],
              loops: state.loops || {},
              isDeployed: false,
              deployedAt: undefined,
            },
            timestamp: Date.now(),
            action: 'Imported from marketplace',
            subblockValues: {},
          },
          future: [],
        },
        lastSaved: Date.now(),
      }

      const { activeWorkspaceId } = get()
      try {
        const response = await fetch('/api/workflows/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: newWorkflow.name,
            description: newWorkflow.description,
            color: newWorkflow.color,
            state: initialState,
            workspaceId: activeWorkspaceId,
            marketplaceData: newWorkflow.marketplaceData,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          logger.error(`Failed to create marketplace workflow ${id} in database:`, errorData)
          throw new Error(
            errorData.error || `Failed to create marketplace workflow (${response.status})`
          )
        }

        logger.info(`✅ Marketplace workflow ${id} created in database`)

        set((state: any) => ({
          workflows: {
            ...state.workflows,
            [id]: newWorkflow,
          },
          error: null,
        }))

        const updatedWorkflows = get().workflows
        saveRegistry(updatedWorkflows)
        saveWorkflowState(id, initialState)

        if (state.blocks) {
          useSubBlockStore.getState().initializeFromWorkflow(id, state.blocks)
        }

        logger.info(`Created marketplace workflow ${id} imported from ${marketplaceId}`)
        return id
      } catch (error) {
        logger.error(`Error creating marketplace workflow ${id}:`, { error })
        return null
      }
    },

    duplicateWorkflow: async (sourceId: string) => {
      const { workflows } = get()
      const sourceWorkflow = workflows[sourceId]

      if (!sourceWorkflow) {
        const actionError = new Error(`Workflow ${sourceId} not found`) as WorkflowActionError
        set({ error: actionError.message })
        throw actionError
      }

      const id = generateUUID()

      const sourceState = loadWorkflowState(sourceId)
      if (!sourceState) {
        const actionError = new Error(
          `No state found for workflow ${sourceId}`
        ) as WorkflowActionError
        set({ error: actionError.message })
        throw actionError
      }

      const creationRequestedAt = Date.now()
      set((state: any) => ({
        creatingWorkflowIds: {
          ...state.creatingWorkflowIds,
          [id]: creationRequestedAt,
        },
        pendingCreationIds: {
          ...state.pendingCreationIds,
          [id]: creationRequestedAt,
        },
      }))

      const clearCreatingWorkflow = () => {
        const creatingWorkflowIds = get().creatingWorkflowIds
        if (!creatingWorkflowIds[id]) return
        set((state: any) => {
          const updatedCreating = { ...state.creatingWorkflowIds }
          delete updatedCreating[id]
          return { creatingWorkflowIds: updatedCreating }
        })
      }

      const clearPendingCreation = () => {
        const pendingCreationIds = get().pendingCreationIds
        if (!pendingCreationIds[id]) return
        set((state: any) => {
          const updatedPending = { ...state.pendingCreationIds }
          delete updatedPending[id]
          return { pendingCreationIds: updatedPending }
        })
      }

      const newWorkflow: WorkflowMetadata = {
        id,
        name: `${sourceWorkflow.name} (Copy)`,
        lastModified: new Date(),
        description: sourceWorkflow.description,
        color: getNextWorkflowColor(workflows),
      }

      const newState = {
        blocks: sourceState.blocks || {},
        edges: sourceState.edges || [],
        loops: sourceState.loops || {},
        isDeployed: false,
        deployedAt: undefined,
        history: {
          past: [],
          present: {
            state: {
              blocks: sourceState.blocks || {},
              edges: sourceState.edges || [],
              loops: sourceState.loops || {},
              isDeployed: false,
              deployedAt: undefined,
            },
            timestamp: Date.now(),
            action: 'Duplicated workflow',
            subblockValues: {},
          },
          future: [],
        },
        lastSaved: Date.now(),
      }

      const { activeWorkspaceId } = get()
      try {
        const response = await fetch('/api/workflows/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: newWorkflow.name,
            description: newWorkflow.description,
            color: newWorkflow.color,
            state: newState,
            workspaceId: activeWorkspaceId,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          logger.error(`Failed to create duplicated workflow ${id} in database:`, errorData)
          throw createWorkflowActionError(
            errorData,
            response.status,
            `Failed to duplicate workflow (${response.status})`
          )
        }

        logger.info(`✅ Duplicated workflow ${id} created in database`)

        set((state: any) => ({
          workflows: {
            ...state.workflows,
            [id]: newWorkflow,
          },
          error: null,
        }))

        const updatedWorkflows = get().workflows
        saveRegistry(updatedWorkflows)
        saveWorkflowState(id, newState)

        const sourceSubblockValues = useSubBlockStore.getState().workflowValues[sourceId]
        if (sourceSubblockValues) {
          useSubBlockStore.setState((state: any) => ({
            workflowValues: {
              ...state.workflowValues,
              [id]: JSON.parse(JSON.stringify(sourceSubblockValues)),
            },
          }))

          saveSubblockValues(id, JSON.parse(JSON.stringify(sourceSubblockValues)))
        }

        logger.info(`Duplicated workflow ${sourceId} to ${id}`)

        clearCreatingWorkflow()
        return id
      } catch (error) {
        const actionError = normalizeWorkflowActionError(error, 'Failed to duplicate workflow.')
        set({ error: actionError.message })
        logger.error(
          `Error duplicating workflow ${sourceId}:`,
          serializeWorkflowActionError(actionError)
        )
        clearCreatingWorkflow()
        clearPendingCreation()
        throw actionError
      }
    },

    removeWorkflow: (id: string) => {
      const deletionRequestedAt = Date.now()
      set((state: any) => {
        const updatedCreating = { ...state.creatingWorkflowIds }
        delete updatedCreating[id]
        const updatedPending = { ...state.pendingCreationIds }
        delete updatedPending[id]

        return {
          creatingWorkflowIds: updatedCreating,
          pendingCreationIds: updatedPending,
          pendingDeletionIds: {
            ...state.pendingDeletionIds,
            [id]: deletionRequestedAt,
          },
        }
      })

      const clearPendingDeletion = () => {
        const pendingDeletionIds = get().pendingDeletionIds
        if (!pendingDeletionIds[id]) return
        set((state: any) => {
          const updatedPending = { ...state.pendingDeletionIds }
          delete updatedPending[id]
          return { pendingDeletionIds: updatedPending }
        })
      }

      fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            logger.error(`Failed to delete workflow ${id} from database:`, {
              status: response.status,
              error: errorData.error || 'Unknown error',
            })
            clearPendingDeletion()
          } else {
            logger.info(`✅ Workflow ${id} deleted from database via explicit DELETE API`)
          }
        })
        .catch((error) => {
          logger.error(`Error calling DELETE API for workflow ${id}:`, { error })
          clearPendingDeletion()
        })

      fetch(API_ENDPOINTS.SCHEDULE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: id,
          state: { blocks: {} },
        }),
      }).catch((error) => {
        logger.error(`Error cancelling schedule for deleted workflow ${id}:`, { error })
      })

      set((state: any) => {
        const newWorkflows = { ...state.workflows }
        delete newWorkflows[id]

        removeFromStorage(STORAGE_KEYS.WORKFLOW(id))
        removeFromStorage(STORAGE_KEYS.SUBBLOCK(id))
        saveRegistry(newWorkflows)

        let newActiveWorkflowId = state.activeWorkflowId
        if (state.activeWorkflowId === id) {
          const remainingIds = Object.keys(newWorkflows)
          newActiveWorkflowId = remainingIds[0]
          const savedState = loadWorkflowState(newActiveWorkflowId)
          if (savedState) {
            const { blocks, edges, history, loops, isDeployed, deployedAt } = savedState

            const validBlocks = Object.fromEntries(
              Object.entries(blocks || {}).filter(([blockId, block]) => {
                if (
                  !block ||
                  typeof block !== 'object' ||
                  !('type' in block) ||
                  !('name' in block)
                ) {
                  logger.warn(`Removing invalid block during workflow switch: ${blockId}`, {
                    hasBlock: !!block,
                    type: (block as any)?.type,
                    name: (block as any)?.name,
                  })
                  return false
                }
                return true
              })
            ) as Record<string, BlockState>

            useWorkflowStore.setState({
              blocks: validBlocks,
              edges,
              loops,
              isDeployed: isDeployed || false,
              deployedAt: deployedAt ? new Date(deployedAt) : undefined,
              hasActiveSchedule: false,
              history: history || {
                past: [],
                present: {
                  state: {
                    blocks: validBlocks,
                    edges,
                    loops,
                    isDeployed: isDeployed || false,
                    deployedAt,
                  },
                  timestamp: Date.now(),
                  action: 'Initial state',
                  subblockValues: {},
                },
                future: [],
              },
            })
          } else {
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
          }
        }

        return {
          workflows: newWorkflows,
          activeWorkflowId: newActiveWorkflowId,
          error: null,
        }
      })
    },

    updateWorkflow: async (id: string, metadata: Partial<WorkflowMetadata>) => {
      try {
        logger.debug('Updating workflow:', { id, metadata })

        const currentState = get()
        const workflow = currentState.workflows[id]

        if (!workflow) {
          logger.debug('Workflow not found in local state:', id)
          throw new Error('Workflow not found in local state')
        }

        const isNewWorkflow =
          !workflow.lastModified || Date.now() - workflow.lastModified.getTime() < 5000

        if (isNewWorkflow) {
          logger.debug('Detected new workflow, updating locally only for now:', id)

          set((state: any) => {
            const updatedWorkflows = {
              ...state.workflows,
              [id]: {
                ...workflow,
                ...metadata,
                lastModified: new Date(),
              },
            }

            saveRegistry(updatedWorkflows)

            return {
              workflows: updatedWorkflows,
              error: null,
            }
          })

          setTimeout(async () => {
            try {
              logger.debug('Attempting delayed API update for new workflow:', id)
              await get().updateWorkflow(id, metadata)
            } catch {
              logger.debug('Delayed update will be handled by next sync')
            }
          }, 3000)

          return
        }

        set((state: any) => {
          const updatedWorkflows = {
            ...state.workflows,
            [id]: {
              ...workflow,
              ...metadata,
              lastModified: new Date(),
            },
          }

          saveRegistry(updatedWorkflows)

          return {
            workflows: updatedWorkflows,
            error: null,
          }
        })

        const response = await fetch(`/api/workflows/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update workflow')
        }

        const result = await response.json()
        logger.debug('Workflow updated successfully:', result.workflow)

        workflowSync.sync()
      } catch (error: any) {
        console.error('❌ [REGISTRY] Failed to update workflow:', error)

        const currentState = get()
        const workflow = currentState.workflows[id]
        const isNewWorkflow =
          workflow &&
          (!workflow.lastModified || Date.now() - workflow.lastModified.getTime() < 5000)

        if (!isNewWorkflow) {
          set((state: any) => ({
            ...state,
            error: `Failed to update workflow: ${error.message}`,
          }))
        }

        throw error
      }
    },
  }
}
