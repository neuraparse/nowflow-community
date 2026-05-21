import { Edge } from '@xyflow/react'
import { CustomEdge, GroupState } from '@/stores/workflows/workflow/types'

/**
 * Check if a node is part of any group
 */
export function getNodeGroup(
  nodeId: string,
  groups: Record<string, GroupState>
): GroupState | null {
  return Object.values(groups).find((group) => group.nodeIds.includes(nodeId)) || null
}

/**
 * Calculate the center position of a group of nodes
 */
export function calculateGroupCenter(
  nodeIds: string[],
  blocks: Record<string, any>
): { x: number; y: number } {
  const positions = nodeIds.map((id) => blocks[id]?.position).filter(Boolean)

  if (positions.length === 0) {
    return { x: 0, y: 0 }
  }

  const centerX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
  const centerY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length

  return { x: centerX, y: centerY }
}

/**
 * Check if a group has external connections
 */
export function hasExternalConnections(group: GroupState, edges: Edge[]): boolean {
  const groupNodeIds = new Set(group.nodeIds)

  return edges.some((edge) => {
    const sourceInGroup = groupNodeIds.has(edge.source)
    const targetInGroup = groupNodeIds.has(edge.target)

    // External connection if only one end is in the group
    return sourceInGroup !== targetInGroup
  })
}

/**
 * Get external edges for a group (edges that connect to nodes outside the group)
 */
export function getExternalEdges(group: GroupState, edges: CustomEdge[]): CustomEdge[] {
  const groupNodeIds = new Set(group.nodeIds)

  return edges.filter((edge) => {
    const sourceInGroup = groupNodeIds.has(edge.source)
    const targetInGroup = groupNodeIds.has(edge.target)

    // External connection if only one end is in the group
    return sourceInGroup !== targetInGroup
  })
}

/**
 * Get internal edges for a group (edges between nodes within the group)
 */
export function getInternalEdges(group: GroupState, edges: CustomEdge[]): CustomEdge[] {
  const groupNodeIds = new Set(group.nodeIds)

  return edges.filter((edge) => {
    const sourceInGroup = groupNodeIds.has(edge.source)
    const targetInGroup = groupNodeIds.has(edge.target)

    // Internal connection if both ends are in the group
    return sourceInGroup && targetInGroup
  })
}

/**
 * Generate a unique group name
 */
export function generateGroupName(existingGroups: Record<string, GroupState>): string {
  const existingNames = new Set(Object.values(existingGroups).map((g) => g.name))
  let counter = 1

  while (existingNames.has(`Group ${counter}`)) {
    counter++
  }

  return `Group ${counter}`
}

/**
 * Validate if nodes can be grouped together
 */
export function canGroupNodes(
  nodeIds: string[],
  groups: Record<string, GroupState>
): { canGroup: boolean; reason?: string } {
  if (nodeIds.length < 2) {
    return { canGroup: false, reason: 'At least 2 nodes required for grouping' }
  }

  // Check if any nodes are already in other groups
  const nodesInGroups = nodeIds.filter((nodeId) =>
    Object.values(groups).some((group) => group.nodeIds.includes(nodeId))
  )

  if (nodesInGroups.length > 0) {
    return {
      canGroup: false,
      reason: `Some nodes are already in groups: ${nodesInGroups.join(', ')}`,
    }
  }

  return { canGroup: true }
}

/**
 * Detect circular dependencies in group relationships
 */
export function detectGroupCircularDependency(
  groups: Record<string, GroupState>,
  edges: CustomEdge[]
): { hasCircularDependency: boolean; cycle?: string[] } {
  // Build adjacency list for groups based on their internal node connections
  const groupAdjacency = new Map<string, Set<string>>()

  Object.keys(groups).forEach((groupId) => {
    groupAdjacency.set(groupId, new Set())
  })

  // Check connections between groups
  edges.forEach((edge) => {
    const sourceGroup = getNodeGroup(edge.source, groups)
    const targetGroup = getNodeGroup(edge.target, groups)

    if (sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
      groupAdjacency.get(sourceGroup.id)?.add(targetGroup.id)
    }
  })

  // DFS to detect cycles
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(groupId: string, path: string[]): string[] | null {
    if (recursionStack.has(groupId)) {
      // Found cycle
      const cycleStart = path.indexOf(groupId)
      return path.slice(cycleStart)
    }

    if (visited.has(groupId)) {
      return null
    }

    visited.add(groupId)
    recursionStack.add(groupId)
    path.push(groupId)

    const neighbors = groupAdjacency.get(groupId) || new Set()
    for (const neighbor of neighbors) {
      const cycle = dfs(neighbor, [...path])
      if (cycle) {
        return cycle
      }
    }

    recursionStack.delete(groupId)
    return null
  }

  for (const groupId of Object.keys(groups)) {
    if (!visited.has(groupId)) {
      const cycle = dfs(groupId, [])
      if (cycle) {
        return { hasCircularDependency: true, cycle }
      }
    }
  }

  return { hasCircularDependency: false }
}

/**
 * Get group hierarchy depth (for nested groups)
 */
export function getGroupDepth(groupId: string, groups: Record<string, GroupState>): number {
  const group = groups[groupId]
  if (!group || !group.parentGroupId) {
    return 0
  }

  return 1 + getGroupDepth(group.parentGroupId, groups)
}

/**
 * Get all child groups (for nested groups)
 */
export function getChildGroups(
  parentGroupId: string,
  groups: Record<string, GroupState>
): GroupState[] {
  return Object.values(groups).filter((group) => group.parentGroupId === parentGroupId)
}
