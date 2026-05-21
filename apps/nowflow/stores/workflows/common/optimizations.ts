/**
 * Performance optimization utilities for workflow operations
 * Implements caching, memoization, and efficient data structures
 *
 * @module stores/workflows/common/optimizations
 */
import { Edge } from '@xyflow/react'
import { generateUUID } from '@/lib/utils'
import { Loop } from '../workflow/types'
import { detectCycle } from '../workflow/utils'

/**
 * LRU Cache implementation for performance optimization
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Add to end
    this.cache.set(key, value)

    // Remove oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Global loop calculation cache
 */
const loopCalculationCache = new LRUCache<string, Record<string, Loop>>(100)

function normalizeHandle(value: any, role: 'source' | 'target'): string {
  const fallback = role === 'source' ? 'source' : 'target'
  if (value === undefined || value === null || value === '') return fallback
  const normalized = String(value).toLowerCase().trim()
  if (role === 'source') {
    if (normalized === 'output' || normalized === 'source') return 'source'
  } else {
    if (normalized === 'input' || normalized === 'target') return 'target'
  }
  return String(value)
}

/**
 * Clean edges to ensure they only reference existing blocks
 * Optimized with early returns and Set lookup
 */
export function cleanEdges(edges: Edge[], blocks: Record<string, any>): Edge[] {
  if (!edges || edges.length === 0) return []
  if (!blocks || Object.keys(blocks).length === 0) return []

  const seenIds = new Set<string>()
  const seenPairs = new Set<string>()
  const dedupedEdges = edges.filter((edge) => {
    if (!edge) return false
    const sourceHandle = normalizeHandle(edge.sourceHandle, 'source')
    const targetHandle = normalizeHandle(edge.targetHandle, 'target')
    edge.sourceHandle = sourceHandle
    edge.targetHandle = targetHandle

    let id = edge.id || `edge-${edge.source}-${edge.target}`
    let idKey = String(id)
    const pairKey = `${edge.source}::${edge.target}::${sourceHandle}::${targetHandle}`

    if (seenIds.has(idKey) && !seenPairs.has(pairKey)) {
      id = `${idKey}-${sourceHandle}-${targetHandle}`
      idKey = id
    }

    if (seenIds.has(idKey) || seenPairs.has(pairKey)) return false
    seenIds.add(idKey)
    seenPairs.add(pairKey)
    edge.id = id
    return true
  })

  const validBlockIds = new Set(Object.keys(blocks))
  return dedupedEdges.filter((edge) => {
    // Early return for invalid edges
    if (!edge?.source || !edge?.target) return false
    // O(1) Set lookup instead of O(n) array search
    return validBlockIds.has(edge.source) && validBlockIds.has(edge.target)
  })
}

/**
 * Memoized loop calculation to avoid redundant cycle detection
 * Uses canonical path representation for deduplication
 */
export function calculateLoops(
  edges: Edge[],
  existingLoops: Record<string, Loop>
): Record<string, Loop> {
  // Create cache key from edges
  const cacheKey = edges
    .map((e) => `${e.source}-${e.target}`)
    .sort()
    .join('|')

  // Check cache first
  if (loopCalculationCache.has(cacheKey)) {
    return loopCalculationCache.get(cacheKey)!
  }

  const newLoops: Record<string, Loop> = {}
  const processedPaths = new Set<string>()

  // Check for cycles from each unique source node
  const sourceNodes = new Set(edges.map((e) => e.source))

  sourceNodes.forEach((node) => {
    const { paths } = detectCycle(edges, node)

    paths.forEach((path) => {
      // Create canonical path for deduplication
      const canonicalPath = [...path].sort().join(',')

      if (!processedPaths.has(canonicalPath)) {
        processedPaths.add(canonicalPath)

        // Find existing loop with same path
        const existingLoop = Object.values(existingLoops).find((loop) => {
          const loopCanonicalPath = [...loop.nodes].sort().join(',')
          return loopCanonicalPath === canonicalPath
        })

        if (existingLoop) {
          // Preserve existing loop properties
          newLoops[existingLoop.id] = {
            ...existingLoop,
            nodes: path,
          }
        } else {
          // Create new loop with defaults
          const loopId = generateUUID()
          newLoops[loopId] = {
            id: loopId,
            nodes: path,
            iterations: 5,
            loopType: 'for',
          }
        }
      }
    })
  })

  // Cache the result
  loopCalculationCache.set(cacheKey, newLoops)

  return newLoops
}

