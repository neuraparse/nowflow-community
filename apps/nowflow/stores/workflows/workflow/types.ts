import { Edge } from '@xyflow/react'
import { BlockOutput, SubBlockType } from '@/blocks/types'

export type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy'

export type EdgeThickness = 'thin' | 'medium' | 'thick' | 'extra-thick'

export type EdgeColor =
  | 'default'
  | 'blue'
  | 'green'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'pink'
  | 'indigo'

export type EdgeAnimation = 'none' | 'flow' | 'pulse' | 'dash'

export interface Position {
  x: number
  y: number
}

/**
 * Batch operation types for performance optimization (v2.0)
 */
export interface BatchBlockUpdate {
  id: string
  changes: Partial<Omit<BlockState, 'id'>>
}

export interface BatchEdgeUpdate {
  id: string
  changes: Partial<Omit<CustomEdge, 'id'>>
}

export interface BlockState {
  id: string
  type: string
  name: string
  position: Position
  subBlocks: Record<string, SubBlockState>
  outputs: Record<string, BlockOutput>
  enabled: boolean
  horizontalHandles?: boolean
  isWide?: boolean
  height?: number
  isMinimized?: boolean
  bookmarked?: boolean
  nodeStyle?: 'default' | 'hero' // Node rendering style
  isNew?: boolean // Highlight newly added blocks
  createdAt?: number // Timestamp when block was created
}

export interface SubBlockState {
  id: string
  type: SubBlockType
  value: string | number | string[][] | null
}

export interface Loop {
  id: string
  nodes: string[]
  iterations: number
  loopType: 'for' | 'forEach'
  forEachItems?: any[] | Record<string, any> | string // Items or expression
}

export interface CustomEdge extends Omit<Edge, 'style'> {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  edgeStyle?: EdgeStyle
  thickness?: EdgeThickness
  color?: EdgeColor
  animation?: EdgeAnimation
  label?: string
}

export interface GroupState {
  id: string
  name: string
  nodeIds: string[]
  color?: string
  createdAt: number
  parentGroupId?: string // For nested groups (future feature)
  depth?: number // Nesting depth (future feature)
  // Legacy fields (kept for backward compatibility with saved workflows)
  position?: Position
  isExpanded?: boolean
}

// Interaction tracking for smart sync
export interface InteractionState {
  isDragging: boolean // User is currently dragging nodes
  isEditing: boolean // User is currently editing (typing in inputs)
  lastInteractionTime: number // Timestamp of last user interaction
  lastDurableChangeTime: number // Timestamp of last durable change (add/delete/move)
}

export interface WorkflowState {
  blocks: Record<string, BlockState>
  edges: CustomEdge[]
  lastSaved?: number
  loops: Record<string, Loop>
  groups: Record<string, GroupState>
  selectedNodeIds: string[]
  lastUpdate?: number
  isDeployed?: boolean
  deployedAt?: Date
  needsRedeployment?: boolean
  hasActiveSchedule?: boolean
  hasActiveWebhook?: boolean
  highlightedNodeId: string | null
  highlightedEdgeIds: string[]
  // Right sidebar state
  selectedBlockForSidebar: string | null
  isRightSidebarOpen: boolean
  // Interaction tracking for smart sync
  interaction: InteractionState
}

export interface WorkflowActions {
  addBlock: (id: string, type: string, name: string, position: Position) => void
  updateBlockPosition: (id: string, position: Position) => void
  removeBlock: (id: string) => void
  addEdge: (edge: Edge) => CustomEdge | null
  removeEdge: (edgeId: string) => void
  clear: () => Partial<WorkflowState>
  updateLastSaved: () => void
  toggleBlockEnabled: (id: string) => void
  duplicateBlock: (id: string) => void
  toggleBlockHandles: (id: string) => void
  updateBlockName: (id: string, name: string) => void
  updateBlock: (id: string, updates: Partial<BlockState>) => void
  toggleBlockWide: (id: string) => void
  toggleBlockMinimized: (id: string) => void
  toggleBlockNodeStyle: (id: string) => void
  updateBlockHeight: (id: string, height: number) => void
  toggleEdgeStyle: (edgeId: string) => void
  updateEdgeStyle: (edgeId: string, style: EdgeStyle) => void
  updateEdgeThickness: (edgeId: string, thickness: EdgeThickness) => void
  updateEdgeColor: (edgeId: string, color: EdgeColor) => void
  updateEdgeAnimation: (edgeId: string, animation: EdgeAnimation) => void
  updateEdgeLabel: (edgeId: string, label: string) => void
  triggerUpdate: () => void
  updateLoopIterations: (loopId: string, iterations: number) => void
  updateLoopType: (loopId: string, loopType: Loop['loopType']) => void
  updateLoopForEachItems: (loopId: string, items: string) => void
  setNeedsRedeploymentFlag: (needsRedeployment: boolean) => void
  setDeploymentStatus: (isDeployed: boolean, deployedAt?: Date) => void
  setScheduleStatus: (hasActiveSchedule: boolean) => void
  setWebhookStatus: (hasActiveWebhook: boolean) => void
  highlightConnections: (nodeId: string) => void
  resetHighlightedConnections: () => void
  // Group management actions
  createGroup: (nodeIds: string[], name?: string, color?: string) => string
  deleteGroup: (groupId: string) => void
  updateGroupName: (groupId: string, name: string) => void
  updateGroupColor: (groupId: string, color: string) => void
  addNodeToGroup: (groupId: string, nodeId: string) => void
  removeNodeFromGroup: (groupId: string, nodeId: string) => void
  // Selection management actions
  setSelectedNodes: (nodeIds: string[]) => void
  addToSelection: (nodeId: string) => void
  removeFromSelection: (nodeId: string) => void
  clearSelection: () => void
  toggleNodeSelection: (nodeId: string) => void
  // Right sidebar actions
  openRightSidebar: (blockId: string) => void
  closeRightSidebar: () => void
  toggleRightSidebar: (blockId?: string) => void
  // Block management actions
  toggleBlockBookmark: (blockId: string) => void
  resetBlock: (blockId: string) => void
  // Batch operations (v2.0) - Type-safe batch updates
  batchUpdateBlocks: (updates: BatchBlockUpdate[]) => void
  batchUpdateEdges: (updates: BatchEdgeUpdate[]) => void
  batchDeleteBlocks: (blockIds: string[]) => void
  // Interaction tracking for smart sync
  setDragging: (isDragging: boolean) => void
  setEditing: (isEditing: boolean) => void
  markInteraction: () => void // Mark any user interaction (ephemeral)
  markDurableChange: () => void // Mark a durable change (needs sync)
}

export type WorkflowStore = WorkflowState & WorkflowActions
