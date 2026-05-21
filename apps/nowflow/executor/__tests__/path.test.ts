import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PathTracker } from '@/executor/path'
import { ExecutionContext } from '@/executor/types'
import { SerializedWorkflow } from '@/serializer/types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const makeBlock = (id: string, typeId: string, enabled = true) => ({
  id,
  metadata: { id: typeId, name: typeId },
  position: { x: 0, y: 0 },
  config: { tool: typeId, params: {} },
  inputs: {},
  outputs: {},
  enabled,
})

const baseContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext =>
  ({
    workflowId: 'wf',
    blockStates: new Map(),
    blockLogs: [],
    metadata: { duration: 0 },
    environmentVariables: {},
    decisions: { router: new Map(), condition: new Map() },
    loopIterations: new Map(),
    loopItems: new Map(),
    completedLoops: new Set(),
    executedBlocks: new Set(),
    activeExecutionPath: new Set(),
    ...overrides,
  }) as ExecutionContext

describe('PathTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isInActivePath', () => {
    it('returns true when the block is already in the active path', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('a', 'generic')],
        connections: [],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({ activeExecutionPath: new Set(['a']) })

      expect(tracker.isInActivePath('a', context)).toBe(true)
    })

    it('returns false when block has no incoming connections and is not in the active path', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('a', 'generic')],
        connections: [],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext()

      expect(tracker.isInActivePath('a', context)).toBe(false)
    })

    it('returns true when an active, executed regular source connects to the block', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('src', 'generic'), makeBlock('tgt', 'generic')],
        connections: [{ source: 'src', target: 'tgt' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        activeExecutionPath: new Set(['src']),
        executedBlocks: new Set(['src']),
      })

      expect(tracker.isInActivePath('tgt', context)).toBe(true)
    })

    it('returns false when regular source is not executed yet', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('src', 'generic'), makeBlock('tgt', 'generic')],
        connections: [{ source: 'src', target: 'tgt' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({ activeExecutionPath: new Set(['src']) })

      expect(tracker.isInActivePath('tgt', context)).toBe(false)
    })

    it('honors router selection when source is a router block', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('r', 'router'), makeBlock('a', 'generic'), makeBlock('b', 'generic')],
        connections: [
          { source: 'r', target: 'a' },
          { source: 'r', target: 'b' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const decisions = { router: new Map([['r', 'a']]), condition: new Map() }
      const context = baseContext({
        executedBlocks: new Set(['r']),
        decisions,
      })

      expect(tracker.isInActivePath('a', context)).toBe(true)
      expect(tracker.isInActivePath('b', context)).toBe(false)
    })

    it('returns false for router targets when router has not executed yet', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('r', 'router'), makeBlock('a', 'generic')],
        connections: [{ source: 'r', target: 'a' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        decisions: { router: new Map([['r', 'a']]), condition: new Map() },
      })

      expect(tracker.isInActivePath('a', context)).toBe(false)
    })

    it('honors condition selection when source is a condition block', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('c', 'condition'), makeBlock('a', 'generic'), makeBlock('b', 'generic')],
        connections: [
          { source: 'c', target: 'a', sourceHandle: 'condition-yes' },
          { source: 'c', target: 'b', sourceHandle: 'condition-no' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        executedBlocks: new Set(['c']),
        decisions: { router: new Map(), condition: new Map([['c', 'yes']]) },
      })

      expect(tracker.isInActivePath('a', context)).toBe(true)
      expect(tracker.isInActivePath('b', context)).toBe(false)
    })

    it('ignores condition handles that do not start with condition-', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('c', 'condition'), makeBlock('a', 'generic')],
        connections: [{ source: 'c', target: 'a', sourceHandle: 'other-handle' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        activeExecutionPath: new Set(['c']),
        executedBlocks: new Set(['c']),
      })

      // Falls through to the regular-source branch for non condition-* handles.
      expect(tracker.isInActivePath('a', context)).toBe(true)
    })
  })

  describe('updateExecutionPaths', () => {
    it('activates the router-selected path and records the decision', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('r', 'router'), makeBlock('a', 'generic'), makeBlock('b', 'generic')],
        connections: [
          { source: 'r', target: 'a' },
          { source: 'r', target: 'b' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          [
            'r',
            {
              output: { response: { selectedPath: { blockId: 'a' } } },
              executed: true,
            } as any,
          ],
        ]),
      })

      tracker.updateExecutionPaths(['r'], context)

      expect(context.decisions.router.get('r')).toBe('a')
      expect(context.activeExecutionPath.has('a')).toBe(true)
      expect(context.activeExecutionPath.has('b')).toBe(false)
    })

    it('no-ops on router with no selected path', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('r', 'router'), makeBlock('a', 'generic')],
        connections: [{ source: 'r', target: 'a' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([['r', { output: { response: {} }, executed: true } as any]]),
      })

      tracker.updateExecutionPaths(['r'], context)

      expect(context.decisions.router.size).toBe(0)
      expect(context.activeExecutionPath.has('a')).toBe(false)
    })

    it('also activates utility-target dependencies of the router selected path', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('r', 'router'), makeBlock('a', 'generic'), makeBlock('util', 'generic')],
        connections: [
          { source: 'r', target: 'a' },
          { source: 'util', target: 'a', targetHandle: 'utility-target' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          [
            'r',
            {
              output: { response: { selectedPath: { blockId: 'a' } } },
              executed: true,
            } as any,
          ],
        ]),
      })

      tracker.updateExecutionPaths(['r'], context)

      expect(context.activeExecutionPath.has('a')).toBe(true)
      expect(context.activeExecutionPath.has('util')).toBe(true)
    })

    it('activates the target of the selected condition', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('c', 'condition'), makeBlock('a', 'generic'), makeBlock('b', 'generic')],
        connections: [
          { source: 'c', target: 'a', sourceHandle: 'condition-yes' },
          { source: 'c', target: 'b', sourceHandle: 'condition-no' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['c', { output: { response: { selectedConditionId: 'yes' } }, executed: true } as any],
        ]),
      })

      tracker.updateExecutionPaths(['c'], context)

      expect(context.decisions.condition.get('c')).toBe('yes')
      expect(context.activeExecutionPath.has('a')).toBe(true)
      expect(context.activeExecutionPath.has('b')).toBe(false)
    })

    it('no-ops when the condition has no selectedConditionId', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('c', 'condition'), makeBlock('a', 'generic')],
        connections: [{ source: 'c', target: 'a', sourceHandle: 'condition-yes' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([['c', { output: { response: {} }, executed: true } as any]]),
      })

      tracker.updateExecutionPaths(['c'], context)

      expect(context.decisions.condition.size).toBe(0)
      expect(context.activeExecutionPath.has('a')).toBe(false)
    })

    it('activates regular outgoing source connections when there is no error', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          makeBlock('src', 'generic'),
          makeBlock('ok', 'generic'),
          makeBlock('err', 'generic'),
        ],
        connections: [
          { source: 'src', target: 'ok', sourceHandle: 'source' },
          { source: 'src', target: 'err', sourceHandle: 'error' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['src', { output: { response: { result: 1 } }, executed: true } as any],
        ]),
      })

      tracker.updateExecutionPaths(['src'], context)

      expect(context.activeExecutionPath.has('ok')).toBe(true)
      expect(context.activeExecutionPath.has('err')).toBe(false)
    })

    it('activates the error edge and skips the source edge when the block errored', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          makeBlock('src', 'generic'),
          makeBlock('ok', 'generic'),
          makeBlock('err', 'generic'),
        ],
        connections: [
          { source: 'src', target: 'ok', sourceHandle: 'source' },
          { source: 'src', target: 'err', sourceHandle: 'error' },
        ],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['src', { output: { error: 'nope', response: {} }, executed: true } as any],
        ]),
      })

      tracker.updateExecutionPaths(['src'], context)

      expect(context.activeExecutionPath.has('ok')).toBe(false)
      expect(context.activeExecutionPath.has('err')).toBe(true)
    })

    it('detects errors nested inside response.error', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('src', 'generic'), makeBlock('err', 'generic')],
        connections: [{ source: 'src', target: 'err', sourceHandle: 'error' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['src', { output: { response: { error: 'boom' } }, executed: true } as any],
        ]),
      })

      tracker.updateExecutionPaths(['src'], context)

      expect(context.activeExecutionPath.has('err')).toBe(true)
    })

    it('skips internal loop connections so the LoopManager can handle them', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('loopBlock', 'generic'), makeBlock('nextInLoop', 'generic')],
        connections: [{ source: 'loopBlock', target: 'nextInLoop', sourceHandle: 'source' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['loopBlock', { output: { response: { ok: true } }, executed: true } as any],
        ]),
        workflow: {
          ...workflow,
          loops: { loop1: { id: 'loop1', nodes: ['loopBlock', 'nextInLoop'], iterations: 3 } },
        },
      })

      tracker.updateExecutionPaths(['loopBlock'], context)

      expect(context.activeExecutionPath.has('nextInLoop')).toBe(false)
    })

    it('skips external loop connections when loops are not completed', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('loopBlock', 'generic'), makeBlock('outside', 'generic')],
        connections: [{ source: 'loopBlock', target: 'outside', sourceHandle: 'source' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['loopBlock', { output: { response: { ok: true } }, executed: true } as any],
        ]),
        workflow: {
          ...workflow,
          loops: { loop1: { id: 'loop1', nodes: ['loopBlock'], iterations: 3 } },
        },
      })

      tracker.updateExecutionPaths(['loopBlock'], context)

      expect(context.activeExecutionPath.has('outside')).toBe(false)
    })

    it('activates external loop connections once all loops are completed', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('loopBlock', 'generic'), makeBlock('outside', 'generic')],
        connections: [{ source: 'loopBlock', target: 'outside', sourceHandle: 'source' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['loopBlock', { output: { response: { ok: true } }, executed: true } as any],
        ]),
        completedLoops: new Set(['loop1']),
        workflow: {
          ...workflow,
          loops: { loop1: { id: 'loop1', nodes: ['loopBlock'], iterations: 3 } },
        },
      })

      tracker.updateExecutionPaths(['loopBlock'], context)

      expect(context.activeExecutionPath.has('outside')).toBe(true)
    })

    it('activates unknown sourceHandle connections unconditionally', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [makeBlock('src', 'generic'), makeBlock('custom', 'generic')],
        connections: [{ source: 'src', target: 'custom', sourceHandle: 'some-other' }],
        loops: {},
      }
      const tracker = new PathTracker(workflow)
      const context = baseContext({
        blockStates: new Map([
          ['src', { output: { response: { ok: true } }, executed: true } as any],
        ]),
      })

      tracker.updateExecutionPaths(['src'], context)

      expect(context.activeExecutionPath.has('custom')).toBe(true)
    })
  })
})
