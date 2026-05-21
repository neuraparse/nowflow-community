import { describe, expect, it } from 'vitest'
import {
  BlockLogSchema,
  BlockStateSchema,
  ExecutionContextSchema,
  ExecutionMetadataSchema,
  ExecutionResultSchema,
  NormalizedBlockOutputSchema,
  WorkflowEdgeConnectionSchema,
} from '../src/execution'

const normalizedOutput = {
  response: { content: 'hello' },
}

describe('NormalizedBlockOutputSchema', () => {
  it('parses a minimal output', () => {
    const parsed = NormalizedBlockOutputSchema.parse(normalizedOutput)
    expect(parsed.response.content).toBe('hello')
  })

  it('parses an output with error', () => {
    const parsed = NormalizedBlockOutputSchema.parse({
      response: { content: '' },
      error: 'timeout',
    })
    expect(parsed.error).toBe('timeout')
  })

  it('parses without error (error is optional)', () => {
    const parsed = NormalizedBlockOutputSchema.parse({ response: {} })
    expect(parsed.error).toBeUndefined()
  })

  it('allows catchall extra fields on response', () => {
    const parsed = NormalizedBlockOutputSchema.parse({
      response: { content: 'x', custom: { foo: 1 } },
    })
    // Catchall allows arbitrary extras to survive parsing.
    expect((parsed.response as any).custom).toEqual({ foo: 1 })
  })

  it('rejects a missing `response` envelope', () => {
    expect(NormalizedBlockOutputSchema.safeParse({}).success).toBe(false)
  })

  it('accepts nested token counts', () => {
    const parsed = NormalizedBlockOutputSchema.parse({
      response: { tokens: { prompt: 10, completion: 5, total: 15 } },
    })
    expect(parsed.response.tokens?.total).toBe(15)
  })
})

describe('BlockLogSchema timing fields', () => {
  it('requires startedAt, endedAt, durationMs, success, blockId', () => {
    const parsed = BlockLogSchema.parse({
      blockId: 'b1',
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: '2026-01-01T00:00:01Z',
      durationMs: 1000,
      success: true,
    })
    expect(parsed.durationMs).toBe(1000)
  })

  it('fails when durationMs is missing', () => {
    expect(
      BlockLogSchema.safeParse({
        blockId: 'b1',
        startedAt: 'a',
        endedAt: 'b',
        success: true,
      }).success
    ).toBe(false)
  })

  it('fails when success is missing', () => {
    expect(
      BlockLogSchema.safeParse({
        blockId: 'b1',
        startedAt: 'a',
        endedAt: 'b',
        durationMs: 0,
      }).success
    ).toBe(false)
  })

  it('accepts an error field on a failed log', () => {
    const parsed = BlockLogSchema.parse({
      blockId: 'b1',
      startedAt: 'a',
      endedAt: 'b',
      durationMs: 10,
      success: false,
      error: 'boom',
    })
    expect(parsed.error).toBe('boom')
  })
})

describe('BlockStateSchema', () => {
  it('parses a block state', () => {
    const parsed = BlockStateSchema.parse({
      output: normalizedOutput,
      executed: true,
      executionTime: 42,
    })
    expect(parsed.executed).toBe(true)
  })
})

describe('WorkflowEdgeConnectionSchema', () => {
  it('parses the pick() projection of an edge', () => {
    const parsed = WorkflowEdgeConnectionSchema.parse({
      source: 'a',
      target: 'b',
      sourceHandle: null,
      targetHandle: null,
    })
    expect(parsed.source).toBe('a')
  })
})

describe('ExecutionMetadataSchema', () => {
  it('requires duration', () => {
    expect(ExecutionMetadataSchema.safeParse({}).success).toBe(false)
    expect(ExecutionMetadataSchema.safeParse({ duration: 0 }).success).toBe(true)
  })
})

describe('ExecutionContextSchema', () => {
  it('parses a minimal valid context', () => {
    const parsed = ExecutionContextSchema.parse({
      workflowId: 'w1',
      blockStates: {},
      blockLogs: [],
      metadata: { duration: 0 },
      environmentVariables: {},
      decisions: { router: {}, condition: {} },
      loopIterations: {},
      loopItems: {},
      completedLoops: [],
      executedBlocks: [],
      activeExecutionPath: [],
    })
    expect(parsed.workflowId).toBe('w1')
  })

  it('fails when workflowId is missing', () => {
    expect(
      ExecutionContextSchema.safeParse({
        blockStates: {},
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: {}, condition: {} },
        loopIterations: {},
        loopItems: {},
        completedLoops: [],
        executedBlocks: [],
        activeExecutionPath: [],
      }).success
    ).toBe(false)
  })
})

describe('ExecutionResultSchema', () => {
  it('parses a successful result', () => {
    const parsed = ExecutionResultSchema.parse({
      success: true,
      output: normalizedOutput,
    })
    expect(parsed.success).toBe(true)
  })

  it('parses a failed result with error', () => {
    const parsed = ExecutionResultSchema.parse({
      success: false,
      output: normalizedOutput,
      error: 'boom',
    })
    expect(parsed.error).toBe('boom')
  })
})
