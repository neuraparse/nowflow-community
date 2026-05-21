/**
 * Tests for block-actions slice.
 * Covers: starter block protection (add, remove, duplicate)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubBlockStore } from '../../subblock/store'
import { createBlockActionsSlice } from './block-actions'

// Mock dependencies
vi.mock('@/blocks', () => ({
  getBlock: (type: string) => {
    if (type === 'starter')
      return {
        type: 'starter',
        name: 'Starter',
        subBlocks: [],
        outputs: { response: { type: { input: 'any' } } },
      }
    if (type === 'agent')
      return {
        type: 'agent',
        name: 'Agent',
        subBlocks: [
          { id: 'operation', type: 'dropdown', value: 'chat' },
          { id: 'temperature', type: 'slider', value: 0.7 },
        ],
        outputs: { response: { type: { content: 'string' } } },
      }
    if (type === 'function')
      return {
        type: 'function',
        name: 'Function',
        subBlocks: [],
        outputs: { response: { type: { result: 'json' } } },
      }
    return null
  },
}))

vi.mock('@/blocks/utils', () => ({
  resolveOutputType: () => ({ response: { type: 'json' } }),
}))

vi.mock('../../common/optimizations', () => ({
  calculateLoops: () => ({}),
}))

vi.mock('../../middleware', () => ({
  pushHistory: vi.fn(),
}))

vi.mock('../../registry/store', () => ({
  useWorkflowRegistry: { getState: () => ({ activeWorkflowId: 'wf-1' }) },
}))

vi.mock('../../subblock/store', () => ({
  useSubBlockStore: {
    getState: () => ({ workflowValues: {} }),
    setState: vi.fn(),
  },
}))

vi.mock('../../sync', () => ({
  workflowSync: { syncImmediate: vi.fn(), syncUserAction: vi.fn() },
}))

vi.mock('../../utils', () => ({
  mergeSubblockState: (blocks: any) => blocks,
}))

vi.mock('../../workflow-style/store', () => ({
  useWorkflowStyleStore: { getState: () => ({ globalNodeStyle: 'default' }) },
}))

vi.mock('../../../validation/store', () => ({
  useValidationStore: { getState: () => ({ clearBlock: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function createMockStore(initialBlocks: Record<string, any> = {}) {
  const state: any = {
    blocks: initialBlocks,
    edges: [],
    loops: {},
    groups: {},
  }

  const get = () => state
  const safeSet = (updater: any) => {
    const newState = typeof updater === 'function' ? updater(state) : updater
    Object.assign(state, newState)
  }

  const actions = createBlockActionsSlice({ safeSet, get })
  // Attach store methods the actions expect
  state.updateLastSaved = vi.fn()
  state.markDurableChange = vi.fn()

  return { state, get, safeSet, actions }
}

describe('addBlock', () => {
  it('adds a regular block', () => {
    const { state, actions } = createMockStore()
    actions.addBlock('block-1', 'agent', 'Agent 1', { x: 100, y: 100 })
    expect(state.blocks['block-1']).toBeDefined()
    expect(state.blocks['block-1'].type).toBe('agent')
  })

  it('preserves configured subblock defaults and seeds subblock values immediately', () => {
    const { state, actions } = createMockStore()
    actions.addBlock('block-1', 'agent', 'Agent 1', { x: 100, y: 100 })

    expect(state.blocks['block-1'].subBlocks.operation.value).toBe('chat')
    expect(state.blocks['block-1'].subBlocks.temperature.value).toBe(0.7)

    const setState = vi.mocked(useSubBlockStore.setState)
    expect(setState).toHaveBeenCalled()
    const updater = setState.mock.calls.at(-1)?.[0] as any
    const next = updater({ workflowValues: { 'wf-1': {} } })
    expect(next.workflowValues['wf-1']['block-1']).toEqual({
      operation: 'chat',
      temperature: 0.7,
    })
  })

  it('adds a starter block when none exists', () => {
    const { state, actions } = createMockStore()
    actions.addBlock('starter-1', 'starter', 'Start', { x: 0, y: 0 })
    expect(state.blocks['starter-1']).toBeDefined()
    expect(state.blocks['starter-1'].type).toBe('starter')
  })

  it('prevents adding a second starter block', () => {
    const { state, actions } = createMockStore({
      'starter-1': { id: 'starter-1', type: 'starter', name: 'Start', position: { x: 0, y: 0 } },
    })
    actions.addBlock('starter-2', 'starter', 'Start 2', { x: 200, y: 200 })
    expect(state.blocks['starter-2']).toBeUndefined()
  })

  it('allows adding non-starter blocks when starter exists', () => {
    const { state, actions } = createMockStore({
      'starter-1': { id: 'starter-1', type: 'starter', name: 'Start', position: { x: 0, y: 0 } },
    })
    actions.addBlock('agent-1', 'agent', 'Agent 1', { x: 300, y: 100 })
    expect(state.blocks['agent-1']).toBeDefined()
  })
})

describe('removeBlock', () => {
  it('removes a regular block', () => {
    const { state, actions } = createMockStore({
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent 1', position: { x: 100, y: 100 } },
    })
    actions.removeBlock('agent-1')
    expect(state.blocks['agent-1']).toBeUndefined()
  })

  it('prevents removing the starter block', () => {
    const { state, actions } = createMockStore({
      'starter-1': { id: 'starter-1', type: 'starter', name: 'Start', position: { x: 0, y: 0 } },
    })
    actions.removeBlock('starter-1')
    expect(state.blocks['starter-1']).toBeDefined()
  })

  it('removes edges connected to deleted block', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A', position: { x: 0, y: 0 } },
      b: { id: 'b', type: 'agent', name: 'B', position: { x: 100, y: 0 } },
    }
    const { state, actions } = createMockStore(blocks)
    state.edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ]
    actions.removeBlock('b')
    expect(state.edges.length).toBe(0)
  })
})

describe('duplicateBlock', () => {
  it('duplicates a regular block', () => {
    const { state, actions } = createMockStore({
      'agent-1': {
        id: 'agent-1',
        type: 'agent',
        name: 'Agent 1',
        position: { x: 100, y: 100 },
        subBlocks: {},
      },
    })
    actions.duplicateBlock('agent-1')
    const blocks = Object.values(state.blocks)
    expect(blocks.length).toBe(2)
  })

  it('prevents duplicating the starter block', () => {
    const { state, actions } = createMockStore({
      'starter-1': {
        id: 'starter-1',
        type: 'starter',
        name: 'Start',
        position: { x: 0, y: 0 },
        subBlocks: {},
      },
    })
    actions.duplicateBlock('starter-1')
    const blocks = Object.values(state.blocks)
    expect(blocks.length).toBe(1)
  })
})
