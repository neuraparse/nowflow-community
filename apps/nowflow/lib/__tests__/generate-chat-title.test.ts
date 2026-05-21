import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateChatTitle } from '@/lib/generate-chat-title'

const { createMock, openaiConstructorMock } = vi.hoisted(() => {
  const createMock = vi.fn()
  const openaiConstructorMock = vi.fn(function OpenAI(this: any) {
    this.chat = {
      completions: {
        create: createMock,
      },
    }
  })
  return { createMock, openaiConstructorMock }
})

vi.mock('openai', () => ({
  default: openaiConstructorMock,
}))

vi.mock('@/lib/ai/provider-config', () => ({
  getDefaultModel: (provider: string) => `mock-model-${provider}`,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const originalEnv = { ...process.env }

describe('generateChatTitle', () => {
  beforeEach(() => {
    createMock.mockReset()
    openaiConstructorMock.mockClear()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns null when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY

    const result = await generateChatTitle('Hello, how are you?')
    expect(result).toBeNull()
    expect(openaiConstructorMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns the trimmed title from the AI response when API key is set', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '  Weekly Recap  ' } }],
    })

    const result = await generateChatTitle('Give me the weekly recap')
    expect(result).toBe('Weekly Recap')
    expect(openaiConstructorMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      dangerouslyAllowBrowser: true,
    })
  })

  it('passes expected model and prompt parameters to OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'Quick Title' } }],
    })

    await generateChatTitle('Some first message')

    expect(createMock).toHaveBeenCalledTimes(1)
    const args = createMock.mock.calls[0][0]
    expect(args.model).toBe('mock-model-openai')
    expect(args.max_tokens).toBe(20)
    expect(args.temperature).toBe(0.7)
    expect(args.messages).toHaveLength(2)
    expect(args.messages[0].role).toBe('system')
    expect(args.messages[1]).toEqual({ role: 'user', content: 'Some first message' })
  })

  it('returns null when the API response has no content', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    })

    const result = await generateChatTitle('Hello')
    expect(result).toBeNull()
  })

  it('returns null when choices array is empty', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    createMock.mockResolvedValueOnce({ choices: [] })

    const result = await generateChatTitle('Hello')
    expect(result).toBeNull()
  })

  it('returns null when the OpenAI SDK throws', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    createMock.mockRejectedValueOnce(new Error('rate limited'))

    const result = await generateChatTitle('Hello')
    expect(result).toBeNull()
  })
})
