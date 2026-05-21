import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbeddingService } from '../embedding-service'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/ollama-detection', () => ({
  getOllamaHost: () => 'http://localhost:11434',
}))
vi.mock('@/lib/config/api-endpoints', () => ({
  API_ENDPOINTS: { openai: { embeddings: 'https://api.openai.com/v1/embeddings' } },
}))

type FetchArgs = { url: string; body: any }

describe('EmbeddingService.embedBatch', () => {
  let calls: FetchArgs[]
  let originalFetch: typeof globalThis.fetch
  let originalKey: string | undefined

  beforeEach(() => {
    calls = []
    originalFetch = globalThis.fetch
    originalKey = process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalKey
    }
  })

  function mockOpenAI() {
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      const body = JSON.parse(init.body)
      calls.push({ url: String(url), body })
      const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input]
      // Vector encodes the input string length so we can verify alignment
      const data = inputs.map((t) => ({ embedding: [t.length, 0, 0] }))
      return new Response(JSON.stringify({ data }), { status: 200 })
    }) as any
  }

  function mockOllama() {
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      const body = JSON.parse(init.body)
      calls.push({ url: String(url), body })
      // Encode prompt length so order can be verified; pad later happens in service
      return new Response(
        JSON.stringify({
          embedding: new Array(768).fill(0).map((_, i) => (i === 0 ? body.prompt.length : 0)),
        }),
        { status: 200 }
      )
    }) as any
  }

  it('returns empty array for empty input without calling fetch', async () => {
    globalThis.fetch = vi.fn() as any
    const out = await EmbeddingService.embedBatch([], 'openai-ada-002', 'test-key')
    expect(out).toEqual([])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('batches OpenAI inputs in chunks of openAIBatchSize and preserves order', async () => {
    mockOpenAI()
    const texts = ['a', 'bb', 'ccc', 'dddd', 'eeeee']
    const out = await EmbeddingService.embedBatch(texts, 'openai-ada-002', 'test-key', {
      openAIBatchSize: 2,
    })

    expect(out).toHaveLength(5)
    // First element of each vector encodes original input length -> verifies order
    expect(out.map((v) => v[0])).toEqual([1, 2, 3, 4, 5])

    // ceil(5/2) = 3 batched HTTP calls instead of 5 sequential ones
    expect(calls).toHaveLength(3)
    expect(calls[0].body.input).toEqual(['a', 'bb'])
    expect(calls[1].body.input).toEqual(['ccc', 'dddd'])
    expect(calls[2].body.input).toEqual(['eeeee'])
  })

  it('falls back to Ollama when OpenAI key missing and respects concurrency batching', async () => {
    delete process.env.OPENAI_API_KEY
    mockOllama()
    const texts = ['x', 'yy', 'zzz', 'wwww']
    const out = await EmbeddingService.embedBatch(texts, 'openai-ada-002', undefined, {
      ollamaConcurrency: 2,
    })

    expect(out).toHaveLength(4)
    // Ollama path zero-pads to 1536; first slot encodes prompt length -> verifies order
    expect(out.map((v) => v[0])).toEqual([1, 2, 3, 4])
    expect(out.every((v) => v.length === 1536)).toBe(true)
    // 4 inputs with concurrency 2 -> still 4 fetches, but issued in 2 parallel waves
    expect(calls).toHaveLength(4)
    expect(calls.every((c) => c.url.includes('/api/embeddings'))).toBe(true)
  })

  it('generateEmbeddings delegates to embedBatch', async () => {
    mockOpenAI()
    const out = await EmbeddingService.generateEmbeddings(['hello'], 'openai-ada-002', 'test-key')
    expect(out).toHaveLength(1)
    expect(out[0][0]).toBe(5)
  })
})
