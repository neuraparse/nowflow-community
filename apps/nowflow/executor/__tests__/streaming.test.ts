/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStreamingExecution, processStreamingOutput } from '../streaming'
import { BlockLog, ExecutionContext, StreamingExecution } from '../types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const addConsoleMock = vi.fn()
const updateConsoleMock = vi.fn()

vi.mock('@/stores/panel/console/store', () => ({
  useConsoleStore: {
    getState: () => ({
      addConsole: addConsoleMock,
      updateConsole: updateConsoleMock,
    }),
  },
}))

/**
 * Build a ReadableStream containing a list of string chunks.
 */
const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

/**
 * Drain a stream fully to a string so tests can wait on completion.
 */
const drainStream = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  return result
}

/**
 * Allow all pending microtasks to settle so the backgrounded stream processor
 * inside processStreamingOutput can complete its work.
 */
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

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
  workflow: { version: '1.0', blocks: [], connections: [], loops: {} },
  ...overrides,
})

describe('streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addConsoleMock.mockReset()
    updateConsoleMock.mockReset()
    addConsoleMock.mockImplementation((entry: any) => ({ id: 'console-1', ...entry }))
  })

  describe('isStreamingExecution', () => {
    it('returns false for null and primitives', () => {
      expect(isStreamingExecution(null)).toBe(false)
      expect(isStreamingExecution(undefined)).toBe(false)
      expect(isStreamingExecution('x')).toBe(false)
      expect(isStreamingExecution(123)).toBe(false)
    })

    it('returns false when object is missing stream or execution', () => {
      expect(isStreamingExecution({ stream: {} })).toBe(false)
      expect(isStreamingExecution({ execution: {} })).toBe(false)
      expect(isStreamingExecution({})).toBe(false)
    })

    it('returns true when object has both stream and execution', () => {
      expect(isStreamingExecution({ stream: {}, execution: {} })).toBe(true)
    })
  })

  describe('processStreamingOutput', () => {
    it('pushes execution logs into context.blockLogs', () => {
      const ctx = createContext()
      const streamingOutput: StreamingExecution = {
        stream: streamOf([]),
        execution: {
          success: true,
          output: { response: {} },
          blockId: 'b1',
          logs: [
            {
              blockId: 'b1',
              startedAt: '2024-01-01T00:00:00.000Z',
              endedAt: '2024-01-01T00:00:00.100Z',
              durationMs: 100,
              success: true,
              output: { response: { content: '' } },
            } as BlockLog,
          ],
        },
      }

      const result = processStreamingOutput(streamingOutput, ctx, new Date(), [])

      expect(ctx.blockLogs).toHaveLength(1)
      expect(ctx.blockLogs[0].blockId).toBe('b1')
      expect(result.execution.isStreaming).toBe(true)
      expect(result.execution.success).toBe(true)
      expect(result.execution.logs).toBe(ctx.blockLogs)
    })

    it('falls back to empty response output when executionData.output missing', () => {
      const ctx = createContext()
      const streamingOutput: StreamingExecution = {
        stream: streamOf([]),
        execution: {
          success: false,
          output: undefined as any,
          error: 'oops',
        },
      }

      const result = processStreamingOutput(streamingOutput, ctx, new Date(0), [])

      expect(result.execution.success).toBe(false)
      expect(result.execution.error).toBe('oops')
      expect(result.execution.output).toEqual({ response: {} })
      // No output ⇒ no console entry added
      expect(addConsoleMock).not.toHaveBeenCalled()
    })

    it('adds a console entry and tees the stream when output is present', async () => {
      const ctx = createContext()
      const originalStream = streamOf(['hello ', 'world'])

      const streamingOutput: StreamingExecution = {
        stream: originalStream,
        execution: {
          success: true,
          blockId: 'agent-1',
          blockName: 'Agent',
          blockType: 'agent',
          output: { response: { content: '' } },
          logs: [],
        } as any,
      }

      const result = processStreamingOutput(streamingOutput, ctx, new Date(), [])

      expect(addConsoleMock).toHaveBeenCalledTimes(1)
      const consoleEntry = addConsoleMock.mock.calls[0][0]
      expect(consoleEntry.blockId).toBe('agent-1')
      expect(consoleEntry.blockName).toBe('Agent')
      expect(consoleEntry.blockType).toBe('agent')
      expect(consoleEntry.workflowId).toBe('wf-1')

      // The stream was teed — the returned stream should still be readable
      const returnedText = await drainStream(
        result.execution ? (result as any).stream : result.stream
      )
      expect(returnedText).toBe('hello world')

      // Allow the background reader to finish processing the cloned stream
      await flushMicrotasks()

      // Console should be updated with the full content
      expect(updateConsoleMock).toHaveBeenCalled()
      const updateArgs = updateConsoleMock.mock.calls[0]
      expect(updateArgs[0]).toBe('console-1')
      expect(updateArgs[1].output.response.content).toBe('hello world')

      // Execution data content was also updated
      expect((streamingOutput.execution.output as any).response.content).toBe('hello world')
    })

    it('updates matching block log content when stream finishes', async () => {
      const ctx = createContext()
      ctx.blockLogs.push({
        blockId: 'agent-1',
        startedAt: 's',
        endedAt: 'e',
        durationMs: 0,
        success: true,
        output: { response: { content: '' } },
      } as BlockLog)

      const streamingOutput: StreamingExecution = {
        stream: streamOf(['chunk-a', 'chunk-b']),
        execution: {
          success: true,
          blockId: 'agent-1',
          output: { response: { content: '' } },
          logs: [],
        } as any,
      }

      const result = processStreamingOutput(streamingOutput, ctx, new Date(), [])

      // Drain the returned stream so tee processing completes
      await drainStream(result.stream)
      await flushMicrotasks()

      const log = ctx.blockLogs.find((l) => l.blockId === 'agent-1')
      expect(log?.output?.response?.content).toBe('chunk-achunk-b')
    })

    it('merges execution.output.response into existing log entry without overwriting prior content', () => {
      const ctx = createContext()
      ctx.blockLogs.push({
        blockId: 'agent-1',
        startedAt: 's',
        endedAt: 'e',
        durationMs: 0,
        success: true,
        output: { response: { content: 'prior' } },
      } as BlockLog)

      const streamingOutput: StreamingExecution = {
        stream: streamOf([]),
        execution: {
          success: true,
          blockId: 'agent-1',
          output: {
            response: { content: 'partial', model: 'gpt' },
          },
          logs: [],
        } as any,
      }

      processStreamingOutput(streamingOutput, ctx, new Date(), [])

      const log = ctx.blockLogs.find((l) => l.blockId === 'agent-1')
      // response gets assigned onto log.output.response
      expect(log?.output.response.model).toBe('gpt')
      expect(log?.output.response.content).toBe('partial')
    })

    it('propagates workflow connections into metadata', () => {
      const ctx = createContext()
      const connections = [{ source: 'a', target: 'b' }]

      const streamingOutput: StreamingExecution = {
        stream: streamOf([]),
        execution: {
          success: true,
          output: { response: {} },
        },
      }

      const result = processStreamingOutput(streamingOutput, ctx, new Date(), connections)

      expect(result.execution.metadata?.workflowConnections).toEqual(connections)
      expect(result.execution.metadata?.duration).toBeGreaterThanOrEqual(0)
    })
  })
})
