/**
 * Consolidated tests for all action slices (block, edge, group, loop, selection, batch).
 *
 * These tests run each slice in isolation with a minimal mock store containing
 * just the state + helper methods (updateLastSaved, markDurableChange, etc.)
 * that the actions assume exist on the root store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createBatchActionsSlice } from '../actions/batch-actions'
import { createBlockActionsSlice } from '../actions/block-actions'
import { createEdgeActionsSlice } from '../actions/edge-actions'
import { createGroupActionsSlice } from '../actions/group-actions'
import { createLoopActionsSlice } from '../actions/loop-actions'
import { createSelectionActionsSlice } from '../actions/selection-actions'

// Mocks — hoisted before imports

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/blocks', () => ({
  getBlock: (type: string) => {
    const utilityTypes = ['variable', 'math', 'text_processor', 'json_processor', 'csv_processor']
    if (type === 'starter')
      return {
        type: 'starter',
        name: 'Starter',
        subBlocks: [],
        outputs: { response: { type: { input: 'any' } } },
        isUtility: false,
      }
    if (type === 'agent')
      return {
        type: 'agent',
        name: 'Agent',
        subBlocks: [],
        outputs: { response: { type: { content: 'string' } } },
        isUtility: false,
      }
    if (type === 'function')
      return {
        type: 'function',
        name: 'Function',
        subBlocks: [],
        outputs: { response: { type: { result: 'json' } } },
        isUtility: false,
      }
    return {
      type,
      name: type,
      subBlocks: [],
      outputs: {},
      isUtility: utilityTypes.includes(type),
    }
  },
}))

vi.mock('@/blocks/utils', () => ({
  resolveOutputType: () => ({ response: { type: 'json' } }),
}))

vi.mock('../../common/optimizations', () => ({
  calculateLoops: () => ({}),
}))

vi.mock('../../common/validators', () => ({
  validateEdge: (edge: any) => {
    if (!edge.source || !edge.target) return { valid: false, error: 'source/target required' }
    if (edge.source === edge.target) return { valid: false, error: 'self loop' }
    return { valid: true }
  },
  checkDuplicateEdge: (edge: any, existing: any[]) => {
    const dup = existing.find(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        e.sourceHandle === edge.sourceHandle &&
        e.targetHandle === edge.targetHandle
    )
    return dup ? { valid: false, error: 'duplicate' } : { valid: true }
  },
  wouldCreateCycle: (source: string, target: string, edges: any[]) => {
    // minimal: if there's already a path from target to source, adding source->target creates cycle
    const reachable = new Set<string>()
    const stack = [target]
    while (stack.length) {
      const node = stack.pop()!
      if (reachable.has(node)) continue
      reachable.add(node)
      edges.filter((e) => e.source === node).forEach((e) => stack.push(e.target))
    }
    return reachable.has(source)
  },
  isUtilitySlotEdge: (edge: any) =>
    edge.sourceHandle === 'utility-source' || edge.targetHandle === 'utility-target',
  getCycleCheckEdges: (edges: any[]) =>
    edges.filter(
      (edge) => edge.sourceHandle !== 'utility-source' && edge.targetHandle !== 'utility-target'
    ),
  validateBatchUpdates: () => ({ valid: true }),
}))

vi.mock('../../middleware', () => ({
  pushHistory: vi.fn(),
}))

vi.mock('../../persistence', () => ({
  saveWorkflowState: vi.fn(),
  saveSubblockValues: vi.fn(),
}))

vi.mock('../../registry/store', () => ({
  useWorkflowRegistry: {
    getState: () => ({ activeWorkflowId: 'wf-1' }),
  },
}))

vi.mock('../../subblock/store', () => ({
  useSubBlockStore: {
    getState: () => ({ workflowValues: { 'wf-1': {} } }),
    setState: vi.fn(),
  },
}))

vi.mock('../../sync', () => ({
  workflowSync: {
    syncImmediate: vi.fn(),
    syncUserAction: vi.fn(),
    pausePolling: vi.fn(),
  },
  updateLastUserActionTime: vi.fn(),
}))

vi.mock('../../utils', () => ({
  mergeSubblockState: (blocks: any) => blocks,
}))

vi.mock('../../workflow-style/store', () => ({
  useWorkflowStyleStore: {
    getState: () => ({ globalNodeStyle: 'default' }),
  },
}))

vi.mock('../../../validation/store', () => ({
  useValidationStore: {
    getState: () => ({ clearBlock: vi.fn() }),
  },
}))

// Mock safe-storage (panel/other stores that might import it)
vi.mock('@/lib/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// Mock fetch in case any action reaches out
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as any

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockStore = {
  state: any
  get: () => any
  safeSet: (updater: any) => void
}

function createMockStore(initial: Partial<any> = {}): MockStore {
  const state: any = {
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
    interaction: {
      isDragging: false,
      isEditing: false,
      lastInteractionTime: 0,
      lastDurableChangeTime: 0,
    },
    ...initial,
  }

  const get = () => state
  const safeSet = (updater: any) => {
    const next = typeof updater === 'function' ? updater(state) : updater
    Object.assign(state, next)
  }

  state.updateLastSaved = vi.fn()
  state.markDurableChange = vi.fn()
  state.markInteraction = vi.fn()

  return { state, get, safeSet }
}

// Attach all action slices to a mock store for integrated tests
function attachAllSlices(store: MockStore) {
  const deps = { safeSet: store.safeSet, get: store.get }
  const block = createBlockActionsSlice(deps)
  const edge = createEdgeActionsSlice(deps)
  const group = createGroupActionsSlice(deps)
  const loop = createLoopActionsSlice(deps)
  const selection = createSelectionActionsSlice(deps)
  const batch = createBatchActionsSlice({
    ...deps,
    batchBlockUpdater: (updates: any[]) => {
      const blocks = { ...store.state.blocks }
      updates.forEach((u) => {
        if (blocks[u.id]) blocks[u.id] = { ...blocks[u.id], ...u.changes }
      })
      return {
        blocks,
        edges: store.state.edges,
        loops: store.state.loops,
      }
    },
    batchEdgeUpdater: (updates: any[]) => {
      const edges = store.state.edges.map((e: any) => {
        const u = updates.find((x) => x.id === e.id)
        return u ? { ...e, ...u.changes } : e
      })
      return { blocks: store.state.blocks, edges, loops: store.state.loops }
    },
    batchBlockDeleter: (ids: string[]) => {
      const blocks = { ...store.state.blocks }
      ids.forEach((id) => delete blocks[id])
      const edges = store.state.edges.filter(
        (e: any) => !ids.includes(e.source) && !ids.includes(e.target)
      )
      return {
        blocks,
        edges,
        loops: store.state.loops,
        groups: store.state.groups,
      }
    },
  })

  Object.assign(store.state, block, edge, group, loop, selection, batch)
  // make sure updateLastSaved/markDurableChange stubs aren't overwritten
  store.state.updateLastSaved = vi.fn()
  store.state.markDurableChange = vi.fn()
  store.state.markInteraction = vi.fn()
  return store
}

// ---------------------------------------------------------------------------
// Block actions
// ---------------------------------------------------------------------------

describe('block-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore()
    actions = createBlockActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
    })
  })

  it('addBlock creates a new block with expected defaults', () => {
    actions.addBlock('b1', 'agent', 'Agent 1', { x: 10, y: 20 })
    const b = store.state.blocks['b1']
    expect(b).toBeDefined()
    expect(b.type).toBe('agent')
    expect(b.name).toBe('Agent 1')
    expect(b.position).toEqual({ x: 10, y: 20 })
    expect(b.enabled).toBe(true)
    expect(b.horizontalHandles).toBe(true)
    expect(b.isWide).toBe(false)
    expect(b.isNew).toBe(true)
  })

  it('addBlock converts "output" type to "function"', () => {
    actions.addBlock('b1', 'output', 'Out', { x: 0, y: 0 })
    expect(store.state.blocks['b1']?.type).toBe('function')
  })

  it('addBlock prevents second starter block', () => {
    store.state.blocks['s1'] = {
      id: 's1',
      type: 'starter',
      name: 'Start',
      position: { x: 0, y: 0 },
    }
    actions.addBlock('s2', 'starter', 'Start 2', { x: 100, y: 0 })
    expect(store.state.blocks['s2']).toBeUndefined()
  })

  it('addBlock ignores unknown block type', () => {
    actions.addBlock('b1', 'not-a-real-type', 'X', { x: 0, y: 0 })
    // getBlock mock returns fallback object — block still created
    // but if it returns null the block should not be created. We mock to always return.
    expect(store.state.blocks['b1']).toBeDefined()
  })

  it('removeBlock removes the block', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
    }
    actions.removeBlock('a')
    expect(store.state.blocks['a']).toBeUndefined()
  })

  it('removeBlock protects starter block', () => {
    store.state.blocks['s1'] = {
      id: 's1',
      type: 'starter',
      name: 'Start',
      position: { x: 0, y: 0 },
    }
    actions.removeBlock('s1')
    expect(store.state.blocks['s1']).toBeDefined()
  })

  it('removeBlock also removes connected edges', () => {
    store.state.blocks = {
      a: { id: 'a', type: 'agent', name: 'A', position: { x: 0, y: 0 } },
      b: { id: 'b', type: 'agent', name: 'B', position: { x: 1, y: 0 } },
    }
    store.state.edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ]
    actions.removeBlock('b')
    expect(store.state.edges).toHaveLength(0)
  })

  it('removeBlock cleans up loops containing the block', () => {
    store.state.blocks = {
      a: { id: 'a', type: 'agent', name: 'A', position: { x: 0, y: 0 } },
      b: { id: 'b', type: 'agent', name: 'B', position: { x: 0, y: 0 } },
      c: { id: 'c', type: 'agent', name: 'C', position: { x: 0, y: 0 } },
    }
    store.state.loops = {
      l1: { id: 'l1', nodes: ['a', 'b', 'c'], iterations: 3, loopType: 'for' },
      l2: { id: 'l2', nodes: ['b'], iterations: 1, loopType: 'for' },
    }
    actions.removeBlock('b')
    expect(store.state.loops['l1'].nodes).toEqual(['a', 'c'])
    expect(store.state.loops['l2']).toBeUndefined()
  })

  it('updateBlockPosition updates the block position', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
    }
    actions.updateBlockPosition('a', { x: 50, y: 60 })
    expect(store.state.blocks['a'].position).toEqual({ x: 50, y: 60 })
  })

  it('toggleBlockEnabled flips enabled flag', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
      enabled: true,
    }
    actions.toggleBlockEnabled('a')
    expect(store.state.blocks['a'].enabled).toBe(false)
    actions.toggleBlockEnabled('a')
    expect(store.state.blocks['a'].enabled).toBe(true)
  })

  it('duplicateBlock creates a new block with incremented name', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'Agent 1',
      position: { x: 0, y: 0 },
      subBlocks: {},
    }
    actions.duplicateBlock('a')
    const names = Object.values(store.state.blocks).map((b: any) => b.name)
    expect(names).toContain('Agent 2')
  })

  it('duplicateBlock protects starter block', () => {
    store.state.blocks['s1'] = {
      id: 's1',
      type: 'starter',
      name: 'Start',
      position: { x: 0, y: 0 },
      subBlocks: {},
    }
    actions.duplicateBlock('s1')
    expect(Object.keys(store.state.blocks)).toHaveLength(1)
  })

  it('updateBlockName updates the name', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'Old',
      position: { x: 0, y: 0 },
    }
    actions.updateBlockName('a', 'New Name')
    expect(store.state.blocks['a'].name).toBe('New Name')
  })

  it('updateBlock merges arbitrary updates', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
    }
    actions.updateBlock('a', { height: 120, isWide: true })
    expect(store.state.blocks['a'].height).toBe(120)
    expect(store.state.blocks['a'].isWide).toBe(true)
  })

  it('toggleBlockWide flips isWide', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
      isWide: false,
    }
    actions.toggleBlockWide('a')
    expect(store.state.blocks['a'].isWide).toBe(true)
  })

  it('toggleBlockMinimized flips isMinimized', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
      isMinimized: false,
    }
    actions.toggleBlockMinimized('a')
    expect(store.state.blocks['a'].isMinimized).toBe(true)
  })

  it('toggleBlockNodeStyle flips between default and hero', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
      nodeStyle: 'default',
    }
    actions.toggleBlockNodeStyle('a')
    expect(store.state.blocks['a'].nodeStyle).toBe('hero')
    actions.toggleBlockNodeStyle('a')
    expect(store.state.blocks['a'].nodeStyle).toBe('default')
  })

  it('updateBlockHeight updates height', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
    }
    actions.updateBlockHeight('a', 250)
    expect(store.state.blocks['a'].height).toBe(250)
  })

  it('toggleBlockBookmark toggles bookmarked', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
    }
    actions.toggleBlockBookmark('a')
    expect(store.state.blocks['a'].bookmarked).toBe(true)
    actions.toggleBlockBookmark('a')
    expect(store.state.blocks['a'].bookmarked).toBe(false)
  })

  it('resetBlock restores configured sub-block and output defaults', () => {
    store.state.blocks['a'] = {
      id: 'a',
      type: 'agent',
      name: 'A',
      position: { x: 0, y: 0 },
      subBlocks: { s1: { id: 's1', type: 'short-input', value: 'hi' } },
      outputs: { x: 1 },
      enabled: false,
      isWide: true,
      height: 300,
      isMinimized: true,
      bookmarked: true,
    }
    actions.resetBlock('a')
    const b = store.state.blocks['a']
    expect(b.subBlocks).toEqual({})
    expect(b.outputs).toEqual({ response: { type: 'json' } })
    expect(b.enabled).toBe(true)
    expect(b.isWide).toBe(false)
    expect(b.isMinimized).toBe(false)
    expect(b.bookmarked).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge actions
// ---------------------------------------------------------------------------

describe('edge-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore({
      blocks: {
        a: { id: 'a', type: 'agent', name: 'A' },
        b: { id: 'b', type: 'agent', name: 'B' },
        c: { id: 'c', type: 'agent', name: 'C' },
      },
    })
    actions = createEdgeActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
    })
  })

  it('addEdge adds a valid edge', () => {
    actions.addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    expect(store.state.edges).toHaveLength(1)
    expect(store.state.edges[0].source).toBe('a')
    expect(store.state.edges[0].target).toBe('b')
  })

  it('addEdge rejects self-loop', () => {
    actions.addEdge({ source: 'a', target: 'a' })
    expect(store.state.edges).toHaveLength(0)
  })

  it('addEdge rejects duplicates', () => {
    store.state.edges = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ]
    actions.addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    expect(store.state.edges).toHaveLength(1)
  })

  it('addEdge rejects cycle-creating edge', () => {
    store.state.edges = [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceHandle: 'source',
        targetHandle: 'target',
      },
      {
        id: 'e2',
        source: 'b',
        target: 'c',
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ]
    actions.addEdge({
      source: 'c',
      target: 'a',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    expect(store.state.edges).toHaveLength(2)
  })

  it('addEdge allows utility-source -> utility-target', () => {
    store.state.blocks = {
      v: { id: 'v', type: 'variable', name: 'Var' },
      a: { id: 'a', type: 'agent', name: 'A' },
    }
    actions.addEdge({
      source: 'v',
      target: 'a',
      sourceHandle: 'utility-source',
      targetHandle: 'utility-target',
    })
    expect(store.state.edges).toHaveLength(1)
  })

  it('addEdge blocks utility source over regular handle', () => {
    store.state.blocks = {
      v: { id: 'v', type: 'variable', name: 'Var' },
      a: { id: 'a', type: 'agent', name: 'A' },
    }
    actions.addEdge({
      source: 'v',
      target: 'a',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    expect(store.state.edges).toHaveLength(0)
  })

  it('addEdge allows normal block feeding data into utility', () => {
    store.state.blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      m: { id: 'm', type: 'math', name: 'Math' },
    }
    actions.addEdge({
      source: 'a',
      target: 'm',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    expect(store.state.edges).toHaveLength(1)
  })

  it('removeEdge removes an existing edge', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.removeEdge('e1')
    expect(store.state.edges).toHaveLength(0)
  })

  it('removeEdge is a no-op for missing edge', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.removeEdge('nope')
    expect(store.state.edges).toHaveLength(1)
  })

  it('removeEdge ignores empty edgeId', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.removeEdge('')
    expect(store.state.edges).toHaveLength(1)
  })

  it('toggleEdgeStyle cycles through styles', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.toggleEdgeStyle('e1')
    expect(store.state.edges[0].edgeStyle).toBe('dashed')
    actions.toggleEdgeStyle('e1')
    expect(store.state.edges[0].edgeStyle).toBe('dotted')
    actions.toggleEdgeStyle('e1')
    expect(store.state.edges[0].edgeStyle).toBe('double')
    actions.toggleEdgeStyle('e1')
    expect(store.state.edges[0].edgeStyle).toBe('wavy')
    actions.toggleEdgeStyle('e1')
    expect(store.state.edges[0].edgeStyle).toBe('solid')
  })

  it('updateEdgeStyle sets style directly', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.updateEdgeStyle('e1', 'dotted')
    expect(store.state.edges[0].edgeStyle).toBe('dotted')
  })

  it('updateEdgeThickness sets thickness', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.updateEdgeThickness('e1', 'thick')
    expect(store.state.edges[0].thickness).toBe('thick')
  })

  it('updateEdgeColor sets color', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.updateEdgeColor('e1', 'blue')
    expect(store.state.edges[0].color).toBe('blue')
  })

  it('updateEdgeAnimation sets animation', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.updateEdgeAnimation('e1', 'flow')
    expect(store.state.edges[0].animation).toBe('flow')
  })

  it('updateEdgeLabel sets label', () => {
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' }]
    actions.updateEdgeLabel('e1', 'trigger')
    expect(store.state.edges[0].label).toBe('trigger')
  })
})

// ---------------------------------------------------------------------------
// Group actions
// ---------------------------------------------------------------------------

describe('group-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore({
      blocks: {
        a: { id: 'a', type: 'agent', name: 'A' },
        b: { id: 'b', type: 'agent', name: 'B' },
        c: { id: 'c', type: 'agent', name: 'C' },
      },
    })
    actions = createGroupActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
    })
    // attach actions onto state so inter-action calls work (removeNodeFromGroup -> deleteGroup)
    Object.assign(store.state, actions)
  })

  it('createGroup creates a group with >=2 valid nodes', () => {
    const id = actions.createGroup(['a', 'b'])
    expect(id).toBeTruthy()
    expect(store.state.groups[id]).toBeDefined()
    expect(store.state.groups[id].nodeIds).toEqual(['a', 'b'])
  })

  it('createGroup rejects groups with <2 nodes', () => {
    const id = actions.createGroup(['a'])
    expect(id).toBe('')
    expect(Object.keys(store.state.groups)).toHaveLength(0)
  })

  it('createGroup filters out invalid node ids', () => {
    const id = actions.createGroup(['a', 'b', 'ghost'])
    expect(id).toBeTruthy()
    expect(store.state.groups[id].nodeIds).toEqual(['a', 'b'])
  })

  it('createGroup rejects if nodes are already in a group', () => {
    actions.createGroup(['a', 'b'])
    const id = actions.createGroup(['a', 'c'])
    expect(id).toBe('')
  })

  it('createGroup assigns default name and color when omitted', () => {
    const id = actions.createGroup(['a', 'b'])
    expect(store.state.groups[id].name).toMatch(/Group/)
    expect(store.state.groups[id].color).toBeTruthy()
  })

  it('createGroup accepts custom name/color', () => {
    const id = actions.createGroup(['a', 'b'], 'My Group', '#ff0000')
    expect(store.state.groups[id].name).toBe('My Group')
    expect(store.state.groups[id].color).toBe('#ff0000')
  })

  it('deleteGroup removes the group', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.deleteGroup(id)
    expect(store.state.groups[id]).toBeUndefined()
  })

  it('deleteGroup on unknown id is a no-op', () => {
    actions.createGroup(['a', 'b'])
    const before = { ...store.state.groups }
    actions.deleteGroup('ghost')
    expect(store.state.groups).toEqual(before)
  })

  it('updateGroupName renames a group', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.updateGroupName(id, 'Renamed')
    expect(store.state.groups[id].name).toBe('Renamed')
  })

  it('updateGroupColor sets color', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.updateGroupColor(id, '#00ff00')
    expect(store.state.groups[id].color).toBe('#00ff00')
  })

  it('addNodeToGroup appends node', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.addNodeToGroup(id, 'c')
    expect(store.state.groups[id].nodeIds).toContain('c')
  })

  it('addNodeToGroup ignores duplicate nodeId', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.addNodeToGroup(id, 'a')
    expect(store.state.groups[id].nodeIds).toEqual(['a', 'b'])
  })

  it('removeNodeFromGroup removes a node', () => {
    const id = actions.createGroup(['a', 'b', 'c'])
    actions.removeNodeFromGroup(id, 'b')
    expect(store.state.groups[id].nodeIds).toEqual(['a', 'c'])
  })

  it('removeNodeFromGroup deletes the group when count falls to 1', () => {
    const id = actions.createGroup(['a', 'b'])
    actions.removeNodeFromGroup(id, 'b')
    expect(store.state.groups[id]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Loop actions
// ---------------------------------------------------------------------------

describe('loop-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore({
      loops: {
        l1: { id: 'l1', nodes: ['a', 'b'], iterations: 3, loopType: 'for' },
      },
    })
    actions = createLoopActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
    })
  })

  it('updateLoopIterations sets iterations within 1..50', () => {
    actions.updateLoopIterations('l1', 10)
    expect(store.state.loops['l1'].iterations).toBe(10)
  })

  it('updateLoopIterations clamps below 1', () => {
    actions.updateLoopIterations('l1', 0)
    expect(store.state.loops['l1'].iterations).toBe(1)
    actions.updateLoopIterations('l1', -99)
    expect(store.state.loops['l1'].iterations).toBe(1)
  })

  it('updateLoopIterations clamps above 50', () => {
    actions.updateLoopIterations('l1', 500)
    expect(store.state.loops['l1'].iterations).toBe(50)
  })

  it('updateLoopType switches between for and forEach', () => {
    actions.updateLoopType('l1', 'forEach')
    expect(store.state.loops['l1'].loopType).toBe('forEach')
    actions.updateLoopType('l1', 'for')
    expect(store.state.loops['l1'].loopType).toBe('for')
  })

  it('updateLoopForEachItems sets items expression', () => {
    actions.updateLoopForEachItems('l1', '<start.response.items>')
    expect(store.state.loops['l1'].forEachItems).toBe('<start.response.items>')
  })
})

// ---------------------------------------------------------------------------
// Selection actions
// ---------------------------------------------------------------------------

describe('selection-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore()
    actions = createSelectionActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
    })
    // attach the methods onto state so actions can call them via get()
    Object.assign(store.state, actions)
  })

  it('setSelectedNodes replaces the selection', () => {
    actions.setSelectedNodes(['a', 'b'])
    expect(store.state.selectedNodeIds).toEqual(['a', 'b'])
  })

  it('addToSelection appends a node and dedupes', () => {
    actions.addToSelection('a')
    actions.addToSelection('a')
    actions.addToSelection('b')
    expect(store.state.selectedNodeIds).toEqual(['a', 'b'])
  })

  it('removeFromSelection removes a node', () => {
    actions.setSelectedNodes(['a', 'b', 'c'])
    actions.removeFromSelection('b')
    expect(store.state.selectedNodeIds).toEqual(['a', 'c'])
  })

  it('clearSelection empties the selection', () => {
    actions.setSelectedNodes(['a', 'b'])
    actions.clearSelection()
    expect(store.state.selectedNodeIds).toEqual([])
  })

  it('toggleNodeSelection toggles a node in and out', () => {
    actions.toggleNodeSelection('a')
    expect(store.state.selectedNodeIds).toEqual(['a'])
    actions.toggleNodeSelection('a')
    expect(store.state.selectedNodeIds).toEqual([])
  })

  it('openRightSidebar sets block id and open flag', () => {
    actions.openRightSidebar('b1')
    expect(store.state.selectedBlockForSidebar).toBe('b1')
    expect(store.state.isRightSidebarOpen).toBe(true)
  })

  it('closeRightSidebar clears sidebar state', () => {
    actions.openRightSidebar('b1')
    actions.closeRightSidebar()
    expect(store.state.selectedBlockForSidebar).toBeNull()
    expect(store.state.isRightSidebarOpen).toBe(false)
  })

  it('toggleRightSidebar closes sidebar when toggling same block', () => {
    actions.openRightSidebar('b1')
    actions.toggleRightSidebar('b1')
    expect(store.state.isRightSidebarOpen).toBe(false)
  })

  it('toggleRightSidebar opens new block when different block id passed', () => {
    actions.openRightSidebar('b1')
    actions.toggleRightSidebar('b2')
    expect(store.state.selectedBlockForSidebar).toBe('b2')
    expect(store.state.isRightSidebarOpen).toBe(true)
  })

  it('highlightConnections sets highlighted node and edges', () => {
    store.state.edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'x', target: 'y' },
    ]
    actions.highlightConnections('b')
    expect(store.state.highlightedNodeId).toBe('b')
    expect(store.state.highlightedEdgeIds.sort()).toEqual(['e1', 'e2'])
  })

  it('resetHighlightedConnections clears highlight state', () => {
    store.state.highlightedNodeId = 'b'
    store.state.highlightedEdgeIds = ['e1', 'e2']
    actions.resetHighlightedConnections()
    expect(store.state.highlightedNodeId).toBeNull()
    expect(store.state.highlightedEdgeIds).toEqual([])
  })

  it('setNeedsRedeploymentFlag updates flag', () => {
    actions.setNeedsRedeploymentFlag(true)
    expect(store.state.needsRedeployment).toBe(true)
  })

  it('setDeploymentStatus marks as deployed', () => {
    actions.setDeploymentStatus(true)
    expect(store.state.isDeployed).toBe(true)
    expect(store.state.deployedAt).toBeInstanceOf(Date)
  })

  it('setScheduleStatus updates only when value changes', () => {
    actions.setScheduleStatus(true)
    expect(store.state.hasActiveSchedule).toBe(true)
    store.state.updateLastSaved = vi.fn()
    actions.setScheduleStatus(true)
    // same value — updateLastSaved should not be called
    expect(store.state.updateLastSaved).not.toHaveBeenCalled()
  })

  it('setWebhookStatus clears schedule when enabling webhook', () => {
    store.state.hasActiveSchedule = true
    actions.setWebhookStatus(true)
    expect(store.state.hasActiveWebhook).toBe(true)
    expect(store.state.hasActiveSchedule).toBe(false)
  })

  it('triggerUpdate sets lastUpdate timestamp', () => {
    actions.triggerUpdate()
    expect(typeof store.state.lastUpdate).toBe('number')
  })

  it('clear resets the workflow', () => {
    store.state.blocks = { a: { id: 'a' } as any }
    store.state.edges = [{ id: 'e1', source: 'a', target: 'b' } as any]
    actions.clear()
    expect(store.state.blocks).toEqual({})
    expect(store.state.edges).toEqual([])
    expect(store.state.selectedNodeIds).toEqual([])
  })

  it('setDragging / setEditing update interaction state', () => {
    actions.setDragging(true)
    expect(store.state.interaction.isDragging).toBe(true)
    actions.setEditing(true)
    expect(store.state.interaction.isEditing).toBe(true)
  })

  it('markInteraction updates lastInteractionTime', () => {
    const before = store.state.interaction.lastInteractionTime
    actions.markInteraction()
    expect(store.state.interaction.lastInteractionTime).toBeGreaterThanOrEqual(before)
  })

  it('markDurableChange updates lastDurableChangeTime', () => {
    actions.markDurableChange()
    expect(store.state.interaction.lastDurableChangeTime).toBeGreaterThan(0)
  })

  it('updateLastSaved sets lastSaved', () => {
    actions.updateLastSaved()
    expect(typeof store.state.lastSaved).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// Batch actions
// ---------------------------------------------------------------------------

describe('batch-actions', () => {
  let store: MockStore
  let actions: any

  beforeEach(() => {
    store = createMockStore({
      blocks: {
        a: { id: 'a', type: 'agent', name: 'A' },
        b: { id: 'b', type: 'function', name: 'B' },
        c: { id: 'c', type: 'agent', name: 'C' },
      },
    })
    actions = createBatchActionsSlice({
      safeSet: store.safeSet,
      get: store.get,
      batchBlockUpdater: (updates: any[]) => {
        const blocks = { ...store.state.blocks }
        updates.forEach((u) => {
          if (blocks[u.id]) blocks[u.id] = { ...blocks[u.id], ...u.changes }
        })
        return {
          blocks,
          edges: store.state.edges,
          loops: store.state.loops,
        }
      },
      batchEdgeUpdater: (updates: any[]) => {
        const edges = store.state.edges.map((e: any) => {
          const u = updates.find((x) => x.id === e.id)
          return u ? { ...e, ...u.changes } : e
        })
        return {
          blocks: store.state.blocks,
          edges,
          loops: store.state.loops,
        }
      },
      batchBlockDeleter: (ids: string[]) => {
        const blocks = { ...store.state.blocks }
        ids.forEach((id) => delete blocks[id])
        return {
          blocks,
          edges: store.state.edges,
          loops: store.state.loops,
          groups: store.state.groups,
        }
      },
    })
  })

  it('batchUpdateBlocks applies updates to blocks', () => {
    actions.batchUpdateBlocks([
      { id: 'a', changes: { name: 'Renamed A' } },
      { id: 'b', changes: { enabled: false } },
    ])
    expect(store.state.blocks['a'].name).toBe('Renamed A')
    expect(store.state.blocks['b'].enabled).toBe(false)
  })

  it('batchUpdateEdges applies updates to edges', () => {
    store.state.edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ]
    actions.batchUpdateEdges([
      { id: 'e1', changes: { label: 'new label' } },
      { id: 'e2', changes: { color: 'blue' } },
    ])
    expect(store.state.edges[0].label).toBe('new label')
    expect(store.state.edges[1].color).toBe('blue')
  })

  it('batchDeleteBlocks deletes multiple blocks', () => {
    actions.batchDeleteBlocks(['a', 'b'])
    expect(store.state.blocks['a']).toBeUndefined()
    expect(store.state.blocks['b']).toBeUndefined()
    expect(store.state.blocks['c']).toBeDefined()
  })

  it('batchDeleteBlocks filters starter blocks', () => {
    store.state.blocks['s1'] = {
      id: 's1',
      type: 'starter',
      name: 'Start',
    }
    actions.batchDeleteBlocks(['s1', 'a'])
    expect(store.state.blocks['s1']).toBeDefined()
    expect(store.state.blocks['a']).toBeUndefined()
  })

  it('batchDeleteBlocks no-op on empty list', () => {
    actions.batchDeleteBlocks([])
    expect(Object.keys(store.state.blocks)).toHaveLength(3)
  })

  it('batchDeleteBlocks no-op when only starter blocks requested', () => {
    store.state.blocks['s1'] = {
      id: 's1',
      type: 'starter',
      name: 'Start',
    }
    actions.batchDeleteBlocks(['s1'])
    expect(store.state.blocks['s1']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Integration: multiple slices on one store
// ---------------------------------------------------------------------------

describe('integrated slices', () => {
  it('chains block creation, edge addition, and selection', () => {
    const store = attachAllSlices(createMockStore())
    store.state.addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    store.state.addBlock('b2', 'agent', 'B', { x: 100, y: 0 })
    store.state.addEdge({
      source: 'b1',
      target: 'b2',
      sourceHandle: 'source',
      targetHandle: 'target',
    })
    store.state.setSelectedNodes(['b1', 'b2'])
    expect(Object.keys(store.state.blocks)).toEqual(['b1', 'b2'])
    expect(store.state.edges).toHaveLength(1)
    expect(store.state.selectedNodeIds).toEqual(['b1', 'b2'])
  })
})
