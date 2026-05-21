import { createLogger } from '@/lib/logs/console-logger'
import { loadWorkflowState } from './persistence'
import { useWorkflowRegistry } from './registry/store'
import { useSubBlockStore } from './subblock/store'
import { mergeSubblockState, stripTransientBlockFields } from './utils'
import { useWorkflowStore } from './workflow/store'
import { BlockState, WorkflowState } from './workflow/types'

const logger = createLogger('Workflows')

// Get a workflow with its state merged in by ID
export function getWorkflowWithValues(workflowId: string) {
  const { workflows } = useWorkflowRegistry.getState()
  const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
  const currentState = useWorkflowStore.getState()

  if (!workflows[workflowId]) {
    logger.warn(`Workflow ${workflowId} not found`)
    return null
  }

  const metadata = workflows[workflowId]

  // Load the specific state for this workflow
  let workflowState: WorkflowState

  if (workflowId === activeWorkflowId) {
    // For the active workflow, use the current state from the store
    workflowState = {
      blocks: currentState.blocks,
      edges: currentState.edges,
      loops: currentState.loops,
      groups: currentState.groups, // FIX: Include groups
      selectedNodeIds: currentState.selectedNodeIds, // FIX: Include selectedNodeIds
      highlightedNodeId: currentState.highlightedNodeId,
      highlightedEdgeIds: currentState.highlightedEdgeIds,
      selectedBlockForSidebar: currentState.selectedBlockForSidebar,
      isRightSidebarOpen: currentState.isRightSidebarOpen,
      isDeployed: currentState.isDeployed,
      deployedAt: currentState.deployedAt,
      lastSaved: currentState.lastSaved,
      needsRedeployment: currentState.needsRedeployment,
      hasActiveSchedule: currentState.hasActiveSchedule,
      hasActiveWebhook: currentState.hasActiveWebhook,
      lastUpdate: currentState.lastUpdate,
      interaction: currentState.interaction || {
        isDragging: false,
        isEditing: false,
        lastInteractionTime: 0,
        lastDurableChangeTime: 0,
      },
    }
  } else {
    // For other workflows, load their state from localStorage
    const savedState = loadWorkflowState(workflowId)
    if (!savedState) {
      logger.warn(`No saved state found for workflow ${workflowId}`)
      return null
    }

    // Validate and clean blocks before using
    const validBlocks = Object.fromEntries(
      Object.entries(savedState.blocks || {}).filter(([blockId, block]) => {
        if (!block || typeof block !== 'object' || !('type' in block) || !('name' in block)) {
          logger.warn(`Removing invalid block from workflow ${workflowId}: ${blockId}`, {
            hasBlock: !!block,
            type: (block as any)?.type,
            name: (block as any)?.name,
          })
          return false
        }
        return true
      })
    )

    workflowState = {
      ...savedState,
      blocks: validBlocks,
    }
  }

  // Merge the subblock values for this specific workflow
  const mergedBlocks = mergeSubblockState(workflowState.blocks, workflowId)

  return {
    id: workflowId,
    name: metadata.name,
    description: metadata.description,
    color: metadata.color || '#3972F6',
    marketplaceData: metadata.marketplaceData || null,
    state: {
      blocks: stripTransientBlockFields(mergedBlocks),
      edges: workflowState.edges,
      loops: workflowState.loops,
      groups: workflowState.groups || {}, // FIX: Include groups
      selectedNodeIds: workflowState.selectedNodeIds || [], // FIX: Include selectedNodeIds
      lastSaved: workflowState.lastSaved,
      isDeployed: workflowState.isDeployed,
      deployedAt: workflowState.deployedAt,
    },
  }
}

// Get a specific block with its subblock values merged in
export function getBlockWithValues(blockId: string): BlockState | null {
  const workflowState = useWorkflowStore.getState()
  const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId

  if (!activeWorkflowId || !workflowState.blocks[blockId]) return null

  const mergedBlocks = mergeSubblockState(workflowState.blocks, activeWorkflowId, blockId)
  return mergedBlocks[blockId] || null
}

