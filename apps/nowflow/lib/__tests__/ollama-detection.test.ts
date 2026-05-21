import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectOllamaConfig, getOllamaHost, isOllamaAvailable } from '@/lib/ollama-detection'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/config/api-endpoints', () => ({
  OLLAMA_DEFAULT_HOST: 'http://localhost:11434',
}))

const originalEnv = { ...process.env }
const originalFetch = global.fetch

describe('ollama-detection', () => {
  beforeEach(() => {
    // Reset relevant env vars before each test
    delete process.env.OLLAMA_HOST
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...originalEnv }
    global.fetch = originalFetch
    vi.restoreAllMocks()
    // Ensure we stay in a non-browser env

    delete (globalThis as any).window
  })

  describe('getOllamaHost', () => {
    it('returns OLLAMA_HOST env var when set (highest priority)', () => {
      process.env.OLLAMA_HOST = 'http://custom-ollama:9999'
      expect(getOllamaHost()).toBe('http://custom-ollama:9999')
    })

    it('returns localhost when NODE_ENV=production and OLLAMA_HOST is not set', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(getOllamaHost()).toBe('http://localhost:11434')
    })

    it('defaults to localhost for local development', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(getOllamaHost()).toBe('http://localhost:11434')
    })
  })

  describe('detectOllamaConfig', () => {
    it('returns environment=local when localhost responds', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === 'http://localhost:11434/api/version') {
          return {
            ok: true,
            json: async () => ({ version: '0.2.0' }),
          }
        }
        throw new Error('connect ECONNREFUSED')
      })
      global.fetch = mockFetch as any

      const config = await detectOllamaConfig()
      expect(config.isAvailable).toBe(true)
      expect(config.environment).toBe('local')
      expect(config.host).toBe('http://localhost:11434')
      expect(config.version).toBe('0.2.0')
    })

    it('returns isAvailable=false when every host refuses connection', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
      global.fetch = mockFetch as any

      const config = await detectOllamaConfig()
      expect(config.isAvailable).toBe(false)
      expect(config.host).toBe('')
      expect(config.environment).toBe('none')
      expect(config.version).toBeUndefined()
    })

    it('returns isAvailable=false when every host aborts (timeout)', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        throw error
      })
      global.fetch = mockFetch as any

      const config = await detectOllamaConfig()
      expect(config.isAvailable).toBe(false)
      expect(config.environment).toBe('none')
    })

    it('treats non-ok responses as unavailable and tries the next host', async () => {
      const mockFetch = vi
        .fn()
        .mockImplementationOnce(async () => ({ ok: false, status: 500 }))
        .mockImplementationOnce(async () => ({
          ok: true,
          json: async () => ({ version: '9.9.9' }),
        }))
      global.fetch = mockFetch as any

      const config = await detectOllamaConfig()
      expect(config.isAvailable).toBe(true)
      // First host returned 500, second local fallback succeeded
      expect(config.host).toBe('http://127.0.0.1:11434')
      expect(config.environment).toBe('local')
      expect(config.version).toBe('9.9.9')
    })

    it('iterates through local hosts when none respond', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
      global.fetch = mockFetch as any

      await detectOllamaConfig()
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const urls = mockFetch.mock.calls.map((call) => call[0])
      expect(urls).toContain('http://localhost:11434/api/version')
      expect(urls).toContain('http://127.0.0.1:11434/api/version')
    })
  })

  describe('isOllamaAvailable (server-side)', () => {
    it('returns true when server-side detection succeeds', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ version: '0.1.0' }),
      }))
      global.fetch = mockFetch as any

      const available = await isOllamaAvailable()
      expect(available).toBe(true)
    })

    it('returns false when server-side detection fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
      global.fetch = mockFetch as any

      const available = await isOllamaAvailable()
      expect(available).toBe(false)
    })
  })

  describe('isOllamaAvailable (client-side)', () => {
    beforeEach(() => {
      // Simulate browser environment

      ;(globalThis as any).window = {}
    })

    afterEach(() => {
      delete (globalThis as any).window
    })

    it('calls /api/ollama/status and returns true when available', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({ available: true }),
      })
      global.fetch = mockFetch as any

      const available = await isOllamaAvailable()
      expect(mockFetch).toHaveBeenCalledWith('/api/ollama/status')
      expect(available).toBe(true)
    })

    it('returns false when /api/ollama/status says not available', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({ available: false }),
      })
      global.fetch = mockFetch as any

      const available = await isOllamaAvailable()
      expect(available).toBe(false)
    })

    it('returns false when client fetch throws', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network down'))
      global.fetch = mockFetch as any

      const available = await isOllamaAvailable()
      expect(available).toBe(false)
    })
  })
})
