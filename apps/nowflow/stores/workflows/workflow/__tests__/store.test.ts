/**
 * Tests for the root workflow Zustand store.
 *
 * Mocks sync, persistence, registry, subblock, validation stores so the real
 * store composition (with withHistory + devtools middleware) can be exercised.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
// ---------------------------------------------------------------------------
// Import store after mocks
// ---------------------------------------------------------------------------

import { useWorkflowStore } from '../store'

// Mocks — hoisted

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
    if (type === 'starter') {
      return {
        type: 'starter',
        name: 'Starter',
        subBlocks: [],
        outputs: {},
        isUtility: false,
      }
    }
    if (type === 'agent') {
      return {
        type: 'agent',
        name: 'Agent',
        subBlocks: [],
        outputs: {},
        isUtility: false,
      }
    }
    if (type === 'function') {
      return {
        type: 'function',
        name: 'Function',
        subBlocks: [],
        outputs: {},
        isUtility: false,
      }
    }
    return {
      type,
      name: type,
      subBlocks: [],
      outputs: {},
      isUtility: false,
    }
  },
}))

vi.mock('@/blocks/utils', () => ({
  resolveOutputType: () => ({ response: { type: 'json' } }),
}))

vi.mock('../../persistence', () => ({
  saveWorkflowState: vi.fn(),
  saveSubblockValues: vi.fn(),
  loadWorkflowState: vi.fn(),
  loadSubblockValues: vi.fn(),
}))

vi.mock('../../registry/store', () => ({
  useWorkflowRegistry: {
    getState: () => ({ activeWorkflowId: 'wf-1' }),
    setState: vi.fn(),
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

vi.mock('@/lib/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as any

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

const resetStore = () => {
  useWorkflowStore.setState({
    blocks: {},
    edges: [],
    loops: {},
    groups: {},
    selectedNodeIds: [],
    highlightedNodeId: null,
    highlightedEdgeIds: [],
    selectedBlockForSidebar: null,
    isRightSidebarOpen: false,
    lastSaved: undefined,
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
          interaction: {
            isDragging: false,
            isEditing: false,
            lastInteractionTime: 0,
            lastDurableChangeTime: 0,
          },
        } as any,
        timestamp: Date.now(),
        action: 'Initial state',
        subblockValues: {},
      },
      future: [],
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWorkflowStore — initial state', () => {
  beforeEach(() => {
    resetStore()
  })

  it('starts with empty blocks, edges, loops, groups', () => {
    const state = useWorkflowStore.getState()
    expect(state.blocks).toEqual({})
    expect(state.edges).toEqual([])
    expect(state.loops).toEqual({})
    expect(state.groups).toEqual({})
  })

  it('starts with empty selection and no highlight', () => {
    const state = useWorkflowStore.getState()
    expect(state.selectedNodeIds).toEqual([])
    expect(state.highlightedNodeId).toBeNull()
    expect(state.highlightedEdgeIds).toEqual([])
  })

  it('starts with closed right sidebar', () => {
    const state = useWorkflowStore.getState()
    expect(state.isRightSidebarOpen).toBe(false)
    expect(state.selectedBlockForSidebar).toBeNull()
  })

  it('starts with an empty history', () => {
    const state = useWorkflowStore.getState()
    expect(state.history.past).toEqual([])
    expect(state.history.future).toEqual([])
  })

  it('exposes all expected action methods', () => {
    const state = useWorkflowStore.getState()
    // Block actions
    expect(typeof state.addBlock).toBe('function')
    expect(typeof state.removeBlock).toBe('function')
    expect(typeof state.updateBlock).toBe('function')
    expect(typeof state.duplicateBlock).toBe('function')
    expect(typeof state.updateBlockName).toBe('function')
    expect(typeof state.updateBlockPosition).toBe('function')
    expect(typeof state.toggleBlockEnabled).toBe('function')
    expect(typeof state.toggleBlockWide).toBe('function')
    expect(typeof state.toggleBlockMinimized).toBe('function')
    expect(typeof state.toggleBlockNodeStyle).toBe('function')
    expect(typeof state.resetBlock).toBe('function')
    // Edge actions
    expect(typeof state.addEdge).toBe('function')
    expect(typeof state.removeEdge).toBe('function')
    expect(typeof state.updateEdgeStyle).toBe('function')
    expect(typeof state.updateEdgeColor).toBe('function')
    // Group actions
    expect(typeof state.createGroup).toBe('function')
    expect(typeof state.deleteGroup).toBe('function')
    // Loop actions
    expect(typeof state.updateLoopIterations).toBe('function')
    expect(typeof state.updateLoopType).toBe('function')
    // Selection actions
    expect(typeof state.setSelectedNodes).toBe('function')
    expect(typeof state.clearSelection).toBe('function')
    expect(typeof state.toggleRightSidebar).toBe('function')
    // Batch actions
    expect(typeof state.batchUpdateBlocks).toBe('function')
    expect(typeof state.batchUpdateEdges).toBe('function')
    expect(typeof state.batchDeleteBlocks).toBe('function')
    // History
    expect(typeof state.undo).toBe('function')
    expect(typeof state.redo).toBe('function')
    expect(typeof state.canUndo).toBe('function')
    expect(typeof state.canRedo).toBe('function')
  })
})

describe('useWorkflowStore — block CRUD', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addBlock adds a block', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'Agent 1', { x: 1, y: 2 })
    const { blocks } = useWorkflowStore.getState()
    expect(blocks['b1']).toBeDefined()
    expect(blocks['b1'].type).toBe('agent')
    expect(blocks['b1'].position).toEqual({ x: 1, y: 2 })
  })

  it('removeBlock removes a non-starter block', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().removeBlock('b1')
    expect(useWorkflowStore.getState().blocks['b1']).toBeUndefined()
  })

  it('removeBlock protects starter block', () => {
    useWorkflowStore.getState().addBlock('s1', 'starter', 'Start', { x: 0, y: 0 })
    useWorkflowStore.getState().removeBlock('s1')
    expect(useWorkflowStore.getState().blocks['s1']).toBeDefined()
  })

  it('updateBlockPosition moves a block', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().updateBlockPosition('b1', { x: 50, y: 75 })
    expect(useWorkflowStore.getState().blocks['b1'].position).toEqual({
      x: 50,
      y: 75,
    })
  })

  it('toggleBlockEnabled flips enabled state', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    expect(useWorkflowStore.getState().blocks['b1'].enabled).toBe(true)
    useWorkflowStore.getState().toggleBlockEnabled('b1')
    expect(useWorkflowStore.getState().blocks['b1'].enabled).toBe(false)
  })

  it('updateBlockName updates block name', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().updateBlockName('b1', 'New Name')
    expect(useWorkflowStore.getState().blocks['b1'].name).toBe('New Name')
  })
})

describe('useWorkflowStore — edges', () => {
  beforeEach(() => {
    resetStore()
    useWorkflowStore.getState().addBlock('a', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().addBlock('b', 'agent', 'B', { x: 100, y: 0 })
  })

  it('addEdge adds an edge', () => {
    useWorkflowStore.getState().addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(useWorkflowStore.getState().edges).toHaveLength(1)
  })

  it('removeEdge removes an edge', () => {
    useWorkflowStore.getState().addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    const id = useWorkflowStore.getState().edges[0].id
    useWorkflowStore.getState().removeEdge(id)
    expect(useWorkflowStore.getState().edges).toHaveLength(0)
  })

  it('edges are removed when source or target block is removed', () => {
    useWorkflowStore.getState().addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    useWorkflowStore.getState().removeBlock('b')
    expect(useWorkflowStore.getState().edges).toHaveLength(0)
  })
})

describe('useWorkflowStore — selection', () => {
  beforeEach(() => {
    resetStore()
  })

  it('setSelectedNodes replaces selection', () => {
    useWorkflowStore.getState().setSelectedNodes(['a', 'b'])
    expect(useWorkflowStore.getState().selectedNodeIds).toEqual(['a', 'b'])
  })

  it('addToSelection adds a node', () => {
    useWorkflowStore.getState().addToSelection('a')
    useWorkflowStore.getState().addToSelection('b')
    expect(useWorkflowStore.getState().selectedNodeIds).toEqual(['a', 'b'])
  })

  it('toggleNodeSelection toggles in and out', () => {
    useWorkflowStore.getState().toggleNodeSelection('a')
    expect(useWorkflowStore.getState().selectedNodeIds).toEqual(['a'])
    useWorkflowStore.getState().toggleNodeSelection('a')
    expect(useWorkflowStore.getState().selectedNodeIds).toEqual([])
  })

  it('clearSelection empties selection', () => {
    useWorkflowStore.getState().setSelectedNodes(['a', 'b'])
    useWorkflowStore.getState().clearSelection()
    expect(useWorkflowStore.getState().selectedNodeIds).toEqual([])
  })
})

describe('useWorkflowStore — right sidebar', () => {
  beforeEach(() => {
    resetStore()
  })

  it('openRightSidebar opens with block id', () => {
    useWorkflowStore.getState().openRightSidebar('b1')
    const s = useWorkflowStore.getState()
    expect(s.isRightSidebarOpen).toBe(true)
    expect(s.selectedBlockForSidebar).toBe('b1')
  })

  it('closeRightSidebar clears', () => {
    useWorkflowStore.getState().openRightSidebar('b1')
    useWorkflowStore.getState().closeRightSidebar()
    expect(useWorkflowStore.getState().isRightSidebarOpen).toBe(false)
  })

  it('toggleRightSidebar closes when same block toggled', () => {
    useWorkflowStore.getState().openRightSidebar('b1')
    useWorkflowStore.getState().toggleRightSidebar('b1')
    expect(useWorkflowStore.getState().isRightSidebarOpen).toBe(false)
  })
})

describe('useWorkflowStore — deployment + schedule/webhook', () => {
  beforeEach(() => {
    resetStore()
  })

  it('setDeploymentStatus marks deployed', () => {
    useWorkflowStore.getState().setDeploymentStatus(true)
    const s = useWorkflowStore.getState()
    expect(s.isDeployed).toBe(true)
    expect(s.deployedAt).toBeInstanceOf(Date)
  })

  it('setScheduleStatus updates schedule', () => {
    useWorkflowStore.getState().setScheduleStatus(true)
    expect(useWorkflowStore.getState().hasActiveSchedule).toBe(true)
  })

  it('setWebhookStatus clears schedule when enabling webhook', () => {
    useWorkflowStore.getState().setScheduleStatus(true)
    useWorkflowStore.getState().setWebhookStatus(true)
    const s = useWorkflowStore.getState()
    expect(s.hasActiveWebhook).toBe(true)
    expect(s.hasActiveSchedule).toBe(false)
  })

  it('setNeedsRedeploymentFlag toggles flag', () => {
    useWorkflowStore.getState().setNeedsRedeploymentFlag(true)
    expect(useWorkflowStore.getState().needsRedeployment).toBe(true)
    useWorkflowStore.getState().setNeedsRedeploymentFlag(false)
    expect(useWorkflowStore.getState().needsRedeployment).toBe(false)
  })
})

describe('useWorkflowStore — history (undo/redo)', () => {
  beforeEach(() => {
    resetStore()
  })

  it('canUndo returns false on fresh state', () => {
    expect(useWorkflowStore.getState().canUndo()).toBe(false)
  })

  it('canRedo returns false on fresh state', () => {
    expect(useWorkflowStore.getState().canRedo()).toBe(false)
  })

  it('canUndo returns true after an action that pushes history', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    expect(useWorkflowStore.getState().canUndo()).toBe(true)
  })

  it('undo reverts an addBlock', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    expect(useWorkflowStore.getState().blocks['b1']).toBeDefined()
    useWorkflowStore.getState().undo()
    // after undo, block should be gone
    expect(useWorkflowStore.getState().blocks['b1']).toBeUndefined()
  })

  it('redo re-applies after undo', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().undo()
    expect(useWorkflowStore.getState().canRedo()).toBe(true)
    useWorkflowStore.getState().redo()
    expect(useWorkflowStore.getState().blocks['b1']).toBeDefined()
  })

  it('getHistorySize returns >=1', () => {
    expect(useWorkflowStore.getState().getHistorySize()).toBeGreaterThanOrEqual(1)
  })

  it('clearHistory resets history past/future', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().clearHistory()
    const { history } = useWorkflowStore.getState()
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
  })

  it('exportHistory returns valid JSON', () => {
    const json = useWorkflowStore.getState().exportHistory()
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json)
    expect(parsed.past).toBeDefined()
    expect(parsed.present).toBeDefined()
    expect(parsed.future).toBeDefined()
  })

  it('importHistory loads from JSON string', () => {
    const json = useWorkflowStore.getState().exportHistory()
    const ok = useWorkflowStore.getState().importHistory(json)
    expect(ok).toBe(true)
  })

  it('importHistory rejects invalid JSON', () => {
    const ok = useWorkflowStore.getState().importHistory('{ invalid')
    expect(ok).toBe(false)
  })

  it('importHistory rejects structurally invalid payloads', () => {
    const ok = useWorkflowStore.getState().importHistory('{}')
    expect(ok).toBe(false)
  })
})

describe('useWorkflowStore — clear', () => {
  beforeEach(() => {
    resetStore()
  })

  it('clear resets blocks, edges, selection', () => {
    useWorkflowStore.getState().addBlock('b1', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().setSelectedNodes(['b1'])
    useWorkflowStore.getState().clear()
    const s = useWorkflowStore.getState()
    expect(s.blocks).toEqual({})
    expect(s.edges).toEqual([])
    expect(s.selectedNodeIds).toEqual([])
  })
})

describe('useWorkflowStore — groups (via root store)', () => {
  beforeEach(() => {
    resetStore()
    useWorkflowStore.getState().addBlock('a', 'agent', 'A', { x: 0, y: 0 })
    useWorkflowStore.getState().addBlock('b', 'agent', 'B', { x: 100, y: 0 })
  })

  it('createGroup/deleteGroup round trip', () => {
    const id = useWorkflowStore.getState().createGroup(['a', 'b'], 'G1')
    expect(id).toBeTruthy()
    expect(useWorkflowStore.getState().groups[id]).toBeDefined()
    useWorkflowStore.getState().deleteGroup(id)
    expect(useWorkflowStore.getState().groups[id]).toBeUndefined()
  })

  it('updateGroupName / updateGroupColor', () => {
    const id = useWorkflowStore.getState().createGroup(['a', 'b'])
    useWorkflowStore.getState().updateGroupName(id, 'RenamedGroup')
    useWorkflowStore.getState().updateGroupColor(id, '#abcdef')
    const g = useWorkflowStore.getState().groups[id]
    expect(g.name).toBe('RenamedGroup')
    expect(g.color).toBe('#abcdef')
  })
})

describe('useWorkflowStore — interaction tracking', () => {
  beforeEach(() => {
    resetStore()
  })

  it('setDragging sets isDragging flag', () => {
    useWorkflowStore.getState().setDragging(true)
    expect(useWorkflowStore.getState().interaction.isDragging).toBe(true)
  })

  it('setEditing sets isEditing flag', () => {
    useWorkflowStore.getState().setEditing(true)
    expect(useWorkflowStore.getState().interaction.isEditing).toBe(true)
  })

  it('markDurableChange updates lastDurableChangeTime', () => {
    useWorkflowStore.getState().markDurableChange()
    expect(useWorkflowStore.getState().interaction.lastDurableChangeTime).toBeGreaterThan(0)
  })
})
