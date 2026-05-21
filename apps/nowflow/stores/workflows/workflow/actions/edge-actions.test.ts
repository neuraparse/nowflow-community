/**
 * Tests for edge-actions slice.
 * Covers: cycle prevention, utility edge rules
 */
import { describe, expect, it, vi } from 'vitest'
import { createEdgeActionsSlice } from './edge-actions'

// Mock getBlock for utility detection
vi.mock('@/blocks', () => ({
  getBlock: (type: string) => {
    const utilityTypes = [
      'variable',
      'data_table',
      'math',
      'json_processor',
      'text_processor',
      'csv_processor',
      'translate',
      'pii_mask',
      'shared_memory',
      'mistral_parse',
      'ai_guardrails',
    ]
    return {
      type,
      name: type,
      isUtility: utilityTypes.includes(type),
    }
  },
}))

vi.mock('../../common/optimizations', () => ({
  calculateLoops: () => ({}),
}))

vi.mock('../../middleware', () => ({
  pushHistory: vi.fn(),
}))

vi.mock('../../sync', () => ({
  workflowSync: { syncImmediate: vi.fn() },
}))

function createMockEdgeStore(initialBlocks: Record<string, any> = {}, initialEdges: any[] = []) {
  const state: any = {
    blocks: initialBlocks,
    edges: initialEdges,
    loops: {},
  }

  const get = () => state
  const safeSet = (updater: any) => {
    const newState = typeof updater === 'function' ? updater(state) : updater
    Object.assign(state, newState)
  }

  const actions = createEdgeActionsSlice({ safeSet, get })
  state.updateLastSaved = vi.fn()
  state.markDurableChange = vi.fn()

  return { state, actions }
}

describe('addEdge - basic validation', () => {
  it('adds a valid edge', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(1)
  })

  it('rejects self-loop', () => {
    const blocks = { a: { id: 'a', type: 'agent', name: 'A' } }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'a',
      target: 'a',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(0)
  })

  it('rejects duplicate edges', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
    }
    const existing = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
    ]
    const { state, actions } = createMockEdgeStore(blocks, existing)
    actions.addEdge({
      source: 'a',
      target: 'b',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(1) // Still 1
  })

  it('rejects edges when either endpoint block is missing', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'a',
      target: 'missing',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(0)
  })
})

describe('addEdge - cycle prevention', () => {
  it('prevents direct backward edge (A→B exists, reject B→A)', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
    }
    const existing = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
    ]
    const { state, actions } = createMockEdgeStore(blocks, existing)
    actions.addEdge({
      source: 'b',
      target: 'a',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(1) // Rejected
  })

  it('prevents indirect cycle (A→B→C exists, reject C→A)', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
      c: { id: 'c', type: 'agent', name: 'C' },
    }
    const existing = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
      { id: 'e2', source: 'b', target: 'c', sourceHandle: 'source', targetHandle: 'target' },
    ]
    const { state, actions } = createMockEdgeStore(blocks, existing)
    actions.addEdge({
      source: 'c',
      target: 'a',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(2) // Rejected
  })

  it('allows forward edge in existing chain', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'agent', name: 'B' },
      c: { id: 'c', type: 'agent', name: 'C' },
    }
    const existing = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
    ]
    const { state, actions } = createMockEdgeStore(blocks, existing)
    actions.addEdge({
      source: 'b',
      target: 'c',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(2)
  })
})

describe('addEdge - utility edge rules', () => {
  it('allows utility-source → utility-target between utility and normal block', () => {
    const blocks = {
      'var-1': { id: 'var-1', type: 'variable', name: 'Var' },
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'var-1',
      target: 'agent-1',
      sourceHandle: 'utility-source',
      targetHandle: 'utility-target',
    } as any)
    expect(state.edges.length).toBe(1)
  })

  it('rejects utility block connecting via regular source handle', () => {
    const blocks = {
      'var-1': { id: 'var-1', type: 'variable', name: 'Var' },
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'var-1',
      target: 'agent-1',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(0) // Rejected
  })

  it('allows normal block feeding data INTO utility block via regular handles', () => {
    const blocks = {
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent' },
      'math-1': { id: 'math-1', type: 'math', name: 'Math' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'agent-1',
      target: 'math-1',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(1) // Allowed: feeding data into utility
  })

  it('allows feeding an attached utility without treating its slot edge as a cycle', () => {
    const blocks = {
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent' },
      'math-1': { id: 'math-1', type: 'math', name: 'Math' },
    }
    const existing = [
      {
        id: 'slot-edge',
        source: 'math-1',
        target: 'agent-1',
        sourceHandle: 'utility-source',
        targetHandle: 'utility-target',
      },
    ]
    const { state, actions } = createMockEdgeStore(blocks, existing)
    actions.addEdge({
      source: 'agent-1',
      target: 'math-1',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(2)
  })

  it('rejects utility block outputting via regular source to another utility', () => {
    const blocks = {
      'math-1': { id: 'math-1', type: 'math', name: 'Math' },
      'text-1': { id: 'text-1', type: 'text_processor', name: 'Text' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'math-1',
      target: 'text-1',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(0) // Rejected: utility cannot output via regular handles
  })

  it('allows normal-to-normal connection via regular handles', () => {
    const blocks = {
      'agent-1': { id: 'agent-1', type: 'agent', name: 'Agent 1' },
      'agent-2': { id: 'agent-2', type: 'agent', name: 'Agent 2' },
    }
    const { state, actions } = createMockEdgeStore(blocks)
    actions.addEdge({
      source: 'agent-1',
      target: 'agent-2',
      sourceHandle: 'source',
      targetHandle: 'target',
    } as any)
    expect(state.edges.length).toBe(1)
  })
})

describe('removeEdge', () => {
  it('removes an existing edge', () => {
    const existing = [{ id: 'e1', source: 'a', target: 'b' }]
    const { state, actions } = createMockEdgeStore({}, existing)
    actions.removeEdge('e1')
    expect(state.edges.length).toBe(0)
  })

  it('does nothing for non-existent edge', () => {
    const existing = [{ id: 'e1', source: 'a', target: 'b' }]
    const { state, actions } = createMockEdgeStore({}, existing)
    actions.removeEdge('e999')
    expect(state.edges.length).toBe(1)
  })
})
