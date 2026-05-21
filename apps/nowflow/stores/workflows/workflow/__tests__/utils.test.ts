/**
 * Tests for workflow utils (cycle detection)
 */
import { describe, expect, it } from 'vitest'
import { Edge } from '@xyflow/react'
import { detectCycle } from '../utils'

const makeEdge = (source: string, target: string): Edge =>
  ({
    id: `${source}-${target}`,
    source,
    target,
  }) as Edge

describe('detectCycle', () => {
  it('returns hasCycle=false for an empty graph', () => {
    const result = detectCycle([], 'a')
    expect(result.hasCycle).toBe(false)
    expect(result.paths).toEqual([])
  })

  it('returns hasCycle=false for a linear chain A -> B -> C', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(false)
    expect(result.paths).toEqual([])
  })

  it('detects a self-loop (node -> itself)', () => {
    const edges = [makeEdge('a', 'a')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(true)
    expect(result.paths.length).toBeGreaterThan(0)
    expect(result.paths[0]).toEqual(['a'])
  })

  it('detects a direct two-node cycle A -> B -> A', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(true)
    expect(result.paths.length).toBeGreaterThan(0)
  })

  it('detects a three-node cycle A -> B -> C -> A', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'a')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(true)
    const found = result.paths.find((p) => p.includes('a') && p.includes('b') && p.includes('c'))
    expect(found).toBeDefined()
  })

  it('returns hasCycle=false when starting from an unreachable node in DAG', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const result = detectCycle(edges, 'c')
    expect(result.hasCycle).toBe(false)
  })

  it('handles a diamond (no cycle) A->B, A->C, B->D, C->D', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c'), makeEdge('b', 'd'), makeEdge('c', 'd')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(false)
  })

  it('detects a cycle buried deeper in the graph A->B->C->D->B', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'd'), makeEdge('d', 'b')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(true)
  })

  it('ignores branches with no outgoing edges', () => {
    const edges = [makeEdge('a', 'b')]
    const result = detectCycle(edges, 'a')
    expect(result.hasCycle).toBe(false)
  })
})
