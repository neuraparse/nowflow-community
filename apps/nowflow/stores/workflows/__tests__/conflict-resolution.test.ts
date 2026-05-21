/**
 * Tests for workflow conflict-resolution merge strategies.
 * Covers: block merge (local-only, remote-only, sub-block merge, deletes),
 * edge merge, group merge, loop merge, precedence based on recent edits.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeWorkflowStates } from '@/stores/workflows/conflict-resolution'
import { hasRecentLocalChange } from '@/stores/workflows/subblock/store'
import type { BlockState, CustomEdge, GroupState, Loop } from '@/stores/workflows/workflow/types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/stores/workflows/subblock/store', () => ({
  hasRecentLocalChange: vi.fn(() => false),
}))

const makeBlock = (id: string, overrides: Partial<BlockState> = {}): BlockState => ({
  id,
  type: 'generic',
  name: `Block ${id}`,
  position: { x: 0, y: 0 },
  subBlocks: {},
  outputs: {},
  enabled: true,
  ...overrides,
})

const makeEdge = (id: string, source = 'a', target = 'b'): CustomEdge => ({
  id,
  source,
  target,
})

const makeGroup = (id: string, overrides: Partial<GroupState> = {}): GroupState => ({
  id,
  name: `Group ${id}`,
  nodeIds: [],
  createdAt: 0,
  ...overrides,
})

const makeLoop = (id: string, overrides: Partial<Loop> = {}): Loop => ({
  id,
  nodes: [],
  iterations: 1,
  loopType: 'for',
  ...overrides,
})

describe('mergeWorkflowStates - blocks', () => {
  beforeEach(() => {
    vi.mocked(hasRecentLocalChange).mockReset()
    vi.mocked(hasRecentLocalChange).mockReturnValue(false)
  })

  it('keeps local-only block when marked as localOnly', () => {
    const local = { a: makeBlock('a') }
    const localOnly = new Set(['a'])
    const result = mergeWorkflowStates(
      local,
      [],
      {},
      {},
      {},
      [],
      {},
      {},
      Date.now() - 10_000, // old edit
      undefined,
      localOnly
    )
    expect(result.blocks.a).toBeDefined()
    expect(result.conflicts[0]).toMatchObject({ id: 'a', resolution: 'local' })
  })

  it('keeps local-only block when recently edited', () => {
    const local = { a: makeBlock('a') }
    const result = mergeWorkflowStates(
      local,
      [],
      {},
      {},
      {},
      [],
      {},
      {},
      Date.now() - 100 // very recent
    )
    expect(result.blocks.a).toBeDefined()
    expect(result.conflicts[0].resolution).toBe('local')
  })

  it('accepts remote deletion when local edit is old and not localOnly', () => {
    const local = { a: makeBlock('a') }
    const result = mergeWorkflowStates(local, [], {}, {}, {}, [], {}, {}, Date.now() - 10_000)
    expect(result.blocks.a).toBeUndefined()
    expect(result.conflicts[0]).toMatchObject({ id: 'a', resolution: 'remote' })
  })

  it('accepts remote-only new block when no recent local edit', () => {
    const remote = { b: makeBlock('b') }
    const result = mergeWorkflowStates({}, [], {}, {}, remote, [], {}, {}, Date.now() - 10_000)
    expect(result.blocks.b).toBeDefined()
    expect(result.conflicts[0].resolution).toBe('remote')
  })

  it('treats remote-only block as local deletion when recently edited', () => {
    const remote = { b: makeBlock('b') }
    const result = mergeWorkflowStates({}, [], {}, {}, remote, [], {}, {}, Date.now() - 100)
    expect(result.blocks.b).toBeUndefined()
    expect(result.conflicts[0].resolution).toBe('local')
  })

  it('uses local block-level props when recently edited', () => {
    const local = {
      a: makeBlock('a', { name: 'Local', position: { x: 10, y: 10 } }),
    }
    const remote = {
      a: makeBlock('a', { name: 'Remote', position: { x: 20, y: 20 } }),
    }
    const result = mergeWorkflowStates(local, [], {}, {}, remote, [], {}, {}, Date.now() - 100)
    expect(result.blocks.a.name).toBe('Local')
    expect(result.blocks.a.position).toEqual({ x: 10, y: 10 })
    expect(result.conflicts[0].resolution).toBe('local')
  })

  it('uses remote block-level props when local edit is old', () => {
    const local = {
      a: makeBlock('a', { name: 'Local', position: { x: 10, y: 10 } }),
    }
    const remote = {
      a: makeBlock('a', { name: 'Remote', position: { x: 20, y: 20 } }),
    }
    const result = mergeWorkflowStates(local, [], {}, {}, remote, [], {}, {}, Date.now() - 10_000)
    expect(result.blocks.a.name).toBe('Remote')
    expect(result.conflicts[0].resolution).toBe('remote')
  })

  it('merges sub-blocks individually preferring recent local changes', () => {
    vi.mocked(hasRecentLocalChange).mockImplementation((_wf, _block, sub) => sub === 's1')

    const local = {
      a: makeBlock('a', {
        subBlocks: {
          s1: { id: 's1', type: 'short-input', value: 'local' },
          s2: { id: 's2', type: 'short-input', value: 'localS2' },
        },
      }),
    }
    const remote = {
      a: makeBlock('a', {
        subBlocks: {
          s1: { id: 's1', type: 'short-input', value: 'remote' },
          s2: { id: 's2', type: 'short-input', value: 'remoteS2' },
        },
      }),
    }
    const result = mergeWorkflowStates(
      local,
      [],
      {},
      {},
      remote,
      [],
      {},
      {},
      Date.now() - 10_000,
      undefined,
      undefined,
      'wf-1'
    )
    expect(result.blocks.a.subBlocks.s1.value).toBe('local')
    expect(result.blocks.a.subBlocks.s2.value).toBe('remoteS2')
    const blockConflict = result.conflicts.find((c) => c.id === 'a')
    expect(blockConflict?.resolution).toBe('merged')
  })

  it('keeps sub-blocks that only exist locally or remotely', () => {
    const local = {
      a: makeBlock('a', {
        subBlocks: {
          s1: { id: 's1', type: 'short-input', value: 'local-only' },
        },
      }),
    }
    const remote = {
      a: makeBlock('a', {
        subBlocks: {
          s2: { id: 's2', type: 'short-input', value: 'remote-only' },
        },
      }),
    }
    const result = mergeWorkflowStates(local, [], {}, {}, remote, [], {}, {}, Date.now() - 10_000)
    expect(result.blocks.a.subBlocks.s1.value).toBe('local-only')
    expect(result.blocks.a.subBlocks.s2.value).toBe('remote-only')
  })

  it('does not record a block conflict when blocks are identical', () => {
    const block = makeBlock('a')
    const result = mergeWorkflowStates(
      { a: block },
      [],
      {},
      {},
      { a: { ...block } },
      [],
      {},
      {},
      Date.now() - 10_000
    )
    expect(result.conflicts.filter((c) => c.type === 'block')).toHaveLength(0)
    expect(result.blocks.a).toBeDefined()
  })

  it('uses blockEditTimes per-block to determine recency', () => {
    // Block only exists locally
    const local = { a: makeBlock('a') }
    // Block's own edit time is recent, lastUserActionTime is old
    const result = mergeWorkflowStates(local, [], {}, {}, {}, [], {}, {}, Date.now() - 10_000, {
      a: Date.now() - 100,
    })
    expect(result.blocks.a).toBeDefined()
    expect(result.conflicts[0].resolution).toBe('local')
  })
})

describe('mergeWorkflowStates - edges', () => {
  beforeEach(() => {
    vi.mocked(hasRecentLocalChange).mockReset()
    vi.mocked(hasRecentLocalChange).mockReturnValue(false)
  })

  it('keeps new local edge when recently edited', () => {
    const local = [makeEdge('e1')]
    const result = mergeWorkflowStates({}, local, {}, {}, {}, [], {}, {}, Date.now() - 100)
    expect(result.edges).toHaveLength(1)
    const c = result.conflicts.find((c) => c.type === 'edge')
    expect(c?.resolution).toBe('local')
  })

  it('accepts remote deletion of local edge when no recent edit', () => {
    const local = [makeEdge('e1')]
    const result = mergeWorkflowStates({}, local, {}, {}, {}, [], {}, {}, Date.now() - 10_000)
    expect(result.edges).toHaveLength(0)
    const c = result.conflicts.find((c) => c.type === 'edge')
    expect(c?.resolution).toBe('remote')
  })

  it('accepts remote-only new edge when no recent edits', () => {
    const remote = [makeEdge('e1')]
    const result = mergeWorkflowStates({}, [], {}, {}, {}, remote, {}, {}, Date.now() - 10_000)
    expect(result.edges).toHaveLength(1)
    const c = result.conflicts.find((c) => c.type === 'edge')
    expect(c?.resolution).toBe('remote')
  })

  it('treats remote-only edge as locally deleted when connected node recently edited', () => {
    const remote = [makeEdge('e1', 'a', 'b')]
    const result = mergeWorkflowStates(
      {},
      [],
      {},
      {},
      {},
      remote,
      {},
      {},
      Date.now() - 100, // recent
      { a: Date.now() - 100 } // connected source recent
    )
    expect(result.edges).toHaveLength(0)
    const c = result.conflicts.find((c) => c.type === 'edge')
    expect(c?.resolution).toBe('local')
  })

  it('prefers remote edge modification when no recent edit', () => {
    const local = [{ ...makeEdge('e1'), label: 'local' }]
    const remote = [{ ...makeEdge('e1'), label: 'remote' }]
    const result = mergeWorkflowStates({}, local, {}, {}, {}, remote, {}, {}, Date.now() - 10_000)
    expect(result.edges[0].label).toBe('remote')
  })

  it('prefers local edge modification when recently edited', () => {
    const local = [{ ...makeEdge('e1'), label: 'local' }]
    const remote = [{ ...makeEdge('e1'), label: 'remote' }]
    const result = mergeWorkflowStates({}, local, {}, {}, {}, remote, {}, {}, Date.now() - 100)
    expect(result.edges[0].label).toBe('local')
  })

  it('does not record a conflict when edges are identical', () => {
    const edge = makeEdge('e1')
    const result = mergeWorkflowStates(
      {},
      [edge],
      {},
      {},
      {},
      [{ ...edge }],
      {},
      {},
      Date.now() - 10_000
    )
    expect(result.edges).toHaveLength(1)
    expect(result.conflicts.filter((c) => c.type === 'edge')).toHaveLength(0)
  })
})

describe('mergeWorkflowStates - groups', () => {
  it('keeps new local group when recently edited', () => {
    const local = { g1: makeGroup('g1') }
    const result = mergeWorkflowStates({}, [], local, {}, {}, [], {}, {}, Date.now() - 100)
    expect(result.groups.g1).toBeDefined()
    const c = result.conflicts.find((c) => c.type === 'group')
    expect(c?.resolution).toBe('local')
  })

  it('accepts remote deletion of local group when no recent edit', () => {
    const local = { g1: makeGroup('g1') }
    const result = mergeWorkflowStates({}, [], local, {}, {}, [], {}, {}, Date.now() - 10_000)
    expect(result.groups.g1).toBeUndefined()
  })

  it('accepts remote-only new group when no recent edit', () => {
    const remote = { g1: makeGroup('g1') }
    const result = mergeWorkflowStates({}, [], {}, {}, {}, [], remote, {}, Date.now() - 10_000)
    expect(result.groups.g1).toBeDefined()
  })

  it('treats remote-only group as locally deleted when recently edited', () => {
    const remote = { g1: makeGroup('g1') }
    const result = mergeWorkflowStates({}, [], {}, {}, {}, [], remote, {}, Date.now() - 100)
    expect(result.groups.g1).toBeUndefined()
  })

  it('prefers local group modifications when recently edited', () => {
    const local = { g1: makeGroup('g1', { name: 'Local' }) }
    const remote = { g1: makeGroup('g1', { name: 'Remote' }) }
    const result = mergeWorkflowStates({}, [], local, {}, {}, [], remote, {}, Date.now() - 100)
    expect(result.groups.g1.name).toBe('Local')
  })

  it('prefers remote group modifications when local edit is old', () => {
    const local = { g1: makeGroup('g1', { name: 'Local' }) }
    const remote = { g1: makeGroup('g1', { name: 'Remote' }) }
    const result = mergeWorkflowStates({}, [], local, {}, {}, [], remote, {}, Date.now() - 10_000)
    expect(result.groups.g1.name).toBe('Remote')
  })

  it('does not record conflict for identical groups', () => {
    const group = makeGroup('g1')
    const result = mergeWorkflowStates(
      {},
      [],
      { g1: group },
      {},
      {},
      [],
      { g1: { ...group } },
      {},
      Date.now() - 10_000
    )
    expect(result.conflicts.filter((c) => c.type === 'group')).toHaveLength(0)
  })
})

describe('mergeWorkflowStates - loops', () => {
  it('keeps new local loop when recently edited', () => {
    const local = { l1: makeLoop('l1') }
    const result = mergeWorkflowStates({}, [], {}, local, {}, [], {}, {}, Date.now() - 100)
    expect(result.loops.l1).toBeDefined()
  })

  it('accepts remote loop deletion when no recent edit', () => {
    const local = { l1: makeLoop('l1') }
    const result = mergeWorkflowStates({}, [], {}, local, {}, [], {}, {}, Date.now() - 10_000)
    expect(result.loops.l1).toBeUndefined()
  })

  it('accepts remote-only new loop when no recent edit', () => {
    const remote = { l1: makeLoop('l1') }
    const result = mergeWorkflowStates({}, [], {}, {}, {}, [], {}, remote, Date.now() - 10_000)
    expect(result.loops.l1).toBeDefined()
  })

  it('treats remote-only loop as locally deleted when recently edited', () => {
    const remote = { l1: makeLoop('l1') }
    const result = mergeWorkflowStates({}, [], {}, {}, {}, [], {}, remote, Date.now() - 100)
    expect(result.loops.l1).toBeUndefined()
  })

  it('prefers local loop nodes when recently edited', () => {
    const local = { l1: makeLoop('l1', { nodes: ['n1'] }) }
    const remote = { l1: makeLoop('l1', { nodes: ['n2'] }) }
    const result = mergeWorkflowStates({}, [], {}, local, {}, [], {}, remote, Date.now() - 100)
    expect(result.loops.l1.nodes).toEqual(['n1'])
  })

  it('prefers remote loop nodes when local edit is old', () => {
    const local = { l1: makeLoop('l1', { nodes: ['n1'] }) }
    const remote = { l1: makeLoop('l1', { nodes: ['n2'] }) }
    const result = mergeWorkflowStates({}, [], {}, local, {}, [], {}, remote, Date.now() - 10_000)
    expect(result.loops.l1.nodes).toEqual(['n2'])
  })

  it('does not record conflict for identical loops', () => {
    const loop = makeLoop('l1')
    const result = mergeWorkflowStates(
      {},
      [],
      {},
      { l1: loop },
      {},
      [],
      {},
      { l1: { ...loop } },
      Date.now() - 10_000
    )
    expect(result.conflicts.filter((c) => c.type === 'loop')).toHaveLength(0)
  })
})
