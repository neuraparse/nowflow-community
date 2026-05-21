/**
 * Common validation utilities for workflow operations
 * Centralizes validation logic to ensure consistency
 *
 * @module stores/workflows/common/validators
 */
import { Edge } from '@xyflow/react'
import { BlockState, CustomEdge, Loop } from '../workflow/types'

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
}

/**
 * Validates block ID
 */
export function validateBlockId(blockId: string): ValidationResult {
  if (!blockId) {
    return {
      valid: false,
      error: 'Block ID is required',
    }
  }

  if (typeof blockId !== 'string') {
    return {
      valid: false,
      error: 'Block ID must be a string',
    }
  }

  return { valid: true }
}

/**
 * Validates block existence in workflow
 */
export function validateBlockExists(
  blockId: string,
  blocks: Record<string, BlockState>
): ValidationResult {
  const idValidation = validateBlockId(blockId)
  if (!idValidation.valid) {
    return idValidation
  }

  if (!blocks[blockId]) {
    return {
      valid: false,
      error: `Block not found: ${blockId}`,
    }
  }

  return { valid: true }
}

/**
 * Validates block state structure
 */
export function validateBlockState(block: any): ValidationResult {
  const warnings: string[] = []

  if (!block) {
    return {
      valid: false,
      error: 'Block is null or undefined',
    }
  }

  if (!block.id) {
    return {
      valid: false,
      error: 'Block must have an ID',
    }
  }

  if (!block.type) {
    return {
      valid: false,
      error: 'Block must have a type',
    }
  }

  if (!block.name) {
    warnings.push('Block should have a name')
  }

  if (
    !block.position ||
    typeof block.position.x !== 'number' ||
    typeof block.position.y !== 'number'
  ) {
    return {
      valid: false,
      error: 'Block must have a valid position with x and y coordinates',
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validates position data
 */
export function validatePosition(position: any): ValidationResult {
  if (!position) {
    return {
      valid: false,
      error: 'Position is required',
    }
  }

  if (typeof position.x !== 'number' || typeof position.y !== 'number') {
    return {
      valid: false,
      error: 'Position must have numeric x and y coordinates',
    }
  }

  if (!isFinite(position.x) || !isFinite(position.y)) {
    return {
      valid: false,
      error: 'Position coordinates must be finite numbers',
    }
  }

  return { valid: true }
}

/**
 * Validates edge data
 */
export function validateEdge(edge: any): ValidationResult {
  if (!edge) {
    return {
      valid: false,
      error: 'Edge is null or undefined',
    }
  }

  if (!edge.source) {
    return {
      valid: false,
      error: 'Edge must have a source',
    }
  }

  if (!edge.target) {
    return {
      valid: false,
      error: 'Edge must have a target',
    }
  }

  if (edge.source === edge.target) {
    return {
      valid: false,
      error: 'Edge cannot connect a block to itself',
    }
  }

  return { valid: true }
}

/**
 * Validates edge existence in workflow
 */
export function validateEdgeExists(edgeId: string, edges: CustomEdge[]): ValidationResult {
  if (!edgeId) {
    return {
      valid: false,
      error: 'Edge ID is required',
    }
  }

  const edgeExists = edges.some((edge) => edge.id === edgeId)

  if (!edgeExists) {
    return {
      valid: false,
      error: `Edge not found: ${edgeId}`,
    }
  }

  return { valid: true }
}

/**
 * Checks if adding an edge would create a cycle (backward connection).
 * Uses BFS from target to see if source is reachable — if so, the edge would create a loop.
 */
export function wouldCreateCycle(
  source: string,
  target: string,
  existingEdges: CustomEdge[]
): boolean {
  // BFS from target following existing edges to see if we can reach source
  const visited = new Set<string>()
  const queue = [target]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === source) return true
    if (visited.has(current)) continue
    visited.add(current)

    for (const edge of existingEdges) {
      if (edge.source === current && !visited.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  return false
}

/**
 * Utility-slot edges attach helper blocks to a host block visually. They are not
 * execution-flow dependencies, so cycle checks must ignore them.
 */
export function isUtilitySlotEdge(
  edge: Pick<CustomEdge, 'sourceHandle' | 'targetHandle'>
): boolean {
  return edge.sourceHandle === 'utility-source' || edge.targetHandle === 'utility-target'
}

export function getCycleCheckEdges(edges: CustomEdge[]): CustomEdge[] {
  return edges.filter((edge) => !isUtilitySlotEdge(edge))
}

/**
 * Checks for duplicate edges
 */
export function checkDuplicateEdge(newEdge: Edge, existingEdges: CustomEdge[]): ValidationResult {
  const isDuplicate = existingEdges.some(
    (edge) =>
      edge.source === newEdge.source &&
      edge.target === newEdge.target &&
      edge.sourceHandle === newEdge.sourceHandle &&
      edge.targetHandle === newEdge.targetHandle
  )

  if (isDuplicate) {
    return {
      valid: false,
      error: 'Duplicate edge detected',
    }
  }

  return { valid: true }
}

/**
 * Validates loop data
 */
export function validateLoop(loop: any): ValidationResult {
  if (!loop) {
    return {
      valid: false,
      error: 'Loop is null or undefined',
    }
  }

  if (!loop.id) {
    return {
      valid: false,
      error: 'Loop must have an ID',
    }
  }

  if (!Array.isArray(loop.nodes)) {
    return {
      valid: false,
      error: 'Loop must have a nodes array',
    }
  }

  if (loop.nodes.length === 0) {
    return {
      valid: false,
      error: 'Loop must contain at least one node',
    }
  }

  if (!loop.loopType || !['for', 'forEach'].includes(loop.loopType)) {
    return {
      valid: false,
      error: 'Loop must have a valid loopType (for or forEach)',
    }
  }

  if (loop.loopType === 'for' && typeof loop.iterations !== 'number') {
    return {
      valid: false,
      error: 'For loop must have a numeric iterations value',
    }
  }

  if (loop.loopType === 'forEach' && !loop.forEachItems) {
    return {
      valid: false,
      error: 'ForEach loop must have forEachItems',
    }
  }

  return { valid: true }
}

/**
 * Validates loop existence in workflow
 */
export function validateLoopExists(loopId: string, loops: Record<string, Loop>): ValidationResult {
  if (!loopId) {
    return {
      valid: false,
      error: 'Loop ID is required',
    }
  }

  if (!loops[loopId]) {
    return {
      valid: false,
      error: `Loop not found: ${loopId}`,
    }
  }

  return { valid: true }
}

/**
 * Validates batch update data
 */
export function validateBatchUpdates(updates: any[]): ValidationResult {
  if (!Array.isArray(updates)) {
    return {
      valid: false,
      error: 'Updates must be an array',
    }
  }

  if (updates.length === 0) {
    return {
      valid: false,
      error: 'Updates array cannot be empty',
    }
  }

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i]

    if (!update.id) {
      return {
        valid: false,
        error: `Update at index ${i} must have an ID`,
      }
    }

    if (!update.changes || typeof update.changes !== 'object') {
      return {
        valid: false,
        error: `Update at index ${i} must have a changes object`,
      }
    }
  }

  return { valid: true }
}

/**
 * Validates workflow state structure
 */
export function validateWorkflowState(state: any): ValidationResult {
  const warnings: string[] = []

  if (!state) {
    return {
      valid: false,
      error: 'Workflow state is null or undefined',
    }
  }

  if (!state.blocks || typeof state.blocks !== 'object') {
    return {
      valid: false,
      error: 'Workflow state must have a blocks object',
    }
  }

  if (!Array.isArray(state.edges)) {
    return {
      valid: false,
      error: 'Workflow state must have an edges array',
    }
  }

  if (!state.loops || typeof state.loops !== 'object') {
    warnings.push('Workflow state should have a loops object')
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