/**
 * Clear loop calculation cache
 * Useful when workflow structure changes significantly
 */
export function clearLoopCache(): void {
  loopCalculationCache.clear()
}

/**
 * Batch state updates to reduce re-renders
 */
export function batchStateUpdates<T>(
  updates: Array<() => T>,
  callback?: (results: T[]) => void
): T[] {
  const results: T[] = []

  // Execute all updates
  for (const update of updates) {
    results.push(update())
  }

  // Call callback with all results
  if (callback) {
    callback(results)
  }

  return results
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)

    return result
  }) as T
}

/**
 * Deep clone object efficiently
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map((item) => deepClone(item))) as any
  }

  if (obj instanceof Map) {
    return new Map(
      Array.from(obj.entries()).map(([key, value]) => [deepClone(key), deepClone(value)])
    ) as any
  }

  const clonedObj = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key])
    }
  }

  return clonedObj
}

/**
 * Shallow merge objects efficiently
 */
export function shallowMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target }

  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        result[key] = source[key] as T[Extract<keyof T, string>]
      }
    }
  }

  return result
}

/**
 * Check if two objects are shallowly equal
 */
export function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true
  }

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false
    }
  }

  return true
}

/**
 * Optimized array difference
 */
export function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2)
  return arr1.filter((item) => !set2.has(item))
}

/**
 * Optimized array intersection
 */
export function arrayIntersection<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2)
  return arr1.filter((item) => set2.has(item))
}

/**
 * Optimized array union
 */
export function arrayUnion<T>(arr1: T[], arr2: T[]): T[] {
  return Array.from(new Set([...arr1, ...arr2]))
}

/**
 * Group array items by key
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>

  for (const item of array) {
    const key = keyFn(item)
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(item)
  }

  return result
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }

  return chunks
}

/**
 * Creates a block updater function
 */
export function createBlockUpdater(_safeSet: (partial: any) => void, get: () => any) {
  return <K extends keyof any>(
    blockId: string,
    updates: Record<K, any>,
    preserveState: boolean = true
  ) => {
    const currentBlock = get().blocks[blockId]
    if (!currentBlock) return null

    const newState = {
      blocks: {
        ...get().blocks,
        [blockId]: {
          ...currentBlock,
          ...updates,
        },
      },
      ...(preserveState && {
        edges: [...get().edges],
        loops: { ...get().loops },
      }),
    }

    return newState
  }
}

/**
 * Creates an edge updater function
 */
export function createEdgeUpdater(_safeSet: (partial: any) => void, get: () => any) {
  return <K extends keyof any>(
    edgeId: string,
    updates: Record<K, any>,
    preserveState: boolean = true
  ) => {
    const newEdges = get().edges.map((edge: any) =>
      edge.id === edgeId ? { ...edge, ...updates } : edge
    )

    const newState = {
      edges: newEdges,
      ...(preserveState && {
        blocks: { ...get().blocks },
        loops: { ...get().loops },
      }),
    }

    return newState
  }
}

/**
 * Creates a loop updater function
 */
export function createLoopUpdater(_safeSet: (partial: any) => void, get: () => any) {
  return <K extends keyof any>(
    loopId: string,
    updates: Record<K, any>,
    preserveState: boolean = true
  ) => {
    const currentLoop = get().loops[loopId]
    if (!currentLoop) return null

    const newState = {
      loops: {
        ...get().loops,
        [loopId]: {
          ...currentLoop,
          ...updates,
        },
      },
      ...(preserveState && {
        blocks: { ...get().blocks },
        edges: [...get().edges],
      }),
    }

    return newState
  }
}

/**
 * Creates a batch update function for blocks
 */
export function createBatchBlockUpdater(_safeSet: (partial: any) => void, get: () => any) {
  return (updates: Array<{ id: string; changes: Record<string, any> }>) => {
    if (!updates || updates.length === 0) return null

    const newBlocks = { ...get().blocks }

    updates.forEach(({ id, changes }) => {
      if (newBlocks[id]) {
        newBlocks[id] = {
          ...newBlocks[id],
          ...changes,
        }
      }
    })

    return {
      blocks: newBlocks,
      edges: [...get().edges],
      loops: { ...get().loops },
    }
  }
}

/**
 * Creates a batch update function for edges
 */
