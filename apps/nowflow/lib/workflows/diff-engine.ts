import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DiffEngine')

export interface WorkflowDiff {
  blocks: {
    added: BlockChange[]
    removed: BlockChange[]
    modified: BlockModification[]
  }
  edges: {
    added: EdgeChange[]
    removed: EdgeChange[]
  }
  loops: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  metadata: {
    fromBlockCount: number
    toBlockCount: number
    fromEdgeCount: number
    toEdgeCount: number
  }
}

export interface BlockChange {
  id: string
  type: string
  name?: string
}

export interface BlockModification {
  id: string
  type: string
  name?: string
  changes: PropertyChange[]
}

export interface PropertyChange {
  path: string
  from: any
  to: any
}

export interface EdgeChange {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/**
 * Computes the diff between two workflow states
 */
export function computeWorkflowDiff(fromState: any, toState: any): WorkflowDiff {
  const diff: WorkflowDiff = {
    blocks: { added: [], removed: [], modified: [] },
    edges: { added: [], removed: [] },
    loops: { added: [], removed: [], modified: [] },
    metadata: {
      fromBlockCount: 0,
      toBlockCount: 0,
      fromEdgeCount: 0,
      toEdgeCount: 0,
    },
  }

  try {
    // Parse states if they're strings
    const from = typeof fromState === 'string' ? JSON.parse(fromState) : fromState
    const to = typeof toState === 'string' ? JSON.parse(toState) : toState

    // Extract blocks
    const fromBlocks = extractBlocks(from)
    const toBlocks = extractBlocks(to)

    diff.metadata.fromBlockCount = fromBlocks.size
    diff.metadata.toBlockCount = toBlocks.size

    // Compare blocks
    diff.blocks = compareBlocks(fromBlocks, toBlocks)

    // Extract and compare edges
    const fromEdges = extractEdges(from)
    const toEdges = extractEdges(to)

    diff.metadata.fromEdgeCount = fromEdges.length
    diff.metadata.toEdgeCount = toEdges.length

    diff.edges = compareEdges(fromEdges, toEdges)

    // Compare loops
    const fromLoops = from.loops || {}
    const toLoops = to.loops || {}
    diff.loops = compareLoops(fromLoops, toLoops)
  } catch (error) {
    logger.error('Failed to compute diff', { error })
  }

  return diff
}

/**
 * Extracts blocks from workflow state
 */
function extractBlocks(state: any): Map<string, any> {
  const blocks = new Map<string, any>()

  if (state.blocks) {
    // Handle both array and object formats
    if (Array.isArray(state.blocks)) {
      state.blocks.forEach((block: any) => {
        blocks.set(block.id, block)
      })
    } else {
      Object.entries(state.blocks).forEach(([id, block]: [string, any]) => {
        blocks.set(id, { id, ...block })
      })
    }
  }

  return blocks
}

/**
 * Extracts edges from workflow state
 */
function extractEdges(state: any): any[] {
  if (state.edges) {
    return Array.isArray(state.edges) ? state.edges : Object.values(state.edges)
  }
  return []
}

/**
 * Compares two sets of blocks
 */
function compareBlocks(
  fromBlocks: Map<string, any>,
  toBlocks: Map<string, any>
): { added: BlockChange[]; removed: BlockChange[]; modified: BlockModification[] } {
  const added: BlockChange[] = []
  const removed: BlockChange[] = []
  const modified: BlockModification[] = []

  // Find added and modified blocks
  toBlocks.forEach((toBlock, id) => {
    const fromBlock = fromBlocks.get(id)
    if (!fromBlock) {
      added.push({
        id,
        type: toBlock.metadata?.id || toBlock.type || 'unknown',
        name: toBlock.name || toBlock.metadata?.name,
      })
    } else {
      const changes = compareBlockProperties(fromBlock, toBlock)
      if (changes.length > 0) {
        modified.push({
          id,
          type: toBlock.metadata?.id || toBlock.type || 'unknown',
          name: toBlock.name || toBlock.metadata?.name,
          changes,
        })
      }
    }
  })

  // Find removed blocks
  fromBlocks.forEach((fromBlock, id) => {
    if (!toBlocks.has(id)) {
      removed.push({
        id,
        type: fromBlock.metadata?.id || fromBlock.type || 'unknown',
        name: fromBlock.name || fromBlock.metadata?.name,
      })
    }
  })

  return { added, removed, modified }
}

/**
 * Compares properties of two blocks
 */
function compareBlockProperties(fromBlock: any, toBlock: any): PropertyChange[] {
  const changes: PropertyChange[] = []
  const significantPaths = ['name', 'subBlocks', 'position', 'data', 'config']

  for (const path of significantPaths) {
    const fromValue = fromBlock[path]
    const toValue = toBlock[path]

    if (!deepEqual(fromValue, toValue)) {
      changes.push({
        path,
        from: summarizeValue(fromValue),
        to: summarizeValue(toValue),
      })
    }
  }

  // Check sub-blocks specifically
  if (fromBlock.subBlocks && toBlock.subBlocks) {
    const subBlockChanges = compareSubBlocks(fromBlock.subBlocks, toBlock.subBlocks)
    changes.push(...subBlockChanges)
  }

  return changes
}

/**
 * Compares sub-blocks
 */
function compareSubBlocks(fromSubBlocks: any, toSubBlocks: any): PropertyChange[] {
  const changes: PropertyChange[] = []

  const fromKeys = Object.keys(fromSubBlocks)
  const toKeys = Object.keys(toSubBlocks)

  // Check for value changes in existing sub-blocks
  for (const key of fromKeys) {
    if (toKeys.includes(key)) {
      const fromValue = fromSubBlocks[key]?.value
      const toValue = toSubBlocks[key]?.value

      if (!deepEqual(fromValue, toValue)) {
        changes.push({
          path: `subBlocks.${key}`,
          from: summarizeValue(fromValue),
          to: summarizeValue(toValue),
        })
      }
    }
  }

  return changes
}

/**
 * Compares two sets of edges
 */
function compareEdges(
  fromEdges: any[],
  toEdges: any[]
): { added: EdgeChange[]; removed: EdgeChange[] } {
  const added: EdgeChange[] = []
  const removed: EdgeChange[] = []

  const fromEdgeIds = new Set(fromEdges.map((e) => e.id || `${e.source}-${e.target}`))
  const toEdgeIds = new Set(toEdges.map((e) => e.id || `${e.source}-${e.target}`))

  // Find added edges
  toEdges.forEach((edge) => {
    const edgeId = edge.id || `${edge.source}-${edge.target}`
    if (!fromEdgeIds.has(edgeId)) {
      added.push({
        id: edgeId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })
    }
  })

  // Find removed edges
  fromEdges.forEach((edge) => {
    const edgeId = edge.id || `${edge.source}-${edge.target}`
    if (!toEdgeIds.has(edgeId)) {
      removed.push({
        id: edgeId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })
    }
  })

  return { added, removed }
}

/**
 * Compares loops
 */
function compareLoops(
  fromLoops: Record<string, any>,
  toLoops: Record<string, any>
): { added: string[]; removed: string[]; modified: string[] } {
  const added: string[] = []
  const removed: string[] = []
  const modified: string[] = []

  const fromKeys = Object.keys(fromLoops)
  const toKeys = Object.keys(toLoops)

  // Find added loops
  toKeys.forEach((key) => {
    if (!fromKeys.includes(key)) {
      added.push(key)
    } else if (!deepEqual(fromLoops[key], toLoops[key])) {
      modified.push(key)
    }
  })

  // Find removed loops
  fromKeys.forEach((key) => {
    if (!toKeys.includes(key)) {
      removed.push(key)
    }
  })

  return { added, removed, modified }
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  return keysA.every((key) => deepEqual(a[key], b[key]))
}

/**
 * Summarizes a value for display
 */
function summarizeValue(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value
  }
  if (Array.isArray(value)) {
    return `[Array(${value.length})]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length > 5) {
      return `{Object with ${keys.length} keys}`
    }
    return value
  }
  return value
}

/**
 * Generates a human-readable summary of the diff
 */
export function generateDiffSummary(diff: WorkflowDiff): string {
  const parts: string[] = []

  if (diff.blocks.added.length > 0) {
    parts.push(`Added ${diff.blocks.added.length} block(s)`)
  }
  if (diff.blocks.removed.length > 0) {
    parts.push(`Removed ${diff.blocks.removed.length} block(s)`)
  }
  if (diff.blocks.modified.length > 0) {
    parts.push(`Modified ${diff.blocks.modified.length} block(s)`)
  }
  if (diff.edges.added.length > 0) {
    parts.push(`Added ${diff.edges.added.length} connection(s)`)
  }
  if (diff.edges.removed.length > 0) {
    parts.push(`Removed ${diff.edges.removed.length} connection(s)`)
  }
  if (diff.loops.added.length > 0) {
    parts.push(`Added ${diff.loops.added.length} loop(s)`)
  }
  if (diff.loops.removed.length > 0) {
    parts.push(`Removed ${diff.loops.removed.length} loop(s)`)
  }

  if (parts.length === 0) {
    return 'No changes detected'
  }

  return parts.join(', ')
}

/**
 * Generates detailed change descriptions for UI display
 */
export function generateDetailedChanges(diff: WorkflowDiff): string[] {
  const changes: string[] = []

  // Block additions
  diff.blocks.added.forEach((block) => {
    changes.push(`➕ Added ${block.type} block${block.name ? ` "${block.name}"` : ''}`)
  })

  // Block removals
  diff.blocks.removed.forEach((block) => {
    changes.push(`➖ Removed ${block.type} block${block.name ? ` "${block.name}"` : ''}`)
  })

  // Block modifications
  diff.blocks.modified.forEach((block) => {
    const changeCount = block.changes.length
    changes.push(
      `✏️ Modified ${block.type} block${block.name ? ` "${block.name}"` : ''} (${changeCount} change${changeCount > 1 ? 's' : ''})`
    )
  })

  // Connection changes
  if (diff.edges.added.length > 0) {
    changes.push(`🔗 Added ${diff.edges.added.length} connection(s)`)
  }
  if (diff.edges.removed.length > 0) {
    changes.push(`🔗 Removed ${diff.edges.removed.length} connection(s)`)
  }

  // Loop changes
  if (diff.loops.added.length > 0) {
    changes.push(`🔄 Added ${diff.loops.added.length} loop(s)`)
  }
  if (diff.loops.removed.length > 0) {
    changes.push(`🔄 Removed ${diff.loops.removed.length} loop(s)`)
  }

  return changes
}
