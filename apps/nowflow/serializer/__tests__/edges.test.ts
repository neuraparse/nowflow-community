/**
 * @vitest-environment node
 *
 * Serializer Edge Case Tests
 *
 * Covers territory not exercised by serializer/index.test.ts:
 *   (a) round-trip serialize -> deserialize identity across loop, condition, router,
 *       starter, sub-workflow, evaluator, and a generic tool block
 *   (b) malformed input tolerance (missing fields, extra fields, null blocks)
 *   (c) connection/edge handling (disconnected blocks, multiple outputs, no edges)
 *   (d) versioning preservation across round-trips
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Edge } from '@xyflow/react'
import { BlockState, Loop } from '@/stores/workflows/workflow/types'
import {
  createComplexWorkflowState,
  createConditionalWorkflowState,
  createLoopWorkflowState,
  createMinimalWorkflowState,
} from '../__test-utils__/test-workflows'
import { Serializer } from '../index'
import { SerializedWorkflow } from '../types'

// Mock logger (node env, no jsdom required)
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock block registry with extended block types for edge-case coverage
vi.mock('@/blocks', () => ({
  getBlock: (type: string) => {
    const mockConfigs: Record<string, any> = {
      starter: {
        name: 'Starter',
        description: 'Start of the workflow',
        category: 'flow',
        bgColor: '#4CAF50',
        tools: { access: ['starter'], config: { tool: () => 'starter' } },
        subBlocks: [
          { id: 'description', type: 'long-input', label: 'Description' },
          { id: 'startWorkflow', type: 'dropdown', label: 'Trigger' },
        ],
        inputs: {},
      },
      condition: {
        name: 'Condition',
        description: 'Branch based on condition',
        category: 'flow',
        bgColor: '#FF9800',
        tools: { access: ['condition'], config: { tool: () => 'condition' } },
        subBlocks: [{ id: 'condition', type: 'long-input', label: 'Condition' }],
        inputs: { input: { type: 'any' } },
      },
      function: {
        name: 'Function',
        description: 'Execute custom code',
        category: 'code',
        bgColor: '#9C27B0',
        tools: { access: ['function'], config: { tool: () => 'function' } },
        subBlocks: [
          { id: 'code', type: 'code', label: 'Code' },
          { id: 'language', type: 'dropdown', label: 'Language' },
        ],
        inputs: { input: { type: 'any' } },
      },
      router: {
        name: 'Router',
        description: 'Route to one of multiple targets',
        category: 'flow',
        bgColor: '#3F51B5',
        tools: { access: ['router'], config: { tool: () => 'router' } },
        subBlocks: [
          { id: 'prompt', type: 'long-input', label: 'Routing Prompt' },
          { id: 'model', type: 'dropdown', label: 'Model' },
        ],
        inputs: { input: { type: 'any' } },
      },
      evaluator: {
        name: 'Evaluator',
        description: 'Score a response against a rubric',
        category: 'flow',
        bgColor: '#795548',
        tools: { access: ['evaluator'], config: { tool: () => 'evaluator' } },
        subBlocks: [
          { id: 'content', type: 'long-input', label: 'Content' },
          { id: 'metrics', type: 'long-input', label: 'Metrics' },
          { id: 'model', type: 'dropdown', label: 'Model' },
        ],
        inputs: { input: { type: 'any' } },
      },
      'sub-workflow': {
        name: 'Sub Workflow',
        description: 'Execute a nested workflow',
        category: 'flow',
        bgColor: '#009688',
        tools: { access: ['sub_workflow'], config: { tool: () => 'sub_workflow' } },
        subBlocks: [
          { id: 'workflowId', type: 'short-input', label: 'Workflow ID' },
          { id: 'inputs', type: 'long-input', label: 'Inputs' },
        ],
        inputs: { input: { type: 'any' } },
      },
      loop: {
        name: 'Loop',
        description: 'Iterate over items',
        category: 'flow',
        bgColor: '#607D8B',
        tools: { access: ['loop'], config: { tool: () => 'loop' } },
        subBlocks: [
          { id: 'loopType', type: 'dropdown', label: 'Loop Type' },
          { id: 'iterations', type: 'short-input', label: 'Iterations' },
          { id: 'forEachItems', type: 'long-input', label: 'For Each Items' },
        ],
        inputs: { input: { type: 'any' } },
      },
      // Generic tool block representing any leaf "tool" block
      generic_tool: {
        name: 'Generic Tool',
        description: 'A generic tool block',
        category: 'tools',
        bgColor: '#FFC107',
        tools: { access: ['generic_tool'], config: { tool: () => 'generic_tool' } },
        subBlocks: [
          { id: 'apiKey', type: 'short-input', label: 'API Key' },
          { id: 'query', type: 'long-input', label: 'Query' },
        ],
        inputs: { input: { type: 'string' } },
      },
      // Needed for fixtures imported from __test-utils__/test-workflows
      agent: {
        name: 'Agent',
        description: 'AI Agent',
        category: 'ai',
        bgColor: '#2196F3',
        tools: {
          access: ['anthropic_chat', 'openai_chat', 'google_chat'],
          config: {
            tool: (params: Record<string, any>) =>
              (params.model || 'gpt-4o').startsWith('claude') ? 'anthropic' : 'openai',
          },
        },
        subBlocks: [
          { id: 'provider', type: 'dropdown', label: 'Provider' },
          { id: 'model', type: 'dropdown', label: 'Model' },
          { id: 'prompt', type: 'long-input', label: 'Prompt' },
          { id: 'tools', type: 'tool-input', label: 'Tools' },
          { id: 'system', type: 'long-input', label: 'System Message' },
          { id: 'responseFormat', type: 'code', label: 'Response Format' },
        ],
        inputs: { input: { type: 'string' }, tools: { type: 'array' } },
      },
      api: {
        name: 'API',
        description: 'Make API request',
        category: 'data',
        bgColor: '#E91E63',
        tools: { access: ['api'], config: { tool: () => 'api' } },
        subBlocks: [
          { id: 'url', type: 'short-input', label: 'URL' },
          { id: 'method', type: 'dropdown', label: 'Method' },
          { id: 'headers', type: 'table', label: 'Headers' },
          { id: 'body', type: 'long-input', label: 'Body' },
        ],
        inputs: {},
      },
    }
    return mockConfigs[type] || null
  },
}))

/**
 * Factory: build a minimal BlockState for any registered mock type.
 * subBlockValues lets a test populate specific sub-block values.
 */
