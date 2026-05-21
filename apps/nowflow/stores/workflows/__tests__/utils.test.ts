/**
 * Tests for workflow utils helpers.
 * Covers: stripTransientBlockFields, mergeSubblockState, mergeSubblockStateAsync.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mergeSubblockState,
  mergeSubblockStateAsync,
  stripTransientBlockFields,
} from '@/stores/workflows/utils'

const subblockStoreState = {
  workflowValues: {} as Record<string, Record<string, Record<string, any>>>,
  getValue: vi.fn(),
}

vi.mock('@/stores/workflows/subblock/store', () => ({
  useSubBlockStore: {
    getState: () => subblockStoreState,
  },
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}))

describe('stripTransientBlockFields', () => {
  beforeEach(() => {
    subblockStoreState.workflowValues = {}
    subblockStoreState.getValue.mockReset()
  })

  it('removes the isNew flag from every block', () => {
    const blocks = {
      a: { id: 'a', type: 't', name: 'A', isNew: true } as any,
      b: { id: 'b', type: 't', name: 'B' } as any,
    }
    const result = stripTransientBlockFields(blocks)
    expect((result.a as any).isNew).toBeUndefined()
    expect((result.b as any).isNew).toBeUndefined()
  })

  it('passes through non-object entries untouched', () => {
    const blocks = { a: null as any, b: 'str' as any }
    const result = stripTransientBlockFields(blocks)
    expect(result.a).toBeNull()
    expect(result.b).toBe('str')
  })

  it('preserves other block fields', () => {
    const blocks = {
      a: { id: 'a', type: 't', name: 'A', isNew: true, position: { x: 1, y: 2 } } as any,
    }
    const result = stripTransientBlockFields(blocks)
    expect(result.a.position).toEqual({ x: 1, y: 2 })
  })
})

describe('mergeSubblockState (sync)', () => {
  beforeEach(() => {
    subblockStoreState.workflowValues = {}
    subblockStoreState.getValue.mockReset()
  })

  it('drops blocks missing type/name after registry recovery fails', () => {
    const blocks: any = {
      ok: { id: 'ok', type: 't', name: 'OK', subBlocks: {} },
      broken: { id: 'broken' },
    }
    const result = mergeSubblockState(blocks)
    expect(result.ok).toBeDefined()
    expect(result.broken).toBeUndefined()
  })

  it('merges stored values for a specific workflow', () => {
    subblockStoreState.workflowValues = {
      w1: { a: { field: 'stored-value' } },
    }
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: {
          field: { id: 'field', type: 'short-input', value: 'default' },
        },
      },
    }
    const result = mergeSubblockState(blocks, 'w1')
    expect(result.a.subBlocks.field.value).toBe('stored-value')
  })

  it('falls back to default value when no stored value exists', () => {
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: { field: { id: 'field', type: 'short-input', value: 'default' } },
      },
    }
    const result = mergeSubblockState(blocks, 'w1')
    expect(result.a.subBlocks.field.value).toBe('default')
  })

  it('uses subBlockStore.getValue when no workflowId is provided', () => {
    subblockStoreState.getValue.mockReturnValue('fallback')
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: { field: { id: 'field', type: 'short-input', value: 'default' } },
      },
    }
    const result = mergeSubblockState(blocks)
    expect(result.a.subBlocks.field.value).toBe('fallback')
  })

  it('adds orphan stored values as minimal subblocks', () => {
    subblockStoreState.workflowValues = {
      w1: { a: { orphan: 'extra' } },
    }
    const blocks: any = {
      a: { id: 'a', type: 't', name: 'A', subBlocks: {} },
    }
    const result = mergeSubblockState(blocks, 'w1')
    expect(result.a.subBlocks.orphan).toEqual({
      id: 'orphan',
      type: 'short-input',
      value: 'extra',
    })
  })

  it('filters a specific blockId when provided', () => {
    const blocks: any = {
      a: { id: 'a', type: 't', name: 'A', subBlocks: {} },
      b: { id: 'b', type: 't', name: 'B', subBlocks: {} },
    }
    const result = mergeSubblockState(blocks, undefined, 'a')
    expect(result.a).toBeDefined()
    expect(result.b).toBeUndefined()
  })
})

describe('mergeSubblockStateAsync', () => {
  beforeEach(() => {
    subblockStoreState.workflowValues = {}
    subblockStoreState.getValue.mockReset()
  })

  it('merges stored values for a specific workflow', async () => {
    subblockStoreState.workflowValues = {
      w1: { a: { field: 'async-stored' } },
    }
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: {
          field: { id: 'field', type: 'short-input', value: 'default' },
        },
      },
    }
    const result = await mergeSubblockStateAsync(blocks, 'w1')
    expect(result.a.subBlocks.field.value).toBe('async-stored')
  })

  it('uses subBlockStore.getValue as fallback without workflowId', async () => {
    subblockStoreState.getValue.mockReturnValue('fallback-async')
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: { field: { id: 'field', type: 'short-input', value: 'default' } },
      },
    }
    const result = await mergeSubblockStateAsync(blocks)
    expect(result.a.subBlocks.field.value).toBe('fallback-async')
  })

  it('passes through blocks without subBlocks unchanged', async () => {
    const blocks: any = {
      a: { id: 'a', type: 't', name: 'A' },
    }
    const result = await mergeSubblockStateAsync(blocks)
    expect(result.a).toEqual(blocks.a)
  })

  it('keeps default value when stored value is null/undefined', async () => {
    subblockStoreState.workflowValues = {
      w1: { a: { field: null } },
    }
    const blocks: any = {
      a: {
        id: 'a',
        type: 't',
        name: 'A',
        subBlocks: { field: { id: 'field', type: 'short-input', value: 'default' } },
      },
    }
    const result = await mergeSubblockStateAsync(blocks, 'w1')
    expect(result.a.subBlocks.field.value).toBe('default')
  })

  it('filters a specific blockId when provided', async () => {
    const blocks: any = {
      a: { id: 'a', type: 't', name: 'A', subBlocks: {} },
      b: { id: 'b', type: 't', name: 'B', subBlocks: {} },
    }
    const result = await mergeSubblockStateAsync(blocks, undefined, 'a')
    expect(result.a).toBeDefined()
    expect(result.b).toBeUndefined()
  })
})
