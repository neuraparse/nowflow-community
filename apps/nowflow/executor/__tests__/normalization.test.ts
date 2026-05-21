import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlockLog, normalizeBlockOutput } from '@/executor/normalization'
import { SerializedBlock } from '@/serializer/types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const makeBlock = (id: string, overrides: Partial<SerializedBlock> = {}): SerializedBlock => ({
  id: `${id}-block`,
  metadata: { id, name: `${id} name` },
  position: { x: 0, y: 0 },
  config: { tool: id, params: {} },
  inputs: {},
  outputs: {},
  enabled: true,
  ...overrides,
})

describe('normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizeBlockOutput', () => {
    it('wraps a top-level error output into response + error fields', () => {
      const block = makeBlock('function')
      const output = { error: 'boom', status: 418 }

      const result = normalizeBlockOutput(output, block)

      expect(result).toEqual({
        response: { error: 'boom', status: 418 },
        error: 'boom',
      })
    })

    it('defaults status to 500 when missing from an error output', () => {
      const block = makeBlock('function')
      const result = normalizeBlockOutput({ error: 'nope' }, block)

      expect(result.response.status).toBe(500)
      expect(result.error).toBe('nope')
    })

    it('passes through outputs that already have a response and propagates response.error', () => {
      const block = makeBlock('api')
      const output = { response: { error: 'auth', status: 401 } }

      const result = normalizeBlockOutput(output, block)

      expect(result.error).toBe('auth')
      expect(result.response).toEqual({ error: 'auth', status: 401 })
    })

    it('passes through outputs that already have a response without error untouched', () => {
      const block = makeBlock('api')
      const output = { response: { data: { ok: true }, status: 200, headers: {} } }

      const result = normalizeBlockOutput(output, block)

      expect(result).toBe(output as any)
    })

    it('returns the raw output unchanged for agent blocks', () => {
      const block = makeBlock('agent')
      const output = { content: 'hi', model: 'gpt', extra: true }

      const result = normalizeBlockOutput(output, block)

      expect(result).toBe(output as any)
    })

    it('normalizes router outputs with defaults when selectedPath missing', () => {
      const block = makeBlock('router')

      const result = normalizeBlockOutput({}, block)

      expect(result.response.content).toBe('')
      expect(result.response.model).toBe('')
      expect(result.response.tokens).toEqual({ prompt: 0, completion: 0, total: 0 })
      expect(result.response.selectedPath).toEqual({
        blockId: '',
        blockType: '',
        blockTitle: '',
      })
    })

    it('normalizes router outputs and preserves selectedPath when provided', () => {
      const block = makeBlock('router')
      const selectedPath = { blockId: 'b1', blockType: 'agent', blockTitle: 'Agent' }

      const result = normalizeBlockOutput({ selectedPath }, block)

      expect(result.response.selectedPath).toEqual(selectedPath)
    })

    it('normalizes condition outputs when response wrapper already exists', () => {
      const block = makeBlock('condition')
      const output = {
        response: {
          conditionResult: true,
          selectedPath: { blockId: 'tgt', blockType: 'agent', blockTitle: 'Agent' },
          selectedConditionId: 'cond-1',
          extra: 'keep',
        },
      }

      const result = normalizeBlockOutput(output, block)

      // Because response was already present, the early pass-through returns it as-is.
      expect(result.response.conditionResult).toBe(true)
      expect(result.response.selectedConditionId).toBe('cond-1')
      expect(result.response.selectedPath).toEqual({
        blockId: 'tgt',
        blockType: 'agent',
        blockTitle: 'Agent',
      })
      expect(result.response.extra).toBe('keep')
    })

    it('normalizes condition outputs from raw fields with defaults', () => {
      const block = makeBlock('condition')

      const result = normalizeBlockOutput({}, block)

      expect(result.response.conditionResult).toBe(false)
      expect(result.response.selectedConditionId).toBe('')
      expect(result.response.selectedPath).toEqual({
        blockId: '',
        blockType: '',
        blockTitle: '',
      })
    })

    it('normalizes condition outputs with raw values', () => {
      const block = makeBlock('condition')
      const raw = {
        conditionResult: true,
        selectedConditionId: 'c-2',
        selectedPath: { blockId: 'x', blockType: 'api', blockTitle: 'API' },
      }

      const result = normalizeBlockOutput(raw, block)

      expect(result.response.conditionResult).toBe(true)
      expect(result.response.selectedConditionId).toBe('c-2')
      expect(result.response.selectedPath).toEqual(raw.selectedPath)
    })

    it('normalizes function outputs with defaults', () => {
      const block = makeBlock('function')

      const result = normalizeBlockOutput({}, block)

      expect(result.response).toEqual({
        result: undefined,
        stdout: '',
        executionTime: 0,
      })
    })

    it('normalizes function outputs preserving provided fields', () => {
      const block = makeBlock('function')

      const result = normalizeBlockOutput(
        { result: 42, stdout: 'logged', executionTime: 12 },
        block
      )

      expect(result.response).toEqual({
        result: 42,
        stdout: 'logged',
        executionTime: 12,
      })
    })

    it('normalizes api outputs with defaults', () => {
      const block = makeBlock('api')

      const result = normalizeBlockOutput({}, block)

      expect(result.response).toEqual({
        data: undefined,
        status: 0,
        headers: {},
      })
    })

    it('normalizes api outputs with provided values', () => {
      const block = makeBlock('api')
      const raw = { data: { ok: true }, status: 200, headers: { 'x-a': '1' } }

      const result = normalizeBlockOutput(raw, block)

      expect(result.response).toEqual(raw)
    })

    it('normalizes evaluator outputs and preserves extra keys', () => {
      const block = makeBlock('evaluator')
      const raw = { content: 'answer', model: 'gpt-x', score: 0.9, nested: { foo: 1 } }

      const result = normalizeBlockOutput(raw, block)

      expect(result.response.content).toBe('answer')
      expect(result.response.model).toBe('gpt-x')
      expect(result.response.score).toBe(0.9)
      expect(result.response.nested).toEqual({ foo: 1 })
    })

    it('normalizes evaluator outputs with defaults when empty', () => {
      const block = makeBlock('evaluator')

      const result = normalizeBlockOutput(null, block)

      expect(result.response).toEqual({ content: '', model: '' })
    })

    it('wraps unknown block type outputs under response.result', () => {
      const block = makeBlock('generic')

      const result = normalizeBlockOutput('raw value', block)

      expect(result.response).toEqual({ result: 'raw value' })
    })

    it('wraps output under response.result when block metadata is missing', () => {
      const block = makeBlock('starter', { metadata: undefined })

      const result = normalizeBlockOutput({ foo: 'bar' }, block)

      expect(result.response).toEqual({ result: { foo: 'bar' } })
    })
  })

  describe('createBlockLog', () => {
    it('creates a log entry with block name, type, and start timestamp', () => {
      const block = makeBlock('function', {
        id: 'fn-1',
        metadata: { id: 'function', name: 'My Function' },
      })

      const log = createBlockLog(block)

      expect(log.blockId).toBe('fn-1')
      expect(log.blockName).toBe('My Function')
      expect(log.blockType).toBe('function')
      expect(log.endedAt).toBe('')
      expect(log.durationMs).toBe(0)
      expect(log.success).toBe(false)
      expect(() => new Date(log.startedAt).toISOString()).not.toThrow()
      expect(new Date(log.startedAt).toISOString()).toBe(log.startedAt)
    })

    it('defaults blockName and blockType to empty strings when metadata missing', () => {
      const block = makeBlock('anything', { id: 'no-meta', metadata: undefined })

      const log = createBlockLog(block)

      expect(log.blockId).toBe('no-meta')
      expect(log.blockName).toBe('')
      expect(log.blockType).toBe('')
    })
  })
})
