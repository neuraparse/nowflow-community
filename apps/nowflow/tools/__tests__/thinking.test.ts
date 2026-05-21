import { describe, expect, it, vi } from 'vitest'
import { thinkingTool } from '../thinking/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('thinkingTool config', () => {
  it('has expected metadata', () => {
    expect(thinkingTool.id).toBe('thinking_tool')
    expect(thinkingTool.name).toBe('Thinking Tool')
    expect(thinkingTool.request.isInternalRoute).toBe(true)
    expect(thinkingTool.request.url).toBe('/api/ai/thinking')
    expect(thinkingTool.request.method).toBe('POST')
  })

  it('declares expected params', () => {
    const names = Object.keys(thinkingTool.params)
    expect(names).toEqual(
      expect.arrayContaining([
        'prompt',
        'systemPrompt',
        'model',
        'apiKey',
        'thinkingBudget',
        'showThinkingProcess',
        'thought',
      ])
    )
  })

  it('returns JSON content-type headers', () => {
    const headers = thinkingTool.request.headers({} as any)
    expect(headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('thinkingTool request.body', () => {
  const body = (thinkingTool.request as any).body

  it('uses legacy acknowledgment mode when only `thought` is given', () => {
    const result = body({ thought: 'just thinking' })
    expect(result).toMatchObject({
      prompt: 'just thinking',
      model: '__legacy__',
      apiKey: '__legacy__',
      legacyMode: true,
    })
  })

  it('maps prompt/model/apiKey for real calls', () => {
    const result = body({
      prompt: 'solve 2+2',
      model: 'claude-opus-4-6',
      apiKey: 'key-abc',
      thinkingBudget: 2048,
      showThinkingProcess: false,
    })
    expect(result.prompt).toBe('solve 2+2')
    expect(result.model).toBe('claude-opus-4-6')
    expect(result.apiKey).toBe('key-abc')
    expect(result.thinkingBudget).toBe(2048)
    expect(result.showThinkingProcess).toBe(false)
  })

  it('falls back from thought to prompt when no model specified', () => {
    const result = body({
      thought: 'legacy text',
      prompt: 'new text',
      model: 'claude-sonnet-4-6',
      apiKey: 'key-abc',
    })
    expect(result.prompt).toBe('new text')
  })

  it('defaults thinkingBudget to 5000', () => {
    const result = body({
      prompt: 'a',
      model: 'claude-sonnet-4-6',
      apiKey: 'tool-key',
    })
    expect(result.thinkingBudget).toBe(5000)
  })

  it('defaults showThinkingProcess to true', () => {
    const result = body({
      prompt: 'a',
      model: 'claude-sonnet-4-6',
      apiKey: 'tool-key',
    })
    expect(result.showThinkingProcess).toBe(true)
  })
})

describe('thinkingTool transformResponse', () => {
  const transform = thinkingTool.transformResponse!

  it('returns success output on ok response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        thinkingContent: '...',
        response: 'the answer is 4',
        model: 'claude-opus-4-6',
        tokens: { prompt: 10, completion: 5, total: 15 },
      }),
    } as unknown as Response

    const result = await transform(mockResponse)
    expect(result.success).toBe(true)
    expect(result.output.response).toBe('the answer is 4')
    expect(result.output.model).toBe('claude-opus-4-6')
    expect(result.output.thinkingContent).toBe('...')
    expect(result.output.acknowledgedThought).toBe('the answer is 4')
  })

  it('returns failure output on error response', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit' }),
    } as unknown as Response

    const result = await transform(mockResponse)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Rate limit')
    expect(result.output.response).toBe('')
  })
})