export function createBatchEdgeUpdater(_safeSet: (partial: any) => void, get: () => any) {
  return (updates: Array<{ id: string; changes: Record<string, any> }>) => {
    if (!updates || updates.length === 0) return null

    const newEdges = get().edges.map((edge: any) => {
      const update = updates.find((u) => u.id === edge.id)
      return update ? { ...edge, ...update.changes } : edge
    })

    return {
      blocks: { ...get().blocks },
      edges: newEdges,
      loops: { ...get().loops },
    }
  }
}

/**
 * Creates a batch delete function for blocks with loop and group cleanup
 */
export function createBatchBlockDeleter(_safeSet: (partial: any) => void, get: () => any) {
  return (blockIds: string[]) => {
    if (!blockIds || blockIds.length === 0) return null

    const blockIdsSet = new Set(blockIds)
    const newBlocks = { ...get().blocks }

    // Remove blocks
    blockIds.forEach((id) => {
      delete newBlocks[id]
    })

    // Remove edges connected to deleted blocks
    const newEdges = get().edges.filter(
      (edge: any) => !blockIdsSet.has(edge.source) && !blockIdsSet.has(edge.target)
    )

    // Clean up loops
    const newLoops = { ...get().loops }
    Object.entries(newLoops).forEach(([loopId, loop]: [string, any]) => {
      const remainingNodes = loop.nodes.filter((nodeId: string) => !blockIdsSet.has(nodeId))

      if (remainingNodes.length === 0) {
        // Delete loop if no nodes remain
        delete newLoops[loopId]
      } else if (remainingNodes.length !== loop.nodes.length) {
        // Update loop with remaining nodes
        newLoops[loopId] = {
          ...loop,
          nodes: remainingNodes,
        }
      }
    })

    // OPTIMIZED: Clean up groups - remove deleted blocks and delete empty groups
    const newGroups = { ...get().groups }
    Object.entries(newGroups).forEach(([groupId, group]: [string, any]) => {
      const remainingNodes = group.nodeIds.filter((nodeId: string) => !blockIdsSet.has(nodeId))

      if (remainingNodes.length <= 1) {
        // Delete group if it has less than 2 nodes
        delete newGroups[groupId]
      } else if (remainingNodes.length !== group.nodeIds.length) {
        // Update group with remaining nodes
        newGroups[groupId] = {
          ...group,
          nodeIds: remainingNodes,
        }
      }
    })

    return {
      blocks: newBlocks,
      edges: newEdges,
      loops: newLoops,
      groups: newGroups,
    }
  }
}

/**
 * Debounce utility for performance optimization
 */
export function createDebouncer(delay: number = 200) {
  let timeoutId: NodeJS.Timeout | null = null

  return (callback: () => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      callback()
      timeoutId = null
    }, delay)
  }
}

/**
 * Throttle utility for performance optimization
 */
export function createThrottler(delay: number = 200) {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null

  return (callback: () => void) => {
    const now = Date.now()

    if (now - lastCall >= delay) {
      lastCall = now
      callback()
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(
        () => {
          lastCall = Date.now()
          callback()
          timeoutId = null
        },
        delay - (now - lastCall)
      )
    }
  }
}

/**
 * Validate and clean up groups - remove invalid nodes and empty groups
 * Returns cleaned groups object
 */
export function validateAndCleanGroups(
  groups: Record<string, any>,
  blocks: Record<string, any>
): Record<string, any> {
  const cleanedGroups: Record<string, any> = {}

  Object.entries(groups).forEach(([groupId, group]) => {
    // Validate that all nodes exist in blocks
    const validNodeIds = (group.nodeIds || []).filter((nodeId: string) => blocks[nodeId])

    // Only keep groups with 2 or more valid nodes
    if (validNodeIds.length >= 2) {
      cleanedGroups[groupId] = {
        ...group,
        nodeIds: validNodeIds,
      }
    }
  })

  return cleanedGroups
}

/**
 * Batch update groups - optimized for multiple group operations
 */
export function batchUpdateGroups(
  groups: Record<string, any>,
  updates: Array<{ groupId: string; changes: Partial<any> }>
): Record<string, any> {
  const newGroups = { ...groups }

  updates.forEach(({ groupId, changes }) => {
    if (newGroups[groupId]) {
      newGroups[groupId] = {
        ...newGroups[groupId],
        ...changes,
      }
    }
  })

  return newGroups
}
