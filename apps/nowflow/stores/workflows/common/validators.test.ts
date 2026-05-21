/**
 * Tests for workflow common validators.
 * Covers: validateEdge, checkDuplicateEdge, wouldCreateCycle
 */
import { describe, expect, it } from 'vitest'
import {
  checkDuplicateEdge,
  getCycleCheckEdges,
  validateEdge,
  wouldCreateCycle,
} from './validators'

describe('validateEdge', () => {
  it('rejects null/undefined edges', () => {
    expect(validateEdge(null).valid).toBe(false)
    expect(validateEdge(undefined).valid).toBe(false)
  })

  it('rejects edges without source', () => {
    const result = validateEdge({ target: 'b' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('source')
  })

  it('rejects edges without target', () => {
    const result = validateEdge({ source: 'a' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('target')
  })

  it('rejects self-loop edges', () => {
    const result = validateEdge({ source: 'a', target: 'a' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('itself')
  })

  it('accepts valid edges', () => {
    const result = validateEdge({ source: 'a', target: 'b' })
    expect(result.valid).toBe(true)
  })
})

describe('checkDuplicateEdge', () => {
  const existing = [
    { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
  ] as any[]

  it('detects exact duplicate', () => {
    const dup = { source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' } as any
    expect(checkDuplicateEdge(dup, existing).valid).toBe(false)
  })

  it('allows same source/target with different handles', () => {
    const edge = {
      source: 'a',
      target: 'b',
      sourceHandle: 'condition-1',
      targetHandle: 'target',
    } as any
    expect(checkDuplicateEdge(edge, existing).valid).toBe(true)
  })

  it('allows different source/target', () => {
    const edge = { source: 'a', target: 'c', sourceHandle: 'source', targetHandle: 'target' } as any
    expect(checkDuplicateEdge(edge, existing).valid).toBe(true)
  })

  it('passes with empty existing edges', () => {
    const edge = { source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' } as any
    expect(checkDuplicateEdge(edge, []).valid).toBe(true)
  })
})

describe('wouldCreateCycle', () => {
  it('returns false for a simple linear chain (A→B→C, adding C→D)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ] as any[]
    expect(wouldCreateCycle('C', 'D', edges)).toBe(false)
  })

  it('detects direct backward edge (A→B, adding B→A)', () => {
    const edges = [{ id: 'e1', source: 'A', target: 'B' }] as any[]
    // Adding B→A: from B's target (A), can we reach source (B)? A→B yes!
    expect(wouldCreateCycle('B', 'A', edges)).toBe(true)
  })

  it('detects indirect cycle (A→B→C, adding C→A)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ] as any[]
    expect(wouldCreateCycle('C', 'A', edges)).toBe(true)
  })

  it('allows parallel paths without cycles (A→B, A→C, adding B→D)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
    ] as any[]
    expect(wouldCreateCycle('B', 'D', edges)).toBe(false)
  })

  it('handles diamond graph without cycle (A→B, A→C, B→D, C→D, adding D→E)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'D' },
    ] as any[]
    expect(wouldCreateCycle('D', 'E', edges)).toBe(false)
  })

  it('detects cycle in diamond graph (A→B, A→C, B→D, C→D, adding D→A)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'D' },
    ] as any[]
    expect(wouldCreateCycle('D', 'A', edges)).toBe(true)
  })

  it('handles empty graph', () => {
    expect(wouldCreateCycle('A', 'B', [])).toBe(false)
  })

  it('handles long chain cycle detection (A→B→C→D→E, adding E→A)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'D' },
      { id: 'e4', source: 'D', target: 'E' },
    ] as any[]
    expect(wouldCreateCycle('E', 'A', edges)).toBe(true)
  })

  it('handles disconnected components (A→B, C→D, adding D→E)', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'C', target: 'D' },
    ] as any[]
    expect(wouldCreateCycle('D', 'E', edges)).toBe(false)
  })

  it('no false positive when target has no outgoing edges', () => {
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
    ] as any[]
    // Adding C→B: from B there are no outgoing edges, so no cycle
    expect(wouldCreateCycle('C', 'B', edges)).toBe(false)
  })
})

describe('getCycleCheckEdges', () => {
  it('removes utility-slot attachments from execution cycle checks', () => {
    const edges = [
      {
        id: 'utility-attachment',
        source: 'utility',
        target: 'host',
        sourceHandle: 'utility-source',
        targetHandle: 'utility-target',
      },
      {
        id: 'execution',
        source: 'host',
        target: 'next',
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ] as any[]

    expect(getCycleCheckEdges(edges)).toEqual([edges[1]])
  })
})
