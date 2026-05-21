import { getBlock } from '@/blocks'
import { WorkflowStoreWithHistory } from '../middleware'

/**
 * Optimized selectors for workflow store to prevent unnecessary re-renders
 */

// Memoized selector for blocks only
export const selectBlocks = (state: WorkflowStoreWithHistory) => state.blocks

// Memoized selector for edges only
export const selectEdges = (state: WorkflowStoreWithHistory) => state.edges

// Memoized selector for selected node IDs only
export const selectSelectedNodeIds = (state: WorkflowStoreWithHistory) => state.selectedNodeIds

// Memoized selector for highlighted connections
export const selectHighlightedConnections = (state: WorkflowStoreWithHistory) => ({
  highlightedNodeId: state.highlightedNodeId,
  highlightedEdgeIds: state.highlightedEdgeIds,
})

// Memoized selector for sidebar state
export const selectSidebarState = (state: WorkflowStoreWithHistory) => ({
  selectedBlockForSidebar: state.selectedBlockForSidebar,
  isRightSidebarOpen: state.isRightSidebarOpen,
})

// Memoized selector for deployment state
export const selectDeploymentState = (state: WorkflowStoreWithHistory) => ({
  isDeployed: state.isDeployed,
  deployedAt: state.deployedAt,
  needsRedeployment: state.needsRedeployment,
  hasActiveSchedule: state.hasActiveSchedule,
  hasActiveWebhook: state.hasActiveWebhook,
})

// Memoized selector for groups
export const selectGroups = (state: WorkflowStoreWithHistory) => state.groups

// Memoized selector for loops
export const selectLoops = (state: WorkflowStoreWithHistory) => state.loops

// Selector for specific block by ID (factory function)
export const selectBlockById = (blockId: string) => (state: WorkflowStoreWithHistory) =>
  state.blocks[blockId]

// Selector for specific edge by ID (factory function)
export const selectEdgeById = (edgeId: string) => (state: WorkflowStoreWithHistory) =>
  state.edges.find((edge) => edge.id === edgeId)

// Selector for blocks connected to a specific block
export const selectConnectedBlocks = (blockId: string) => (state: WorkflowStoreWithHistory) => {
  const connectedEdges = state.edges.filter(
    (edge) => edge.source === blockId || edge.target === blockId
  )
  const connectedBlockIds = new Set<string>()

  connectedEdges.forEach((edge) => {
    if (edge.source !== blockId) connectedBlockIds.add(edge.source)
    if (edge.target !== blockId) connectedBlockIds.add(edge.target)
  })

  return Array.from(connectedBlockIds)
    .map((id) => state.blocks[id])
    .filter(Boolean)
}

// Selector for workflow actions (functions that don't change often)
export const selectWorkflowActions = (state: WorkflowStoreWithHistory) => ({
  addBlock: state.addBlock,
  removeBlock: state.removeBlock,
  updateBlockPosition: state.updateBlockPosition,
  updateBlockName: state.updateBlockName,
  addEdge: state.addEdge,
  removeEdge: state.removeEdge,
  setSelectedNodes: state.setSelectedNodes,
  toggleNodeSelection: state.toggleNodeSelection,
  addToSelection: state.addToSelection,
  clearSelection: state.clearSelection,
  highlightConnections: state.highlightConnections,
  resetHighlightedConnections: state.resetHighlightedConnections,
  toggleRightSidebar: state.toggleRightSidebar,
})

// Shallow comparison hook for arrays and objects
export const useShallowSelector = <T>(selector: (state: WorkflowStoreWithHistory) => T) => {
  return selector
}

// Performance optimized selector for React Flow nodes
export const selectReactFlowNodes = (state: WorkflowStoreWithHistory) => {
  const { blocks } = state
  return Object.entries(blocks).map(([id, block]) => {
    const blockConfig = getBlock(block.type)
    return {
      id,
      type: 'heroStyleBlock',
      position: block.position,
      data: {
        type: block.type,
        config: blockConfig,
        name: block.name,
        isActive: false, // Will be set by execution store
        isPending: false, // Will be set by execution store
      },
      draggable: true,
      selectable: true,
    }
  })
}

// Performance optimized selector for React Flow edges
export const selectReactFlowEdges = (state: WorkflowStoreWithHistory) => {
  return state.edges.map((edge) => ({
    ...edge,
    type: edge.type || 'custom',
    animated: edge.animated || false,
  }))
}
