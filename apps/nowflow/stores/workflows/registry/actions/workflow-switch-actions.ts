/**
 * Workflow switching action for the registry store.
 * Handles saving current workflow state and loading the target workflow.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { loadWorkflowState, saveSubblockValues, saveWorkflowState } from '../../persistence'
import { useSubBlockStore } from '../../subblock/store'
import { useWorkflowStore } from '../../workflow/store'
import { BlockState } from '../../workflow/types'
import { createEmptyInteraction } from '../helpers'

const logger = createLogger('WorkflowRegistry')

export type WorkflowSwitchActionsDeps = {
  set: any
  get: any
}

export function createWorkflowSwitchActions({ set, get }: WorkflowSwitchActionsDeps) {
  return {
    setActiveWorkflow: async (id: string) => {
      const { workflows, activeWorkflowId } = get()

      if (activeWorkflowId === id) {
        logger.debug(`⚡ Already on workflow ${id} - skipping switch`)
        return
      }

      set({ isLoadingWorkflow: true })

      try {
        const workflow = workflows[id]

        if (!workflow) {
          set({ error: `Workflow ${id} not found` })
          return
        }

        // Save current workflow state before switching
        const currentId = get().activeWorkflowId
        if (currentId) {
          const currentState = useWorkflowStore.getState()

          saveWorkflowState(currentId, {
            blocks: currentState.blocks,
            edges: currentState.edges,
            loops: currentState.loops,
            groups: currentState.groups,
            selectedNodeIds: currentState.selectedNodeIds,
            history: currentState.history,
            isDeployed: currentState.isDeployed,
            deployedAt: currentState.deployedAt,
            lastSaved: Date.now(),
          })

          const currentSubblockValues = useSubBlockStore.getState().workflowValues[currentId]
          if (currentSubblockValues) {
            saveSubblockValues(currentId, currentSubblockValues)
          }
        }

        // Try to get the workflow from registry (which was loaded from DB)
        const workflowFromRegistry = workflows[id]
        let parsedState = null

        if (workflowFromRegistry?.state) {
          logger.info(`✅ Loading workflow ${id} from DB state (source of truth)`)
          parsedState = workflowFromRegistry.state
        } else {
          logger.warn(`⚠️ Loading workflow ${id} from localStorage (DB state not available)`)
          parsedState = loadWorkflowState(id)
        }

        if (parsedState) {
          const { blocks, edges, history, loops, groups, selectedNodeIds, isDeployed, deployedAt } =
            parsedState

          // Validate and clean blocks before loading
          const validBlocks = Object.fromEntries(
            Object.entries(blocks || {}).filter(([blockId, block]) => {
              if (!block || typeof block !== 'object' || !('type' in block) || !('name' in block)) {
                logger.warn(`Removing invalid block during workflow load: ${blockId}`, {
                  hasBlock: !!block,
                  type: (block as any)?.type,
                  name: (block as any)?.name,
                })
                return false
              }
              return true
            })
          ) as Record<string, BlockState>

          // Initialize subblock store with workflow values
          useSubBlockStore.getState().initializeFromWorkflow(id, validBlocks)

          // Set the workflow store state with the loaded state
          useWorkflowStore.setState({
            blocks: validBlocks,
            edges,
            loops,
            groups: groups || {},
            selectedNodeIds: selectedNodeIds || [],
            isDeployed: isDeployed !== undefined ? isDeployed : false,
            deployedAt: deployedAt ? new Date(deployedAt) : undefined,
            hasActiveSchedule: false,
            history: history || {
              past: [],
              present: {
                state: {
                  blocks: validBlocks,
                  edges,
                  loops: loops || {},
                  groups: groups || {},
                  selectedNodeIds: selectedNodeIds || [],
                  highlightedNodeId: null,
                  highlightedEdgeIds: [],
                  selectedBlockForSidebar: null,
                  isRightSidebarOpen: false,
                  isDeployed: isDeployed !== undefined ? isDeployed : false,
                  deployedAt: deployedAt,
                  needsRedeployment: false,
                  hasActiveSchedule: false,
                  hasActiveWebhook: false,
                  lastSaved: undefined,
                  lastUpdate: undefined,
                },
                timestamp: Date.now(),
                action: 'Initial state',
                subblockValues: {},
              },
              future: [],
            },
            lastSaved: parsedState.lastSaved || Date.now(),
          })

          logger.info(`Switched to workflow ${id}`)
        } else {
          // If no saved state, initialize with empty state
          useWorkflowStore.setState({
            blocks: {},
            edges: [],
            loops: {},
            groups: {},
            selectedNodeIds: [],
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

          logger.warn(`No saved state found for workflow ${id}, initialized with empty state`)
        }

        // Update the active workflow ID
        set({ activeWorkflowId: id, error: null })

        if (typeof window !== 'undefined') {
          localStorage.setItem('last-active-workflow-id', id)
        }

        logger.info(`✅ Workflow ${id} loaded successfully`)
      } catch (error) {
        logger.error(`❌ Error loading workflow ${id}:`, error)
        set({ error: `Failed to load workflow: ${error}` })
      } finally {
        set({ isLoadingWorkflow: false })
      }
    },
  }
}
