/**
 * Tests for workflow common optimizations helpers.
 * Covers: LRUCache, cleanEdges, calculateLoops + cache, clearLoopCache,
 *         batchStateUpdates, memoize, deepClone, shallowMerge, shallowEqual,
 *         arrayDifference/Intersection/Union, groupBy, chunk, updater factories,
 *         batch updaters/deleter, createDebouncer, createThrottler,
 *         validateAndCleanGroups, batchUpdateGroups.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  arrayDifference,
  arrayIntersection,
  arrayUnion,
  batchStateUpdates,
  batchUpdateGroups,
  calculateLoops,
  chunk,
  cleanEdges,
  clearLoopCache,
  createBatchBlockDeleter,
  createBatchBlockUpdater,
  createBatchEdgeUpdater,
  createBlockUpdater,
  createDebouncer,
  createEdgeUpdater,
  createLoopUpdater,
  createThrottler,
  deepClone,
  groupBy,
  LRUCache,
  memoize,
  shallowEqual,
  shallowMerge,
  validateAndCleanGroups,
} from '@/stores/workflows/common/optimizations'
import { detectCycle } from '@/stores/workflows/workflow/utils'

vi.mock('@/lib/utils', () => ({
  generateUUID: vi.fn(() => 'uuid-fixed'),
}))

vi.mock('@/stores/workflows/workflow/utils', () => ({
  detectCycle: vi.fn(() => ({ hasCycle: false, paths: [] })),
}))

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(3)
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
    expect(cache.has('a')).toBe(true)
    expect(cache.size).toBe(1)
  })

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(3)
    expect(cache.get('nope')).toBeUndefined()
  })

  it('evicts the oldest entry when over capacity', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.has('c')).toBe(true)
    expect(cache.size).toBe(2)
  })

  it('promotes recently read entries (LRU)', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // promote a
    cache.set('c', 3) // evict b
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })

  it('updates an existing key without growing size', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('a', 2)
    expect(cache.size).toBe(1)
    expect(cache.get('a')).toBe(2)
  })

  it('clears the cache', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.has('a')).toBe(false)
  })
})

describe('cleanEdges', () => {
  it('returns empty array when edges or blocks are empty', () => {
    expect(cleanEdges([], { a: {} })).toEqual([])
    expect(cleanEdges([{ id: 'e', source: 'a', target: 'b' } as any], {})).toEqual([])
  })

  it('filters edges referencing non-existent blocks', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'missing' },
    ] as any[]
    const result = cleanEdges(edges, { a: {}, b: {} })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('e1')
  })

  it('normalizes default source/target handles', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: null, targetHandle: null },
    ] as any[]
    const result = cleanEdges(edges, { a: {}, b: {} })
    expect(result[0].sourceHandle).toBe('source')
    expect(result[0].targetHandle).toBe('target')
  })

  it('deduplicates edges with the same source/target/handles', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
    ] as any[]
    const result = cleanEdges(edges, { a: {}, b: {} })
    expect(result).toHaveLength(1)
  })

  it('keeps edges between same nodes with different handles', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
      { id: 'e2', source: 'a', target: 'b', sourceHandle: 'condition-1', targetHandle: 'target' },
    ] as any[]
    const result = cleanEdges(edges, { a: {}, b: {} })
    expect(result).toHaveLength(2)
  })

  it('skips falsy entries in the edge array', () => {
    const edges = [null, { id: 'e1', source: 'a', target: 'b' }] as any[]
    expect(cleanEdges(edges, { a: {}, b: {} })).toHaveLength(1)
  })
})

describe('calculateLoops + clearLoopCache', () => {
  beforeEach(() => {
    clearLoopCache()
    ;(detectCycle as any).mockReset()
  })

  it('returns an empty object when no cycles are detected', () => {
    ;(detectCycle as any).mockReturnValue({ hasCycle: false, paths: [] })
    const result = calculateLoops([{ source: 'a', target: 'b' } as any], {})
    expect(result).toEqual({})
  })

  it('creates a new loop for each discovered cycle path', () => {
    ;(detectCycle as any).mockImplementation((_edges: any, node: string) =>
      node === 'a' ? { hasCycle: true, paths: [['a', 'b']] } : { hasCycle: false, paths: [] }
    )
    const result = calculateLoops([{ source: 'a', target: 'b' } as any], {})
    const values = Object.values(result)
    expect(values).toHaveLength(1)
    expect(values[0].nodes).toEqual(['a', 'b'])
    expect(values[0].iterations).toBe(5)
    expect(values[0].loopType).toBe('for')
  })

  it('preserves existing loop properties when the path matches', () => {
    ;(detectCycle as any).mockImplementation((_edges: any, node: string) =>
      node === 'a' ? { hasCycle: true, paths: [['a', 'b']] } : { hasCycle: false, paths: [] }
    )
    const existing = {
      loop1: { id: 'loop1', nodes: ['b', 'a'], iterations: 42, loopType: 'forEach' as const },
    }
    const result = calculateLoops([{ source: 'a', target: 'b' } as any], existing)
    expect(result.loop1).toBeDefined()
    expect(result.loop1.iterations).toBe(42)
    expect(result.loop1.nodes).toEqual(['a', 'b']) // updated order from detection
  })

  it('caches the result by edge signature', () => {
    ;(detectCycle as any).mockReturnValue({ hasCycle: false, paths: [] })
    const edges = [{ source: 'a', target: 'b' } as any]
    calculateLoops(edges, {})
    calculateLoops(edges, {})
    expect((detectCycle as any).mock.calls.length).toBe(1)
  })

  it('clearLoopCache invalidates the cache', () => {
    ;(detectCycle as any).mockReturnValue({ hasCycle: false, paths: [] })
    const edges = [{ source: 'a', target: 'b' } as any]
    calculateLoops(edges, {})
    clearLoopCache()
    calculateLoops(edges, {})
    expect((detectCycle as any).mock.calls.length).toBe(2)
  })
})

describe('batchStateUpdates', () => {
  it('executes all update functions and returns results', () => {
    const results = batchStateUpdates([() => 1, () => 2, () => 3])
    expect(results).toEqual([1, 2, 3])
  })

  it('invokes callback with results when provided', () => {
    const cb = vi.fn()
    batchStateUpdates([() => 'x'], cb)
    expect(cb).toHaveBeenCalledWith(['x'])
  })
})

describe('memoize', () => {
  it('caches by stringified arguments', () => {
    const spy = vi.fn((n: number) => n * 2)
    const memoed = memoize(spy)
    expect(memoed(3)).toBe(6)
    expect(memoed(3)).toBe(6)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('accepts a custom key generator', () => {
    const spy = vi.fn((a: { id: string }) => a.id.toUpperCase())
    const memoed = memoize(spy, (a) => a.id)
    memoed({ id: 'x' })
    memoed({ id: 'x' })
    memoed({ id: 'y' })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('deepClone', () => {
  it('returns primitives unchanged', () => {
    expect(deepClone(42)).toBe(42)
    expect(deepClone('s')).toBe('s')
    expect(deepClone(null)).toBeNull()
  })

  it('clones dates', () => {
    const d = new Date('2024-01-01')
    const cloned = deepClone(d)
    expect(cloned).not.toBe(d)
    expect((cloned as Date).getTime()).toBe(d.getTime())
  })

  it('clones arrays deeply', () => {
    const src = [{ a: 1 }, { b: 2 }]
    const cloned = deepClone(src)
    expect(cloned).toEqual(src)
    expect(cloned).not.toBe(src)
    expect(cloned[0]).not.toBe(src[0])
  })

  it('clones plain objects deeply', () => {
    const src = { a: { b: { c: 1 } } }
    const cloned = deepClone(src)
    expect(cloned).toEqual(src)
    expect(cloned.a).not.toBe(src.a)
  })

  it('clones Sets and Maps', () => {
    const s = new Set([1, 2])
    const m = new Map<string, any>([['k', { v: 1 }]])
    const cs = deepClone(s)
    const cm = deepClone(m)
    expect(cs).toEqual(s)
    expect(cs).not.toBe(s)
    expect(cm.get('k')).toEqual({ v: 1 })
    expect(cm.get('k')).not.toBe(m.get('k'))
  })
})

describe('shallowMerge / shallowEqual', () => {
  it('merges multiple sources into a new object', () => {
    const result = shallowMerge({ a: 1, b: 2 }, { b: 3 }, { c: 4 } as any)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('shallowEqual returns true for the same reference', () => {
    const obj = { a: 1 }
    expect(shallowEqual(obj, obj)).toBe(true)
  })

  it('shallowEqual returns true for objects with the same keys/values', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
  })

  it('shallowEqual returns false when keys differ', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('shallowEqual returns false when any value differs', () => {
    expect(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false)
  })

  it('shallowEqual handles non-object inputs', () => {
    expect(shallowEqual(null, {})).toBe(false)
    expect(shallowEqual({}, null)).toBe(false)
    expect(shallowEqual(null, null)).toBe(true)
  })
})

describe('array helpers', () => {
  it('arrayDifference returns items only in the first array', () => {
    expect(arrayDifference([1, 2, 3], [2, 4])).toEqual([1, 3])
  })

  it('arrayIntersection returns items present in both', () => {
    expect(arrayIntersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3])
  })

  it('arrayUnion returns unique items from both arrays', () => {
    expect(arrayUnion([1, 2], [2, 3]).sort()).toEqual([1, 2, 3])
  })
})

describe('groupBy / chunk', () => {
  it('groups items by key', () => {
    const grouped = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'))
    expect(grouped.even).toEqual([2, 4])
    expect(grouped.odd).toEqual([1, 3])
  })

  it('chunks an array into equal-sized parts', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})

describe('block/edge/loop updater factories', () => {
  it('createBlockUpdater merges updates with existing block', () => {
    const get = () => ({
      blocks: { a: { id: 'a', name: 'A' } },
      edges: [{ id: 'e' }],
      loops: { l: {} },
    })
    const updater = createBlockUpdater(vi.fn(), get)
    const result = updater('a', { name: 'Updated' })
    expect(result!.blocks.a.name).toBe('Updated')
    expect(result!.edges).toHaveLength(1)
    expect(result!.loops).toEqual({ l: {} })
  })

  it('createBlockUpdater returns null for unknown block ids', () => {
    const updater = createBlockUpdater(vi.fn(), () => ({ blocks: {}, edges: [], loops: {} }))
    expect(updater('missing', { name: 'x' })).toBeNull()
  })

  it('createEdgeUpdater updates only the matching edge', () => {
    const get = () => ({
      blocks: { a: {} },
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
      loops: {},
    })
    const updater = createEdgeUpdater(vi.fn(), get)
    const result = updater('e1', { source: 'Z' })
    expect(result.edges[0].source).toBe('Z')
    expect(result.edges[1].source).toBe('a')
  })

  it('createLoopUpdater returns null for unknown loop ids', () => {
    const updater = createLoopUpdater(vi.fn(), () => ({ loops: {}, blocks: {}, edges: [] }))
    expect(updater('missing', {})).toBeNull()
  })

  it('createLoopUpdater updates matching loop', () => {
    const get = () => ({
      loops: { l1: { id: 'l1', iterations: 1 } },
      blocks: {},
      edges: [],
    })
    const updater = createLoopUpdater(vi.fn(), get)
    const result = updater('l1', { iterations: 10 })
    expect(result!.loops.l1.iterations).toBe(10)
  })
})

describe('batch updaters and deleter', () => {
  it('createBatchBlockUpdater returns null for empty updates', () => {
    const updater = createBatchBlockUpdater(vi.fn(), () => ({ blocks: {}, edges: [], loops: {} }))
    expect(updater([])).toBeNull()
  })

  it('createBatchBlockUpdater applies changes to matching blocks only', () => {
    const get = () => ({
      blocks: { a: { id: 'a', n: 1 }, b: { id: 'b', n: 2 } },
      edges: [],
      loops: {},
    })
    const updater = createBatchBlockUpdater(vi.fn(), get)
    const result = updater([
      { id: 'a', changes: { n: 10 } },
      { id: 'missing', changes: { n: 99 } },
    ])
    expect(result!.blocks.a.n).toBe(10)
    expect(result!.blocks.b.n).toBe(2)
    expect(result!.blocks.missing).toBeUndefined()
  })

  it('createBatchEdgeUpdater applies changes to matching edges only', () => {
    const get = () => ({
      blocks: {},
      edges: [
        { id: 'e1', v: 1 },
        { id: 'e2', v: 2 },
      ],
      loops: {},
    })
    const updater = createBatchEdgeUpdater(vi.fn(), get)
    const result = updater([{ id: 'e1', changes: { v: 10 } }])
    expect(result!.edges[0].v).toBe(10)
    expect(result!.edges[1].v).toBe(2)
  })

  it('createBatchBlockDeleter removes blocks, edges, loops, and groups correctly', () => {
    const get = () => ({
      blocks: { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } },
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
      loops: {
        l1: { id: 'l1', nodes: ['a', 'b'] },
        l2: { id: 'l2', nodes: ['b', 'c'] },
      },
      groups: {
        g1: { id: 'g1', nodeIds: ['a', 'b'] },
        g2: { id: 'g2', nodeIds: ['b', 'c'] },
      },
    })
    const deleter = createBatchBlockDeleter(vi.fn(), get)
    const result = deleter(['a', 'b'])
    expect(result!.blocks).toEqual({ c: { id: 'c' } })
    expect(result!.edges).toHaveLength(0)
    // l1 had only a,b → removed; l2 keeps only c
    expect(result!.loops.l1).toBeUndefined()
    expect(result!.loops.l2.nodes).toEqual(['c'])
    // Groups with <=1 remaining nodes are removed
    expect(result!.groups.g1).toBeUndefined()
    expect(result!.groups.g2).toBeUndefined()
  })

  it('createBatchBlockDeleter returns null for empty input', () => {
    const deleter = createBatchBlockDeleter(
      vi.fn(),
      () => ({ blocks: {}, edges: [], loops: {}, groups: {} }) as any
    )
    expect(deleter([])).toBeNull()
  })
})

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes the callback only after the delay', () => {
    const debounce = createDebouncer(100)
    const cb = vi.fn()
    debounce(cb)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(99)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on successive calls', () => {
    const debounce = createDebouncer(100)
    const cb = vi.fn()
    debounce(cb)
    vi.advanceTimersByTime(50)
    debounce(cb)
    vi.advanceTimersByTime(50)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('createThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Throttler compares Date.now() vs lastCall (initial 0);
    // start well past the delay window so the first call fires immediately.
    vi.setSystemTime(new Date(1_000_000))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes the callback immediately on first call', () => {
    const throttle = createThrottler(100)
    const cb = vi.fn()
    throttle(cb)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('defers subsequent calls within the window', () => {
    const throttle = createThrottler(100)
    const cb = vi.fn()
    throttle(cb) // fires immediately
    throttle(cb) // deferred
    expect(cb).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('validateAndCleanGroups', () => {
  it('drops groups whose valid nodes are fewer than 2', () => {
    const groups = {
      g1: { nodeIds: ['a', 'b'] },
      g2: { nodeIds: ['missing1', 'missing2'] },
      g3: { nodeIds: ['a'] },
    }
    const blocks = { a: {}, b: {} }
    const cleaned = validateAndCleanGroups(groups as any, blocks as any)
    expect(cleaned.g1).toBeDefined()
    expect(cleaned.g2).toBeUndefined()
    expect(cleaned.g3).toBeUndefined()
  })

  it('keeps only nodes that still exist', () => {
    const groups = { g1: { nodeIds: ['a', 'missing', 'b'] } }
    const blocks = { a: {}, b: {} }
    const cleaned = validateAndCleanGroups(groups as any, blocks as any)
    expect(cleaned.g1.nodeIds).toEqual(['a', 'b'])
  })

  it('handles missing nodeIds gracefully', () => {
    const cleaned = validateAndCleanGroups({ g1: {} } as any, {} as any)
    expect(cleaned.g1).toBeUndefined()
  })
})

describe('batchUpdateGroups', () => {
  it('applies updates to matching groups only', () => {
    const groups = { g1: { name: 'a' }, g2: { name: 'b' } }
    const result = batchUpdateGroups(groups as any, [
      { groupId: 'g1', changes: { name: 'A!' } },
      { groupId: 'missing', changes: { name: 'ignored' } },
    ])
    expect(result.g1.name).toBe('A!')
    expect(result.g2.name).toBe('b')
    expect(result.missing).toBeUndefined()
  })
})
