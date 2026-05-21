/**
 * Tests for batch-actions slice.
 * Covers: starter block filtering in batch delete
 */
import { describe, expect, it, vi } from 'vitest'
import { createBatchActionsSlice } from './batch-actions'

vi.mock('../../common/validators', () => ({
  validateBatchUpdates: () => ({ valid: true }),
}))

vi.mock('../../middleware', () => ({
  pushHistory: vi.fn(),
}))

vi.mock('../../registry/store', () => ({
  useWorkflowRegistry: { getState: () => ({ activeWorkflowId: 'wf-1' }) },
}))

vi.mock('../../subblock/store', () => ({
  useSubBlockStore: {
    getState: () => ({ workflowValues: { 'wf-1': {} } }),
    setState: vi.fn(),
  },
}))

vi.mock('../../sync', () => ({
  workflowSync: { syncImmediate: vi.fn(), syncUserAction: vi.fn() },
}))

vi.mock('../../../validation/store', () => ({
  useValidationStore: { getState: () => ({ clearBlock: vi.fn() }) },
}))

function createMockBatchStore(blocks: Record<string, any>) {
  const state: any = {
    blocks: { ...blocks },
    edges: [],
    loops: {},
    groups: {},
  }

  const get = () => state
  const safeSet = (updater: any) => {
    const newState = typeof updater === 'function' ? updater(state) : updater
    Object.assign(state, newState)
  }

  const batchBlockDeleter = (blockIds: string[]) => {
    const newBlocks = { ...state.blocks }
    blockIds.forEach((id) => delete newBlocks[id])
    return {
      blocks: newBlocks,
      edges: state.edges,
      loops: state.loops,
      groups: state.groups,
    }
  }

  const actions = createBatchActionsSlice({
    safeSet,
    get,
    batchBlockUpdater: vi.fn(),
    batchEdgeUpdater: vi.fn(),
    batchBlockDeleter,
  })

  state.updateLastSaved = vi.fn()
  state.markDurableChange = vi.fn()

  return { state, actions }
}

describe('batchDeleteBlocks', () => {
  it('deletes multiple regular blocks', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'function', name: 'B' },
      c: { id: 'c', type: 'api', name: 'C' },
    }
    const { state, actions } = createMockBatchStore(blocks)
    actions.batchDeleteBlocks(['a', 'b'])
    expect(state.blocks['a']).toBeUndefined()
    expect(state.blocks['b']).toBeUndefined()
    expect(state.blocks['c']).toBeDefined()
  })

  it('filters out starter block from batch delete', () => {
    const blocks = {
      'starter-1': { id: 'starter-1', type: 'starter', name: 'Start' },
      a: { id: 'a', type: 'agent', name: 'A' },
      b: { id: 'b', type: 'function', name: 'B' },
    }
    const { state, actions } = createMockBatchStore(blocks)
    actions.batchDeleteBlocks(['starter-1', 'a', 'b'])
    // Starter should survive
    expect(state.blocks['starter-1']).toBeDefined()
    // Others should be deleted
    expect(state.blocks['a']).toBeUndefined()
    expect(state.blocks['b']).toBeUndefined()
  })

  it('does nothing when only starter block is in delete list', () => {
    const blocks = {
      'starter-1': { id: 'starter-1', type: 'starter', name: 'Start' },
      a: { id: 'a', type: 'agent', name: 'A' },
    }
    const { state, actions } = createMockBatchStore(blocks)
    actions.batchDeleteBlocks(['starter-1'])
    expect(state.blocks['starter-1']).toBeDefined()
    expect(state.blocks['a']).toBeDefined()
  })

  it('handles empty array', () => {
    const blocks = {
      a: { id: 'a', type: 'agent', name: 'A' },
    }
    const { state, actions } = createMockBatchStore(blocks)
    actions.batchDeleteBlocks([])
    expect(state.blocks['a']).toBeDefined()
  })
})
