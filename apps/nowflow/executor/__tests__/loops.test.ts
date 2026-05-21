import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SerializedBlock, SerializedConnection, SerializedLoop } from '@/serializer/types'
import { LoopManager } from '../loops'
import { ExecutionContext } from '../types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

/**
 * Helper to build a minimal ExecutionContext with defaults.
 */
const createContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  workflowId: 'wf-1',
  blockStates: new Map(),
  blockLogs: [],
  metadata: { startTime: new Date().toISOString(), duration: 0 },
  environmentVariables: {},
  decisions: { router: new Map(), condition: new Map() },
  loopIterations: new Map(),
  loopItems: new Map(),
  completedLoops: new Set(),
  executedBlocks: new Set(),
  activeExecutionPath: new Set(),
  workflow: {
    version: '1.0',
    blocks: [],
    connections: [],
    loops: {},
  },
  ...overrides,
})

describe('LoopManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('construction and getters', () => {
    it('returns default iterations when loop not found', () => {
      const manager = new LoopManager({}, 7)
      expect(manager.getIterations('missing')).toBe(7)
    })

    it('returns the loop iterations when present', () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 3,
      }
      const manager = new LoopManager({ l1: loop })
      expect(manager.getIterations('l1')).toBe(3)
    })

    it('getCurrentItem reads from context.loopItems', () => {
      const manager = new LoopManager({})
      const ctx = createContext()
      ctx.loopItems.set('l1', { x: 1 })
      expect(manager.getCurrentItem('l1', ctx)).toEqual({ x: 1 })
    })

    it('getLoopIndex returns 0 when loop missing', () => {
      const manager = new LoopManager({})
      const ctx = createContext()
      expect(manager.getLoopIndex('missing', 'b1', ctx)).toBe(0)
    })

    it('getLoopIndex returns the iteration counter when loop exists', () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 5,
      }
      const manager = new LoopManager({ l1: loop })
      const ctx = createContext()
      ctx.loopIterations.set('l1', 2)
      expect(manager.getLoopIndex('l1', 'a', ctx)).toBe(2)
    })
  })

  describe('processLoopIterations - empty / early exits', () => {
    it('returns false when there are no loops', async () => {
      const manager = new LoopManager({})
      const ctx = createContext()
      const result = await manager.processLoopIterations(ctx)
      expect(result).toBe(false)
    })

    it('returns true and activates external paths when for-loop reached max iterations', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a', 'b'],
        iterations: 2,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [
            { source: 'b', target: 'after' },
            { source: 'a', target: 'b' },
          ],
          loops: { l1: loop },
        },
      })
      ctx.loopIterations.set('l1', 2)

      const manager = new LoopManager({ l1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(true)
      expect(ctx.activeExecutionPath.has('after')).toBe(true)
      expect(ctx.completedLoops.has('l1')).toBe(true)
    })
  })

  describe('processLoopIterations - for loop normal iteration', () => {
    it('increments iteration counter and resets blocks when all executed mid-loop', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a', 'b'],
        iterations: 3,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'b' }],
          loops: { l1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.executedBlocks.add('b')
      ctx.loopIterations.set('l1', 0)

      const manager = new LoopManager({ l1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(false)
      expect(ctx.loopIterations.get('l1')).toBe(1)
      // Blocks were reset for next iteration
      expect(ctx.executedBlocks.has('a')).toBe(false)
      expect(ctx.executedBlocks.has('b')).toBe(false)
      expect(ctx.activeExecutionPath.has('a')).toBe(true)
      expect(ctx.activeExecutionPath.has('b')).toBe(true)
    })

    it('marks loop complete and activates external path on final iteration', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 2,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'after' }],
          loops: { l1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.loopIterations.set('l1', 1)

      const manager = new LoopManager({ l1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(true)
      expect(ctx.loopIterations.get('l1')).toBe(2)
      expect(ctx.completedLoops.has('l1')).toBe(true)
      expect(ctx.activeExecutionPath.has('after')).toBe(true)
    })

    it('activates next block within the loop when not all blocks executed', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a', 'b'],
        iterations: 3,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'b' }],
          loops: { l1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.loopIterations.set('l1', 0)

      const manager = new LoopManager({ l1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(false)
      // Should activate the next unexecuted block
      expect(ctx.activeExecutionPath.has('b')).toBe(true)
    })
  })

  describe('processLoopIterations - forEach loop', () => {
    it('processes an array items list and stores currentItem', async () => {
      const loop: SerializedLoop = {
        id: 'fe1',
        nodes: ['a'],
        iterations: 10,
        loopType: 'forEach',
        forEachItems: ['x', 'y', 'z'],
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [],
          loops: { fe1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.loopIterations.set('fe1', 0)

      const manager = new LoopManager({ fe1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(false)
      expect(ctx.loopItems.get('fe1')).toBe('x')
      expect(ctx.loopIterations.get('fe1')).toBe(1)
    })

    it('marks forEach complete when all items consumed', async () => {
      const loop: SerializedLoop = {
        id: 'fe1',
        nodes: ['a'],
        iterations: 10,
        loopType: 'forEach',
        forEachItems: ['only'],
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'after' }],
          loops: { fe1: loop },
        },
      })
      ctx.loopIterations.set('fe1', 1)

      const manager = new LoopManager({ fe1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(true)
      expect(ctx.completedLoops.has('fe1')).toBe(true)
      expect(ctx.activeExecutionPath.has('after')).toBe(true)
    })

    it('evaluates a JSON string forEachItems into an array', async () => {
      const loop: SerializedLoop = {
        id: 'fe1',
        nodes: ['a'],
        iterations: 10,
        loopType: 'forEach',
        forEachItems: '[1, 2, 3]',
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [],
          loops: { fe1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.loopIterations.set('fe1', 0)

      const manager = new LoopManager({ fe1: loop })
      await manager.processLoopIterations(ctx)

      expect(Array.isArray(loop.forEachItems)).toBe(true)
      expect(loop.forEachItems).toEqual([1, 2, 3])
      expect(ctx.loopItems.get('fe1')).toBe(1)
    })

    it('defaults to empty list when string expression is a comment', async () => {
      const loop: SerializedLoop = {
        id: 'fe1',
        nodes: ['a'],
        iterations: 10,
        loopType: 'forEach',
        forEachItems: '// nothing here',
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'after' }],
          loops: { fe1: loop },
        },
      })
      ctx.loopIterations.set('fe1', 0)

      const manager = new LoopManager({ fe1: loop })
      const result = await manager.processLoopIterations(ctx)

      // Empty list => considered at / over length, so loop is complete
      expect(result).toBe(true)
      expect(ctx.completedLoops.has('fe1')).toBe(true)
    })

    it('converts an object forEachItems into entry pairs', async () => {
      const loop: SerializedLoop = {
        id: 'fe1',
        nodes: ['a'],
        iterations: 10,
        loopType: 'forEach',
        forEachItems: { a: 1, b: 2 },
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [],
          loops: { fe1: loop },
        },
      })
      ctx.executedBlocks.add('a')
      ctx.loopIterations.set('fe1', 0)

      const manager = new LoopManager({ fe1: loop })
      await manager.processLoopIterations(ctx)

      // First entry pair stored as currentItem
      expect(ctx.loopItems.get('fe1')).toEqual(['a', 1])
      expect(ctx.loopIterations.get('fe1')).toBe(1)
    })
  })

  describe('isFeedbackPath', () => {
    const blocks: SerializedBlock[] = [
      {
        id: 'a',
        position: { x: 0, y: 0 },
        config: { tool: 't', params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
        metadata: { id: 'condition' },
      },
      {
        id: 'b',
        position: { x: 0, y: 0 },
        config: { tool: 't', params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
        metadata: { id: 'test' },
      },
    ]

    it('reports self-loops as feedback paths', () => {
      const manager = new LoopManager({})
      const conn: SerializedConnection = { source: 'a', target: 'a' }
      expect(manager.isFeedbackPath(conn, blocks)).toBe(true)
    })

    it('reports a condition-handle connection targeting an earlier node as feedback', () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a', 'b'],
        iterations: 3,
      }
      const manager = new LoopManager({ l1: loop })
      const conn: SerializedConnection = {
        source: 'b',
        target: 'a',
        sourceHandle: 'condition-yes',
      }
      // Actually source is 'b' (index 1), target 'a' (index 0) but source block must be a condition
      // Swap - use 'a' (which is condition) as the source so the check passes.
      const conn2: SerializedConnection = {
        source: 'a',
        target: 'a',
        sourceHandle: 'condition-yes',
      }
      expect(manager.isFeedbackPath(conn2, blocks)).toBe(true)
      // For the earlier-target case, source must be a condition; swap ids
      const altBlocks: SerializedBlock[] = [
        { ...blocks[1], id: 'first' },
        { ...blocks[0], id: 'cond' },
      ]
      const altLoop: SerializedLoop = {
        id: 'l1',
        nodes: ['first', 'cond'],
        iterations: 3,
      }
      const manager2 = new LoopManager({ l1: altLoop })
      const altConn: SerializedConnection = {
        source: 'cond',
        target: 'first',
        sourceHandle: 'condition-yes',
      }
      expect(manager2.isFeedbackPath(altConn, altBlocks)).toBe(true)
      // Bonus: silence unused variable warnings
      expect(conn).toBeDefined()
    })

    it('returns false for forward connections in the loop', () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a', 'b'],
        iterations: 3,
      }
      const manager = new LoopManager({ l1: loop })
      const conn: SerializedConnection = { source: 'a', target: 'b' }
      expect(manager.isFeedbackPath(conn, blocks)).toBe(false)
    })

    it('returns false when nodes are not in any loop', () => {
      const manager = new LoopManager({})
      const conn: SerializedConnection = { source: 'x', target: 'y' }
      expect(manager.isFeedbackPath(conn, blocks)).toBe(false)
    })
  })

  describe('activateExternalPaths via processLoopIterations (connection types)', () => {
    it('activates error path only when block has an error', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 1,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'after', sourceHandle: 'error' }],
          loops: { l1: loop },
        },
      })
      ctx.blockStates.set('a', {
        output: { response: { error: 'boom' } },
        executed: true,
      })
      ctx.loopIterations.set('l1', 1)

      const manager = new LoopManager({ l1: loop })
      const result = await manager.processLoopIterations(ctx)

      expect(result).toBe(true)
      expect(ctx.activeExecutionPath.has('after')).toBe(true)
    })

    it('does not activate error path when no error present', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 1,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [{ source: 'a', target: 'after', sourceHandle: 'error' }],
          loops: { l1: loop },
        },
      })
      ctx.blockStates.set('a', {
        output: { response: { result: 'ok' } },
        executed: true,
      })
      ctx.loopIterations.set('l1', 1)

      const manager = new LoopManager({ l1: loop })
      await manager.processLoopIterations(ctx)

      expect(ctx.activeExecutionPath.has('after')).toBe(false)
    })

    it('activates selected condition branch only', async () => {
      const loop: SerializedLoop = {
        id: 'l1',
        nodes: ['a'],
        iterations: 1,
      }
      const ctx = createContext({
        workflow: {
          version: '1.0',
          blocks: [],
          connections: [
            { source: 'a', target: 'targetYes', sourceHandle: 'condition-yes' },
            { source: 'a', target: 'targetNo', sourceHandle: 'condition-no' },
          ],
          loops: { l1: loop },
        },
      })
      ctx.decisions.condition.set('a', 'yes')
      ctx.loopIterations.set('l1', 1)

      const manager = new LoopManager({ l1: loop })
      await manager.processLoopIterations(ctx)

      expect(ctx.activeExecutionPath.has('targetYes')).toBe(true)
      expect(ctx.activeExecutionPath.has('targetNo')).toBe(false)
    })
  })
})
