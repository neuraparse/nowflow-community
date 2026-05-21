/**
 * Tests for workflow middleware (withHistory, createHistoryEntry, pushHistory).
 * Exercises the middleware by wrapping a fake Zustand store and asserting
 * side effects on history, persistence, and the registry/subblock stores.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import {
  createHistoryEntry,
  pushHistory,
  withHistory,
  type WorkflowStoreWithHistory,
} from '@/stores/workflows/middleware'
import { saveSubblockValues, saveWorkflowState } from '@/stores/workflows/persistence'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock persistence so we don't hit localStorage and can assert calls.
vi.mock('@/stores/workflows/persistence', () => ({
  saveWorkflowState: vi.fn(() => true),
  saveSubblockValues: vi.fn(() => true),
}))

// Provide in-memory fake stores for registry + subblock.
vi.mock('@/stores/workflows/registry/store', () => {
  const state = { activeWorkflowId: 'wf-1' as string | null }
  return {
    useWorkflowRegistry: {
      getState: () => state,
      setState: (partial: any) => Object.assign(state, partial),
    },
  }
})

vi.mock('@/stores/workflows/subblock/store', () => {
  const state: { workflowValues: Record<string, any> } = { workflowValues: {} }
  return {
    useSubBlockStore: {
      getState: () => state,
      setState: (partial: any) =>
        typeof partial === 'function'
          ? Object.assign(state, partial(state))
          : Object.assign(state, partial),
    },
  }
})

const baseWorkflowState = () => ({
  blocks: {} as Record<string, any>,
  edges: [] as any[],
  loops: {} as Record<string, any>,
  groups: {} as Record<string, any>,
  selectedNodeIds: [] as string[],
  highlightedNodeId: null as string | null,
  highlightedEdgeIds: [] as string[],
  selectedBlockForSidebar: null as string | null,
  isRightSidebarOpen: false,
  lastSaved: 0,
  isDeployed: false,
  deployedAt: undefined as any,
  needsRedeployment: false,
  hasActiveSchedule: false,
  hasActiveWebhook: false,
  lastUpdate: undefined as any,
  interaction: {
    isDragging: false,
    isEditing: false,
    lastInteractionTime: 0,
    lastDurableChangeTime: 0,
  },
})

// Minimal stand-in for WorkflowStore that withHistory wraps.
const makeInnerConfig = () => () => ({
  ...baseWorkflowState(),
})

const buildStore = () =>
  create<WorkflowStoreWithHistory>()(withHistory(makeInnerConfig() as any) as any)

describe('withHistory middleware', () => {
  beforeEach(() => {
    vi.mocked(saveWorkflowState).mockClear()
    vi.mocked(saveSubblockValues).mockClear()
    // Reset registry/subblock fake state
    ;(useWorkflowRegistry.getState() as any).activeWorkflowId = 'wf-1'
    ;(useSubBlockStore.getState() as any).workflowValues = {}
  })

  it('initializes with an empty past/future and an initial present entry', () => {
    const store = buildStore()
    const s = store.getState()
    expect(s.history.past).toEqual([])
    expect(s.history.future).toEqual([])
    expect(s.history.present.action).toBe('Initial state')
    expect(s.history.present.state.blocks).toEqual({})
  })

  it('canUndo/canRedo reflect history stack sizes', () => {
    const store = buildStore()
    expect(store.getState().canUndo()).toBe(false)
    expect(store.getState().canRedo()).toBe(false)

    // Simulate a push by setting history directly
    store.setState((prev: any) => ({
      history: {
        past: [prev.history.present],
        present: {
          ...prev.history.present,
          action: 'after push',
          timestamp: Date.now(),
        },
        future: [],
      },
    }))
    expect(store.getState().canUndo()).toBe(true)
    expect(store.getState().canRedo()).toBe(false)
  })

  it('getHistorySize counts past + present + future', () => {
    const store = buildStore()
    expect(store.getState().getHistorySize()).toBe(1)

    store.setState((prev: any) => ({
      history: {
        past: [prev.history.present, prev.history.present],
        present: prev.history.present,
        future: [prev.history.present],
      },
    }))
    expect(store.getState().getHistorySize()).toBe(4)
  })

  it('undo pops past onto future and persists', () => {
    const store = buildStore()
    const original = store.getState().history.present
    const pastEntry = {
      ...original,
      action: 'past-1',
      state: { ...original.state, blocks: { a: { id: 'a' } } as any },
      subblockValues: { a: { foo: 'bar' } },
    }

    store.setState({
      history: { past: [pastEntry as any], present: original, future: [] },
    })

    store.getState().undo()
    const after = store.getState()
    expect(after.history.past).toEqual([])
    expect(after.history.present).toEqual(pastEntry)
    expect(after.history.future).toEqual([original])
    expect(after.blocks).toEqual({ a: { id: 'a' } })
    expect(saveWorkflowState).toHaveBeenCalled()
    expect(saveSubblockValues).toHaveBeenCalledWith('wf-1', { a: { foo: 'bar' } })
    // Subblock store received the snapshot
    expect((useSubBlockStore.getState() as any).workflowValues['wf-1']).toEqual({
      a: { foo: 'bar' },
    })
  })

  it('undo is a no-op when past is empty', () => {
    const store = buildStore()
    store.getState().undo()
    expect(saveWorkflowState).not.toHaveBeenCalled()
    expect(store.getState().history.past).toEqual([])
  })

  it('undo does nothing when no active workflow', () => {
    ;(useWorkflowRegistry.getState() as any).activeWorkflowId = null
    const store = buildStore()
    const original = store.getState().history.present
    store.setState({
      history: {
        past: [{ ...original, action: 'past' } as any],
        present: original,
        future: [],
      },
    })
    store.getState().undo()
    expect(saveWorkflowState).not.toHaveBeenCalled()
  })

  it('redo pops future onto past and persists', () => {
    const store = buildStore()
    const original = store.getState().history.present
    const futureEntry = {
      ...original,
      action: 'future-1',
      state: { ...original.state, blocks: { b: { id: 'b' } } as any },
      subblockValues: { b: {} },
    }

    store.setState({
      history: { past: [], present: original, future: [futureEntry as any] },
    })

    store.getState().redo()
    const after = store.getState()
    expect(after.history.future).toEqual([])
    expect(after.history.present).toEqual(futureEntry)
    expect(after.history.past).toEqual([original])
    expect(after.blocks).toEqual({ b: { id: 'b' } })
    expect(saveSubblockValues).toHaveBeenCalledWith('wf-1', { b: {} })
  })

  it('redo is a no-op when future is empty', () => {
    const store = buildStore()
    store.getState().redo()
    expect(saveWorkflowState).not.toHaveBeenCalled()
  })

  it('clear resets blocks/edges and history', () => {
    const store = buildStore()
    // Seed some blocks
    store.setState({ blocks: { a: { id: 'a' } as any } })
    ;(store.getState() as any).clear()
    const after = store.getState()
    expect(after.blocks).toEqual({})
    expect(after.edges).toEqual([])
    expect(after.history.past).toEqual([])
    expect(after.history.future).toEqual([])
    expect(after.history.present.action).toBe('Clear workflow')
  })

  it('revertToHistoryState jumps to given index and persists', () => {
    const store = buildStore()
    const original = store.getState().history.present
    const entry1 = { ...original, action: '1' }
    const entry2 = {
      ...original,
      action: '2',
      state: { ...original.state, blocks: { z: { id: 'z' } } as any },
    }
    const entry3 = { ...original, action: '3' }

    store.setState({
      history: { past: [entry1 as any], present: entry2 as any, future: [entry3 as any] },
    })

    // allStates = [entry1, entry2, entry3]; jump to index 2 (entry3)
    store.getState().revertToHistoryState(2)
    const after = store.getState()
    expect(after.history.present).toEqual(entry3)
    expect(after.history.past.length).toBe(2)
    expect(after.history.future.length).toBe(0)
    expect(saveWorkflowState).toHaveBeenCalled()
  })

  it('revertToHistoryState is a no-op for out-of-range index', () => {
    const store = buildStore()
    store.getState().revertToHistoryState(99)
    expect(saveWorkflowState).not.toHaveBeenCalled()
  })

  it('clearHistory empties past and future only', () => {
    const store = buildStore()
    const original = store.getState().history.present
    store.setState({
      history: {
        past: [{ ...original } as any],
        present: original,
        future: [{ ...original } as any],
      },
    })
    store.getState().clearHistory()
    const after = store.getState()
    expect(after.history.past).toEqual([])
    expect(after.history.future).toEqual([])
    expect(after.history.present).toEqual(original)
    expect(saveWorkflowState).toHaveBeenCalled()
  })

  it('exportHistory returns valid JSON with past/present/future', () => {
    const store = buildStore()
    const json = store.getState().exportHistory()
    const parsed = JSON.parse(json)
    expect(parsed).toHaveProperty('past')
    expect(parsed).toHaveProperty('present')
    expect(parsed).toHaveProperty('future')
    expect(parsed).toHaveProperty('version', '1.0')
    expect(parsed).toHaveProperty('exportedAt')
  })

  it('importHistory returns false for invalid JSON', () => {
    const store = buildStore()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(store.getState().importHistory('not json')).toBe(false)
    errSpy.mockRestore()
  })

  it('importHistory returns false for missing fields', () => {
    const store = buildStore()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = JSON.stringify({ past: [] }) // missing present/future
    expect(store.getState().importHistory(bad)).toBe(false)
    errSpy.mockRestore()
  })

  it('importHistory returns true for valid payload and updates state', () => {
    const store = buildStore()
    const original = store.getState().history.present
    const payload = JSON.stringify({
      past: [{ ...original, action: 'imported-past' }],
      present: { ...original, action: 'imported-present' },
      future: [],
    })
    const ok = store.getState().importHistory(payload)
    expect(ok).toBe(true)
    const after = store.getState()
    expect(after.history.present.action).toBe('imported-present')
    expect(after.history.past[0].action).toBe('imported-past')
    expect(saveWorkflowState).toHaveBeenCalled()
  })

  it('revertToDeployedState sets state and appends entry to history', () => {
    const store = buildStore()
    const deployed = {
      ...baseWorkflowState(),
      blocks: { x: { id: 'x' } as any },
      isDeployed: true,
      deployedAt: new Date('2024-01-01'),
    }
    ;(store.getState() as any).revertToDeployedState(deployed)
    const after = store.getState()
    expect(after.blocks).toEqual({ x: { id: 'x' } })
    expect(after.history.past.length).toBe(1)
    expect(after.history.future).toEqual([])
    expect(after.history.present.action).toBe('Reverted to deployed state')
    expect(saveWorkflowState).toHaveBeenCalled()
  })
})

describe('createHistoryEntry', () => {
  beforeEach(() => {
    ;(useWorkflowRegistry.getState() as any).activeWorkflowId = 'wf-1'
    ;(useSubBlockStore.getState() as any).workflowValues = {}
  })

  it('creates a shallow copy of blocks/edges so replacing keys in source is isolated', () => {
    const state = baseWorkflowState()
    state.blocks = { a: { id: 'a' } as any }
    const entry = createHistoryEntry(state as any, 'test-action')
    expect(entry.action).toBe('test-action')
    expect(entry.state.blocks).toEqual({ a: { id: 'a' } })
    // Adding a new key to the original should not affect the snapshot
    state.blocks.b = { id: 'b' } as any
    expect(entry.state.blocks.b).toBeUndefined()
    // The snapshot is a new object reference
    expect(entry.state.blocks).not.toBe(state.blocks)
  })

  it('captures subblock values for the active workflow', () => {
    ;(useSubBlockStore.getState() as any).workflowValues = {
      'wf-1': { block1: { field1: 'v' } },
    }
    const entry = createHistoryEntry(baseWorkflowState() as any, 'snap')
    expect(entry.subblockValues).toEqual({ block1: { field1: 'v' } })
  })

  it('returns empty subblockValues when no active workflow', () => {
    ;(useWorkflowRegistry.getState() as any).activeWorkflowId = null
    const entry = createHistoryEntry(baseWorkflowState() as any, 'snap')
    expect(entry.subblockValues).toEqual({})
  })

  it('falls back to defaults when interaction is missing', () => {
    const state = baseWorkflowState()
    delete state.interaction
    const entry = createHistoryEntry(state as any, 'missing-interaction')
    expect(entry.state.interaction).toEqual({
      isDragging: false,
      isEditing: false,
      lastInteractionTime: 0,
      lastDurableChangeTime: 0,
    })
  })
})

describe('pushHistory', () => {
  it('appends present to past, updates present, and clears future', () => {
    const setSpy = vi.fn()
    const history = {
      past: [] as any[],
      present: {
        state: baseWorkflowState(),
        timestamp: 1,
        action: 'initial',
        subblockValues: {},
      },
      future: [{ action: 'should-be-cleared' } as any],
    }
    const getSpy = vi.fn(() => ({
      history,
      ...baseWorkflowState(),
    })) as any

    pushHistory(setSpy as any, getSpy, { blocks: { a: { id: 'a' } } as any }, 'add-block')

    expect(setSpy).toHaveBeenCalledTimes(1)
    const arg = setSpy.mock.calls[0][0]
    expect(arg.history.past).toHaveLength(1)
    expect(arg.history.past[0].action).toBe('initial')
    expect(arg.history.present.action).toBe('add-block')
    expect(arg.history.future).toEqual([])
    expect(typeof arg.lastSaved).toBe('number')
  })

  it('caps past length at MAX_HISTORY_LENGTH (20)', () => {
    const setSpy = vi.fn()
    const bigPast = Array.from({ length: 25 }, (_, i) => ({
      state: baseWorkflowState(),
      timestamp: i,
      action: `entry-${i}`,
      subblockValues: {},
    }))
    const history = {
      past: bigPast,
      present: {
        state: baseWorkflowState(),
        timestamp: 99,
        action: 'present',
        subblockValues: {},
      },
      future: [],
    }
    const getSpy = vi.fn(() => ({ history, ...baseWorkflowState() })) as any

    pushHistory(setSpy as any, getSpy, {}, 'next')
    const arg = setSpy.mock.calls[0][0]
    // past was 25 + present = 26, sliced to last 20
    expect(arg.history.past).toHaveLength(20)
    expect(arg.history.past[arg.history.past.length - 1].action).toBe('present')
  })

  it('fills missing state fields from current store state', () => {
    const setSpy = vi.fn()
    const currentState = {
      ...baseWorkflowState(),
      blocks: { existing: { id: 'existing' } as any },
      edges: [{ id: 'e' } as any],
    }
    const history = {
      past: [] as any[],
      present: {
        state: baseWorkflowState(),
        timestamp: 0,
        action: 'initial',
        subblockValues: {},
      },
      future: [] as any[],
    }
    const getSpy = vi.fn(() => ({ history, ...currentState })) as any

    pushHistory(setSpy as any, getSpy, {}, 'no-state-changes')
    const arg = setSpy.mock.calls[0][0]
    expect(arg.history.present.state.blocks).toEqual({ existing: { id: 'existing' } })
    expect(arg.history.present.state.edges).toEqual([{ id: 'e' }])
  })
})