// Get all workflows with their values merged
export function getAllWorkflowsWithValues() {
  const { workflows, activeWorkspaceId } = useWorkflowRegistry.getState()
  const result: Record<string, any> = {}
  const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
  const currentState = useWorkflowStore.getState()

  // Log for debugging
  logger.info(`Preparing workflows for sync with active workspace: ${activeWorkspaceId}`)

  for (const [id, metadata] of Object.entries(workflows)) {
    // Skip workflows that don't belong to the active workspace
    if (activeWorkspaceId && metadata.workspaceId !== activeWorkspaceId) {
      logger.debug(
        `Skipping workflow ${id} - belongs to workspace ${metadata.workspaceId}, not active workspace ${activeWorkspaceId}`
      )
      continue
    }

    // Load the specific state for this workflow
    let workflowState: WorkflowState

    if (id === activeWorkflowId) {
      // For the active workflow, use the current state from the store
      workflowState = {
        blocks: currentState.blocks,
        edges: currentState.edges,
        loops: currentState.loops,
        groups: currentState.groups, // FIX: Include groups from current state
        selectedNodeIds: currentState.selectedNodeIds, // FIX: Include selectedNodeIds
        highlightedNodeId: currentState.highlightedNodeId,
        highlightedEdgeIds: currentState.highlightedEdgeIds,
        selectedBlockForSidebar: currentState.selectedBlockForSidebar,
        isRightSidebarOpen: currentState.isRightSidebarOpen,
        isDeployed: currentState.isDeployed,
        deployedAt: currentState.deployedAt,
        lastSaved: currentState.lastSaved,
        needsRedeployment: currentState.needsRedeployment,
        hasActiveSchedule: currentState.hasActiveSchedule,
        hasActiveWebhook: currentState.hasActiveWebhook,
        lastUpdate: currentState.lastUpdate,
        interaction: currentState.interaction || {
          isDragging: false,
          isEditing: false,
          lastInteractionTime: 0,
          lastDurableChangeTime: 0,
        },
      }
    } else {
      // For other workflows, load their state from localStorage
      const savedState = loadWorkflowState(id)
      if (!savedState) {
        // Skip workflows with no saved state
        logger.warn(`No saved state found for workflow ${id}`)
        continue
      }

      // Validate and clean blocks before using
      const validBlocks = Object.fromEntries(
        Object.entries(savedState.blocks || {}).filter(([blockId, block]) => {
          if (!block || typeof block !== 'object' || !('type' in block) || !('name' in block)) {
            logger.warn(`Removing invalid block from workflow ${id}: ${blockId}`, {
              hasBlock: !!block,
              type: (block as any)?.type,
              name: (block as any)?.name,
            })
            return false
          }
          return true
        })
      )

      workflowState = {
        ...savedState,
        blocks: validBlocks,
      }
    }

    // Merge the subblock values for this specific workflow
    const mergedBlocks = mergeSubblockState(workflowState.blocks, id)

    // CRITICAL FIX: Include toolParams for cross-device API key persistence
    // Get toolParams from subblock store to sync API keys to database
    const { toolParams } = useSubBlockStore.getState()

    result[id] = {
      id,
      name: metadata.name,
      description: metadata.description,
      color: metadata.color || '#3972F6',
      marketplaceData: metadata.marketplaceData || null,
      workspaceId: metadata.workspaceId, // Include workspaceId in the result
      state: {
        blocks: stripTransientBlockFields(mergedBlocks),
        edges: workflowState.edges,
        loops: workflowState.loops,
        groups: workflowState.groups || {}, // FIX: Include groups in sync payload
        selectedNodeIds: workflowState.selectedNodeIds || [], // FIX: Include selectedNodeIds
        lastSaved: workflowState.lastSaved,
        isDeployed: workflowState.isDeployed,
        deployedAt: workflowState.deployedAt,
        toolParams: toolParams || {}, // CRITICAL FIX: Include API keys for cross-device sync
      },
    }
  }

  logger.info(
    `Prepared ${Object.keys(result).length} workflows for sync from workspace ${activeWorkspaceId}`
  )
  return result
}

export { useWorkflowRegistry, useWorkflowStore, useSubBlockStore }
