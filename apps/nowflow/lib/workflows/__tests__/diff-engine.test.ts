import { describe, expect, it, vi } from 'vitest'
import {
  computeWorkflowDiff,
  generateDetailedChanges,
  generateDiffSummary,
} from '@/lib/workflows/diff-engine'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const blockObj = (overrides: Record<string, any> = {}) => ({
  name: 'Step',
  type: 'function',
  subBlocks: {},
  ...overrides,
})

describe('computeWorkflowDiff', () => {
  it('returns zeroed metadata for empty states', () => {
    const diff = computeWorkflowDiff({}, {})
    expect(diff.metadata).toEqual({
      fromBlockCount: 0,
      toBlockCount: 0,
      fromEdgeCount: 0,
      toEdgeCount: 0,
    })
    expect(diff.blocks.added).toEqual([])
    expect(diff.blocks.removed).toEqual([])
    expect(diff.blocks.modified).toEqual([])
    expect(diff.edges.added).toEqual([])
    expect(diff.edges.removed).toEqual([])
  })

  it('parses stringified states transparently', () => {
    const from = JSON.stringify({ blocks: {}, edges: [] })
    const to = JSON.stringify({ blocks: { a: blockObj({ type: 'agent' }) }, edges: [] })
    const diff = computeWorkflowDiff(from, to)
    expect(diff.metadata.toBlockCount).toBe(1)
    expect(diff.blocks.added).toHaveLength(1)
    expect(diff.blocks.added[0].id).toBe('a')
    expect(diff.blocks.added[0].type).toBe('agent')
  })

  it('detects added and removed blocks', () => {
    const from = { blocks: { keep: blockObj(), drop: blockObj({ type: 'api' }) } }
    const to = { blocks: { keep: blockObj(), fresh: blockObj({ type: 'agent' }) } }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.blocks.added.map((b) => b.id)).toEqual(['fresh'])
    expect(diff.blocks.removed.map((b) => b.id)).toEqual(['drop'])
    expect(diff.blocks.modified).toEqual([])
  })

  it('detects modified top-level properties', () => {
    const from = {
      blocks: { b1: blockObj({ name: 'Old', data: { foo: 1 } }) },
    }
    const to = {
      blocks: { b1: blockObj({ name: 'New', data: { foo: 2 } }) },
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.blocks.modified).toHaveLength(1)
    const [mod] = diff.blocks.modified
    expect(mod.id).toBe('b1')
    const paths = mod.changes.map((c) => c.path)
    expect(paths).toContain('name')
    expect(paths).toContain('data')
  })

  it('detects subBlock value changes', () => {
    const from = {
      blocks: {
        b1: blockObj({ subBlocks: { url: { value: 'http://a' } } }),
      },
    }
    const to = {
      blocks: {
        b1: blockObj({ subBlocks: { url: { value: 'http://b' } } }),
      },
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.blocks.modified).toHaveLength(1)
    const change = diff.blocks.modified[0].changes.find((c) => c.path === 'subBlocks.url')
    expect(change).toBeTruthy()
    expect(change?.from).toBe('http://a')
    expect(change?.to).toBe('http://b')
  })

  it('detects added and removed edges', () => {
    const from = {
      blocks: {},
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    }
    const to = {
      blocks: {},
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e3', source: 'a', target: 'c' },
      ],
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.edges.added.map((e) => e.id)).toEqual(['e3'])
    expect(diff.edges.removed.map((e) => e.id)).toEqual(['e2'])
  })

  it('falls back to source-target composite id when edge id missing', () => {
    const from = { blocks: {}, edges: [] }
    const to = {
      blocks: {},
      edges: [{ source: 'x', target: 'y' }],
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.edges.added).toHaveLength(1)
    expect(diff.edges.added[0].id).toBe('x-y')
  })

  it('handles loops added, removed, and modified', () => {
    const from = {
      blocks: {},
      loops: {
        l1: { nodes: ['a', 'b'] },
        l2: { nodes: ['c'] },
      },
    }
    const to = {
      blocks: {},
      loops: {
        l1: { nodes: ['a', 'b', 'c'] }, // modified
        l3: { nodes: ['x'] }, // added
      },
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.loops.added).toEqual(['l3'])
    expect(diff.loops.removed).toEqual(['l2'])
    expect(diff.loops.modified).toEqual(['l1'])
  })

  it('swallows parse errors and returns an empty diff', () => {
    const diff = computeWorkflowDiff('{not valid json', '{}')
    expect(diff.blocks.added).toEqual([])
    expect(diff.blocks.removed).toEqual([])
    expect(diff.edges.added).toEqual([])
  })

  it('derives block type from metadata.id when type missing', () => {
    const from = { blocks: {} }
    const to = {
      blocks: {
        b1: { name: 'Thing', metadata: { id: 'special-block', name: 'Thing' }, subBlocks: {} },
      },
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.blocks.added[0].type).toBe('special-block')
  })

  it('supports block state provided as an array', () => {
    const from = { blocks: [] }
    const to = {
      blocks: [{ id: 'x', type: 'agent', name: 'x', subBlocks: {} }],
    }
    const diff = computeWorkflowDiff(from, to)
    expect(diff.metadata.toBlockCount).toBe(1)
    expect(diff.blocks.added[0].id).toBe('x')
  })
})

describe('generateDiffSummary', () => {
  it('returns "No changes detected" when diff is empty', () => {
    const diff = computeWorkflowDiff({}, {})
    expect(generateDiffSummary(diff)).toBe('No changes detected')
  })

  it('joins parts with commas', () => {
    const diff = computeWorkflowDiff(
      { blocks: { a: blockObj() }, edges: [] },
      { blocks: { b: blockObj() }, edges: [{ id: 'e', source: 'b', target: 'b' }] }
    )
    const summary = generateDiffSummary(diff)
    expect(summary).toContain('Added 1 block(s)')
    expect(summary).toContain('Removed 1 block(s)')
    expect(summary).toContain('Added 1 connection(s)')
    expect(summary.split(', ').length).toBeGreaterThanOrEqual(3)
  })

  it('reports loop additions and removals', () => {
    const diff = computeWorkflowDiff({ loops: { old: {} } }, { loops: { fresh: {} } })
    const summary = generateDiffSummary(diff)
    expect(summary).toContain('Added 1 loop(s)')
    expect(summary).toContain('Removed 1 loop(s)')
  })
})

describe('generateDetailedChanges', () => {
  it('produces bullet-style strings for each change type', () => {
    const diff = computeWorkflowDiff(
      {
        blocks: {
          keep: blockObj({ name: 'K' }),
          drop: blockObj({ type: 'api', name: 'D' }),
        },
        edges: [{ id: 'e1', source: 'keep', target: 'drop' }],
      },
      {
        blocks: {
          keep: blockObj({ name: 'K2' }),
          fresh: blockObj({ type: 'agent', name: 'F' }),
        },
        edges: [],
      }
    )
    const lines = generateDetailedChanges(diff)
    expect(lines.some((l) => l.includes('Added agent block "F"'))).toBe(true)
    expect(lines.some((l) => l.includes('Removed api block "D"'))).toBe(true)
    expect(lines.some((l) => l.includes('Modified'))).toBe(true)
    expect(lines.some((l) => l.includes('Removed 1 connection'))).toBe(true)
  })

  it('returns an empty array when diff has no changes', () => {
    const diff = computeWorkflowDiff({}, {})
    expect(generateDetailedChanges(diff)).toEqual([])
  })
})
