import { describe, expect, it, vi } from 'vitest'
import { hasWorkflowChanged, stripCustomToolPrefix } from '@/lib/workflows/utils'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/db', () => ({ db: {} }))

vi.mock('@/db/schema', () => ({
  workflow: {
    id: 'id',
    userId: 'userId',
    runCount: 'runCount',
    lastRunAt: 'lastRunAt',
  },
  userStats: {
    id: 'id',
    userId: 'userId',
    totalManualExecutions: 'totalManualExecutions',
    totalApiCalls: 'totalApiCalls',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}))

const mkState = (overrides: Partial<any> = {}): any => ({
  blocks: {},
  edges: [],
  loops: {},
  ...overrides,
})

const mkBlock = (overrides: Partial<any> = {}): any => ({
  id: 'b1',
  type: 'agent',
  name: 'Block',
  position: { x: 0, y: 0 },
  subBlocks: {},
  outputs: {},
  enabled: true,
  horizontalHandles: true,
  isWide: false,
  height: 0,
  ...overrides,
})

describe('stripCustomToolPrefix', () => {
  it('removes the leading "custom_" prefix', () => {
    expect(stripCustomToolPrefix('custom_mytool')).toBe('mytool')
  })

  it('returns unchanged name when no prefix', () => {
    expect(stripCustomToolPrefix('mytool')).toBe('mytool')
  })

  it('only removes a single leading occurrence', () => {
    expect(stripCustomToolPrefix('custom_custom_foo')).toBe('custom_foo')
  })

  it('handles empty string', () => {
    expect(stripCustomToolPrefix('')).toBe('')
  })
})

describe('hasWorkflowChanged', () => {
  it('reports change when no deployed state is provided', () => {
    expect(hasWorkflowChanged(mkState(), null)).toBe(true)
  })

  it('reports no change for identical states', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { url: { id: 'url', type: 'short-input', value: 'x' } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { url: { id: 'url', type: 'short-input', value: 'x' } } }),
      },
    })
    expect(hasWorkflowChanged(a, b)).toBe(false)
  })

  it('ignores block position differences', () => {
    const a = mkState({ blocks: { b1: mkBlock({ position: { x: 0, y: 0 } }) } })
    const b = mkState({ blocks: { b1: mkBlock({ position: { x: 500, y: 500 } }) } })
    expect(hasWorkflowChanged(a, b)).toBe(false)
  })

  it('detects added edges', () => {
    const a = mkState({ edges: [] })
    const b = mkState({
      edges: [{ source: 's', target: 't', sourceHandle: null, targetHandle: null }],
    })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('detects reordered edges as equivalent (normalized sort)', () => {
    const e1 = { source: 'a', target: 'b', sourceHandle: 'h', targetHandle: null }
    const e2 = { source: 'b', target: 'c', sourceHandle: null, targetHandle: null }
    const a = mkState({ edges: [e1, e2] })
    const b = mkState({ edges: [e2, e1] })
    expect(hasWorkflowChanged(a, b)).toBe(false)
  })

  it('detects added blocks', () => {
    const a = mkState({ blocks: { b1: mkBlock() } })
    const b = mkState({ blocks: { b1: mkBlock(), b2: mkBlock({ id: 'b2' }) } })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('detects subBlock string value changes', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { field: { id: 'field', type: 'short-input', value: 'old' } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { field: { id: 'field', type: 'short-input', value: 'new' } } }),
      },
    })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('treats null and undefined subBlock values as equivalent', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { field: { id: 'field', type: 'short-input', value: null } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({
          subBlocks: { field: { id: 'field', type: 'short-input', value: undefined } },
        }),
      },
    })
    expect(hasWorkflowChanged(a, b)).toBe(false)
  })

  it('detects changes in loops', () => {
    const a = mkState({ loops: { loop1: { nodes: ['a'] } } })
    const b = mkState({ loops: { loop1: { nodes: ['a', 'b'] } } })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('detects removed loops', () => {
    const a = mkState({ loops: { loop1: { nodes: ['a'] } } })
    const b = mkState({ loops: {} })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('reports object subBlock value changes via normalized stringify', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { cfg: { id: 'cfg', type: 'code', value: { a: 1, b: 2 } } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { cfg: { id: 'cfg', type: 'code', value: { b: 2, a: 1 } } } }),
      },
    })
    // Object key order differs but normalizedStringify should treat them equal.
    expect(hasWorkflowChanged(a, b)).toBe(false)
  })

  it('detects property changes beyond the value', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { cfg: { id: 'cfg', type: 'code', value: 'x' } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({
          subBlocks: { cfg: { id: 'cfg', type: 'long-input', value: 'x' } },
        }),
      },
    })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })

  it('detects different subBlock counts per block', () => {
    const a = mkState({
      blocks: {
        b1: mkBlock({ subBlocks: { f1: { id: 'f1', type: 'short-input', value: '' } } }),
      },
    })
    const b = mkState({
      blocks: {
        b1: mkBlock({
          subBlocks: {
            f1: { id: 'f1', type: 'short-input', value: '' },
            f2: { id: 'f2', type: 'short-input', value: '' },
          },
        }),
      },
    })
    expect(hasWorkflowChanged(a, b)).toBe(true)
  })
})