function makeBlock(
  id: string,
  type: string,
  subBlockValues: Record<string, any> = {},
  overrides: Partial<BlockState> = {}
): BlockState {
  const subBlocks: Record<string, any> = {}
  for (const [key, value] of Object.entries(subBlockValues)) {
    subBlocks[key] = { id: key, type: 'short-input', value }
  }
  return {
    id,
    type,
    name: `${type} ${id}`,
    position: { x: 0, y: 0 },
    subBlocks,
    outputs: {},
    enabled: true,
    ...overrides,
  }
}

describe('Serializer edges', () => {
  let serializer: Serializer

  beforeEach(() => {
    serializer = new Serializer()
  })

  /**
   * (a) Round-trip identity across a variety of block shapes
   */
  describe('round-trip serialize -> deserialize identity', () => {
    const roundTripCases: Array<{
      kind: string
      block: BlockState
      assertValues: Record<string, any>
    }> = [
      {
        kind: 'starter',
        block: makeBlock('s1', 'starter', {
          description: 'kicks things off',
          startWorkflow: 'manual',
        }),
        assertValues: { description: 'kicks things off', startWorkflow: 'manual' },
      },
      {
        kind: 'condition',
        block: makeBlock('c1', 'condition', { condition: 'input.value === 42' }),
        assertValues: { condition: 'input.value === 42' },
      },
      {
        kind: 'router',
        block: makeBlock('r1', 'router', {
          prompt: 'Pick a path',
          model: 'gpt-4o',
        }),
        assertValues: { prompt: 'Pick a path', model: 'gpt-4o' },
      },
      {
        kind: 'evaluator',
        block: makeBlock('e1', 'evaluator', {
          content: 'Some response',
          metrics: 'accuracy,clarity',
          model: 'gpt-4o',
        }),
        assertValues: {
          content: 'Some response',
          metrics: 'accuracy,clarity',
          model: 'gpt-4o',
        },
      },
      {
        kind: 'sub-workflow',
        block: makeBlock('sw1', 'sub-workflow', {
          workflowId: 'wf_abc123',
          inputs: '{"foo":"bar"}',
        }),
        assertValues: { workflowId: 'wf_abc123', inputs: '{"foo":"bar"}' },
      },
      {
        kind: 'loop',
        block: makeBlock('l1', 'loop', {
          loopType: 'forEach',
          iterations: '5',
          forEachItems: '[1,2,3]',
        }),
        assertValues: {
          loopType: 'forEach',
          iterations: '5',
          forEachItems: '[1,2,3]',
        },
      },
      {
        kind: 'generic tool',
        block: makeBlock('t1', 'generic_tool', {
          apiKey: 'test-key',
          query: 'hello',
        }),
        assertValues: { apiKey: 'test-key', query: 'hello' },
      },
    ]

    test.each(roundTripCases)('preserves identity for $kind block', ({ block, assertValues }) => {
      const blocks: Record<string, BlockState> = { [block.id]: block }
      const serialized = serializer.serializeWorkflow(blocks, [], {})

      expect(serialized.blocks).toHaveLength(1)
      expect(serialized.blocks[0].metadata?.id).toBe(block.type)
      expect(serialized.blocks[0].id).toBe(block.id)

      const deserialized = serializer.deserializeWorkflow(serialized)
      const out = deserialized.blocks[block.id]

      expect(out).toBeDefined()
      expect(out.type).toBe(block.type)
      expect(out.position).toEqual(block.position)

      for (const [key, value] of Object.entries(assertValues)) {
        expect(out.subBlocks[key]?.value).toBe(value)
      }
    })

    test('preserves metadata (id, name, description, category, color) end-to-end', () => {
      const block = makeBlock('r1', 'router', { prompt: 'p', model: 'gpt-4o' })
      const serialized = serializer.serializeWorkflow({ r1: block }, [], {})
      const meta = serialized.blocks[0].metadata

      expect(meta?.id).toBe('router')
      expect(meta?.name).toBe('router r1')
      expect(meta?.description).toBe('Route to one of multiple targets')
      expect(meta?.category).toBe('flow')
      expect(meta?.color).toBe('#3F51B5')
    })

    test('round-trip is stable across three cycles (idempotent re-serialization)', () => {
      const { blocks, edges, loops } = createComplexWorkflowState()
      const s1 = serializer.serializeWorkflow(blocks, edges, loops)
      const d1 = serializer.deserializeWorkflow(s1)
      const s2 = serializer.serializeWorkflow(d1.blocks, d1.edges, loops)
      const d2 = serializer.deserializeWorkflow(s2)
      const s3 = serializer.serializeWorkflow(d2.blocks, d2.edges, loops)

      expect(s3.blocks.length).toBe(s1.blocks.length)
      expect(s3.connections.length).toBe(s1.connections.length)
      expect(s3.loops).toEqual(s1.loops)
    })
  })

  /**
   * (b) Malformed input tolerance
   */
  describe('malformed input tolerance', () => {
    test('skips null blocks during serialization', () => {
      const blocks: Record<string, BlockState> = {
        good: makeBlock('good', 'starter', { description: 'ok' }),
        // simulate a null entry in the record (can happen via undo/redo edge cases)
        bad: null as unknown as BlockState,
      }

      const serialized = serializer.serializeWorkflow(blocks, [], {})
      expect(serialized.blocks).toHaveLength(1)
      expect(serialized.blocks[0].id).toBe('good')
    })

    test('skips blocks missing both type and name', () => {
      const blocks: Record<string, BlockState> = {
        good: makeBlock('good', 'starter', { description: 'ok' }),
        broken: {
          id: 'broken',
          type: '' as any,
          name: '',
          position: { x: 0, y: 0 },
          subBlocks: {},
          outputs: {},
          enabled: true,
        },
      }

      const serialized = serializer.serializeWorkflow(blocks, [], {})
      expect(serialized.blocks).toHaveLength(1)
      expect(serialized.blocks.find((b) => b.id === 'broken')).toBeUndefined()
    })

    test('recovers missing block name from registry when type is present', () => {
      const blockWithMissingName: BlockState = {
        id: 'recoverable',
        type: 'starter',
        name: '', // missing - should be recovered from registry ("Starter")
        position: { x: 10, y: 20 },
        subBlocks: { description: { id: 'description', type: 'long-input', value: 'x' } },
        outputs: {},
        enabled: true,
      }

      const serialized = serializer.serializeWorkflow({ recoverable: blockWithMissingName }, [], {})
      expect(serialized.blocks).toHaveLength(1)
      expect(serialized.blocks[0].metadata?.name).toBe('Starter')
    })

    test('throws on unknown block type during serialization', () => {
      const blocks: Record<string, BlockState> = {
        mystery: makeBlock('mystery', 'this_type_does_not_exist', {}),
      }
      expect(() => serializer.serializeWorkflow(blocks, [], {})).toThrow(
        /Invalid block type: this_type_does_not_exist/
      )
    })

    test('extra params in serialized form are ignored on deserialize (only known subBlocks restored)', () => {
      const serialized: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 's1',
            position: { x: 0, y: 0 },
            config: {
              tool: 'starter',
              params: {
                description: 'legit',
                // unknown extras - should simply be ignored
                bogusExtra: 'junk',
                anotherExtra: { nested: true },
              },
            },
            inputs: {},
            outputs: {},
            metadata: { id: 'starter', name: 'Starter' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
      }

      const { blocks } = serializer.deserializeWorkflow(serialized)
      expect(blocks.s1).toBeDefined()
      expect(blocks.s1.subBlocks.description.value).toBe('legit')
      expect(blocks.s1.subBlocks.bogusExtra).toBeUndefined()
      expect(blocks.s1.subBlocks.anotherExtra).toBeUndefined()
    })

    test('missing params for a known subBlock default to null on deserialize', () => {
      const serialized: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'c1',
            position: { x: 0, y: 0 },
            config: {
              tool: 'condition',
              params: {}, // no `condition` value supplied
            },
            inputs: {},
            outputs: {},
            metadata: { id: 'condition', name: 'Condition' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
      }

      const { blocks } = serializer.deserializeWorkflow(serialized)
      expect(blocks.c1.subBlocks.condition).toBeDefined()
      expect(blocks.c1.subBlocks.condition.value).toBeNull()
    })

    test('throws when metadata.id references a non-existent block type during deserialize', () => {
      const serialized: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'x',
            position: { x: 0, y: 0 },
            config: { tool: 'ghost', params: {} },
            inputs: {},
            outputs: {},
            metadata: { id: 'ghost_block_type' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
      }

      expect(() => serializer.deserializeWorkflow(serialized)).toThrow(
        /Invalid block type: ghost_block_type/
      )
    })

    test('deserialized blocks always come back enabled (current behavior)', () => {
      const block = makeBlock('s1', 'starter', { description: 'x' }, { enabled: false })
      const serialized = serializer.serializeWorkflow({ s1: block }, [], {})
      expect(serialized.blocks[0].enabled).toBe(false)

      const { blocks } = serializer.deserializeWorkflow(serialized)
      // Note: deserializeBlock currently hardcodes `enabled: true` regardless of input.
      expect(blocks.s1.enabled).toBe(true)
    })
  })

  /**
   * (c) Connection / edge handling
   */
  describe('connection and edge handling', () => {
    test('workflow with zero edges serializes with an empty connections array', () => {
      const block = makeBlock('s1', 'starter', { description: 'only block' })
      const serialized = serializer.serializeWorkflow({ s1: block }, [], {})
      expect(serialized.connections).toEqual([])
    })

    test('disconnected blocks are all retained (no implicit pruning)', () => {
      const blocks: Record<string, BlockState> = {
        island1: makeBlock('island1', 'starter', { description: 'a' }),
        island2: makeBlock('island2', 'function', { code: 'return 1', language: 'javascript' }),
        island3: makeBlock('island3', 'generic_tool', { apiKey: 'k', query: 'q' }),
      }
      const serialized = serializer.serializeWorkflow(blocks, [], {})
      expect(serialized.blocks).toHaveLength(3)
      expect(serialized.connections).toHaveLength(0)

      const { blocks: restored } = serializer.deserializeWorkflow(serialized)
      expect(Object.keys(restored).sort()).toEqual(['island1', 'island2', 'island3'])
    })

    test('multiple outputs from the same source are preserved with distinct handles', () => {
      const blocks: Record<string, BlockState> = {
        s: makeBlock('s', 'starter', { description: 'src' }),
        a: makeBlock('a', 'generic_tool', { apiKey: 'k1', query: 'q1' }),
        b: makeBlock('b', 'generic_tool', { apiKey: 'k2', query: 'q2' }),
        c: makeBlock('c', 'generic_tool', { apiKey: 'k3', query: 'q3' }),
      }
      const edges: Edge[] = [
        { id: 'e1', source: 's', target: 'a', sourceHandle: 'out-1' },
        { id: 'e2', source: 's', target: 'b', sourceHandle: 'out-2' },
        { id: 'e3', source: 's', target: 'c', sourceHandle: 'out-3' },
      ]

      const serialized = serializer.serializeWorkflow(blocks, edges, {})
      expect(serialized.connections).toHaveLength(3)
      const handlesFromS = serialized.connections
        .filter((c) => c.source === 's')
        .map((c) => c.sourceHandle)
        .sort()
      expect(handlesFromS).toEqual(['out-1', 'out-2', 'out-3'])

      const { edges: restored } = serializer.deserializeWorkflow(serialized)
      expect(restored).toHaveLength(3)
      expect(restored.map((e) => e.sourceHandle).sort()).toEqual(['out-1', 'out-2', 'out-3'])
    })

    test('edges without handles serialize with undefined handles (not null or empty string)', () => {
      const blocks: Record<string, BlockState> = {
        s: makeBlock('s', 'starter', { description: 'src' }),
        a: makeBlock('a', 'generic_tool', { apiKey: 'k', query: 'q' }),
      }
      const edges: Edge[] = [{ id: 'e1', source: 's', target: 'a' }]

      const serialized = serializer.serializeWorkflow(blocks, edges, {})
      expect(serialized.connections).toHaveLength(1)
      expect(serialized.connections[0].sourceHandle).toBeUndefined()
      expect(serialized.connections[0].targetHandle).toBeUndefined()
    })

    test('empty-string handles are coerced to undefined on serialize', () => {
      const blocks: Record<string, BlockState> = {
        s: makeBlock('s', 'starter', { description: 'src' }),
        a: makeBlock('a', 'generic_tool', { apiKey: 'k', query: 'q' }),
      }
      const edges: Edge[] = [
        { id: 'e1', source: 's', target: 'a', sourceHandle: '', targetHandle: '' },
      ]
      const serialized = serializer.serializeWorkflow(blocks, edges, {})
      expect(serialized.connections[0].sourceHandle).toBeUndefined()
      expect(serialized.connections[0].targetHandle).toBeUndefined()
    })

    test('edges pointing to non-existent targets still serialize (no orphan pruning)', () => {
      // Real workflows may transiently reference a target that was just removed.
      // The serializer does not validate referential integrity; it just records what it's given.
      const blocks: Record<string, BlockState> = {
        s: makeBlock('s', 'starter', { description: 'src' }),
      }
      const edges: Edge[] = [{ id: 'e1', source: 's', target: 'ghost' }]

      const serialized = serializer.serializeWorkflow(blocks, edges, {})
      expect(serialized.connections).toHaveLength(1)
      expect(serialized.connections[0].target).toBe('ghost')
    })

    test('deserialize assigns a fresh edge id (crypto.randomUUID) per connection', () => {
      const { blocks, edges, loops } = createConditionalWorkflowState()
      const serialized = serializer.serializeWorkflow(blocks, edges, loops)
      const { edges: restored } = serializer.deserializeWorkflow(serialized)

      expect(restored).toHaveLength(edges.length)
      const ids = restored.map((e) => e.id)
      // ids regenerated - should not match originals
      const originalIds = edges.map((e) => e.id)
      for (const id of ids) {
        expect(originalIds).not.toContain(id)
      }
      // And all regenerated ids are unique
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  /**
   * (d) Versioning / loop preservation
   */
  describe('versioning and loop preservation', () => {
    test('serialized workflow carries version string "1.0"', () => {
      const { blocks, edges, loops } = createMinimalWorkflowState()
      const serialized = serializer.serializeWorkflow(blocks, edges, loops)
      expect(serialized.version).toBe('1.0')
    })

    test('version is preserved after a round-trip (re-serialization stamps current version)', () => {
      const { blocks, edges, loops } = createMinimalWorkflowState()
      const s1 = serializer.serializeWorkflow(blocks, edges, loops)
      const d1 = serializer.deserializeWorkflow(s1)
      const s2 = serializer.serializeWorkflow(d1.blocks, d1.edges, loops)
      expect(s2.version).toBe(s1.version)
      expect(s2.version).toBe('1.0')
    })

    test('loop metadata survives round-trip unchanged', () => {
      const { blocks, edges, loops } = createLoopWorkflowState()
      const s1 = serializer.serializeWorkflow(blocks, edges, loops)
      const d1 = serializer.deserializeWorkflow(s1)
      const s2 = serializer.serializeWorkflow(d1.blocks, d1.edges, loops)

      expect(s2.loops).toEqual(s1.loops)
      expect(s2.loops.loop1.iterations).toBe(10)
      expect(s2.loops.loop1.loopType).toBe('for')
      expect(s2.loops.loop1.nodes).toEqual(['function1', 'condition1'])
    })

    test('empty loops record is preserved as {}', () => {
      const { blocks, edges } = createMinimalWorkflowState()
      const loops: Record<string, Loop> = {}
      const serialized = serializer.serializeWorkflow(blocks, edges, loops)
      expect(serialized.loops).toEqual({})
    })

    test('multiple named loops are all preserved', () => {
      const { blocks, edges } = createMinimalWorkflowState()
      const loops: Record<string, Loop> = {
        outer: {
          id: 'outer',
          nodes: ['agent1'],
          iterations: 3,
          loopType: 'for',
        },
        inner: {
          id: 'inner',
          nodes: ['starter'],
          iterations: 7,
          loopType: 'forEach',
          forEachItems: '[1,2,3,4,5,6,7]',
        },
      }

      const serialized = serializer.serializeWorkflow(blocks, edges, loops)
      expect(Object.keys(serialized.loops).sort()).toEqual(['inner', 'outer'])
      expect(serialized.loops.inner.loopType).toBe('forEach')
      expect(serialized.loops.inner.forEachItems).toBe('[1,2,3,4,5,6,7]')
      expect(serialized.loops.outer.iterations).toBe(3)
    })
  })
})
