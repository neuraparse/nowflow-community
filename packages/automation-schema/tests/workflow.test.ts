import { describe, expect, it } from 'vitest'
import {
  PositionSchema,
  SerializedEdgeSchema,
  SerializedGroupSchema,
  SerializedLoopSchema,
  SerializedNodeSchema,
  SerializedWorkflowSchema,
} from '../src/workflow'

const node = {
  id: 'n1',
  type: 'http',
  config: { tool: 'http.request', params: { url: 'https://example.com' } },
  inputs: { url: 'string' as const },
  outputs: { response: 'json' as const },
}

const edge = {
  source: 'n1',
  target: 'n2',
}

describe('PositionSchema', () => {
  it('accepts numeric x/y', () => {
    expect(PositionSchema.safeParse({ x: 10, y: 20 }).success).toBe(true)
  })

  it('rejects non-numeric values', () => {
    expect(PositionSchema.safeParse({ x: '10', y: 20 }).success).toBe(false)
  })
})

describe('SerializedNodeSchema', () => {
  it('parses a minimal node', () => {
    const parsed = SerializedNodeSchema.parse(node)
    expect(parsed.id).toBe('n1')
    expect(parsed.enabled).toBe(true)
  })

  it('accepts an optional position', () => {
    const parsed = SerializedNodeSchema.parse({ ...node, position: { x: 1, y: 2 } })
    expect(parsed.position?.x).toBe(1)
  })

  it('rejects a node missing config', () => {
    const { config: _omit, ...bad } = node
    expect(SerializedNodeSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts optional parentId', () => {
    const parsed = SerializedNodeSchema.parse({ ...node, parentId: 'loop-1' })
    expect(parsed.parentId).toBe('loop-1')
  })
})

describe('SerializedEdgeSchema', () => {
  it('accepts a minimal edge', () => {
    const parsed = SerializedEdgeSchema.parse(edge)
    expect(parsed.source).toBe('n1')
    expect(parsed.target).toBe('n2')
  })

  it('rejects a non-string source', () => {
    expect(SerializedEdgeSchema.safeParse({ source: 1, target: 'n2' }).success).toBe(false)
  })

  it('rejects a non-string target', () => {
    expect(SerializedEdgeSchema.safeParse({ source: 'n1', target: 2 }).success).toBe(false)
  })

  it('accepts a conditional edge', () => {
    const parsed = SerializedEdgeSchema.parse({
      ...edge,
      condition: { type: 'if', expression: 'x > 0' },
    })
    expect(parsed.condition?.type).toBe('if')
  })

  it('rejects an invalid condition type', () => {
    const result = SerializedEdgeSchema.safeParse({
      ...edge,
      condition: { type: 'otherwise' },
    })
    expect(result.success).toBe(false)
  })
})

describe('SerializedLoopSchema', () => {
  it('accepts a basic loop', () => {
    const parsed = SerializedLoopSchema.parse({ id: 'l1', nodes: ['n1'], iterations: 5 })
    expect(parsed.iterations).toBe(5)
  })

  it('rejects a negative iteration count', () => {
    expect(SerializedLoopSchema.safeParse({ id: 'l1', nodes: [], iterations: -1 }).success).toBe(
      false
    )
  })

  it('accepts loopType enum values', () => {
    for (const loopType of ['for', 'forEach', 'while'] as const) {
      expect(
        SerializedLoopSchema.safeParse({ id: 'l1', nodes: [], iterations: 1, loopType }).success
      ).toBe(true)
    }
  })
})

describe('SerializedGroupSchema', () => {
  it('defaults kind to `group`', () => {
    const parsed = SerializedGroupSchema.parse({ id: 'g1', nodes: [] })
    expect(parsed.kind).toBe('group')
  })

  it('accepts all kinds', () => {
    for (const kind of ['group', 'parallel', 'subflow'] as const) {
      expect(SerializedGroupSchema.safeParse({ id: 'g1', nodes: [], kind }).success).toBe(true)
    }
  })
})

describe('SerializedWorkflowSchema', () => {
  it('parses an empty workflow (blocks/edges required)', () => {
    const parsed = SerializedWorkflowSchema.parse({
      version: '1.0',
      blocks: [],
      edges: [],
    })
    expect(parsed.version).toBe('1.0')
    expect(parsed.blocks).toEqual([])
    expect(parsed.edges).toEqual([])
    expect(parsed.loops).toEqual({})
    expect(parsed.groups).toEqual({})
    expect(parsed.variables).toEqual({})
  })

  it('parses a workflow with nodes, edges, and loops', () => {
    const parsed = SerializedWorkflowSchema.parse({
      version: '1.0',
      blocks: [node],
      edges: [edge],
      loops: { l1: { id: 'l1', nodes: ['n1'], iterations: 3 } },
    })
    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.edges).toHaveLength(1)
    expect(parsed.loops.l1.iterations).toBe(3)
  })

  it('requires `version`', () => {
    expect(SerializedWorkflowSchema.safeParse({ blocks: [], edges: [] }).success).toBe(false)
  })

  it('accepts variables keyed by name', () => {
    const parsed = SerializedWorkflowSchema.parse({
      version: '1.0',
      blocks: [],
      edges: [],
      variables: { myVar: { type: 'string', value: 'hello' } },
    })
    expect(parsed.variables.myVar.type).toBe('string')
  })

  it('accepts optional metadata timestamps', () => {
    const parsed = SerializedWorkflowSchema.parse({
      version: '1.0',
      blocks: [],
      edges: [],
      metadata: { name: 'Demo', createdAt: '2026-01-01T00:00:00Z' },
    })
    expect(parsed.metadata?.name).toBe('Demo')
  })
})
