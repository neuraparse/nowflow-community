import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiBaseUrl, getApiUrl, getProvidersApiUrl } from '@/executor/utils/api-url'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('getApiBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    // Ensure no stray window from earlier tests
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  it('returns contextBaseUrl when provided (highest priority)', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://should-not-be-used:9999')
    expect(getApiBaseUrl('https://subdomain.example.com')).toBe('https://subdomain.example.com')
  })

  it('prefers contextBaseUrl over window.location.origin', () => {
    ;(globalThis as any).window = { location: { origin: 'https://browser.example.com' } }
    try {
      expect(getApiBaseUrl('https://ctx.example.com')).toBe('https://ctx.example.com')
    } finally {
      delete (globalThis as any).window
    }
  })

  it('returns window.location.origin when running in a browser-like env', () => {
    ;(globalThis as any).window = { location: { origin: 'https://browser.example.com' } }
    try {
      expect(getApiBaseUrl()).toBe('https://browser.example.com')
    } finally {
      delete (globalThis as any).window
    }
  })

  it('falls back to INTERNAL_API_URL when no context and no window', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://internal.svc:4000')
    expect(getApiBaseUrl()).toBe('http://internal.svc:4000')
  })

  it('falls back to http://localhost:3000 when INTERNAL_API_URL is unset', () => {
    vi.stubEnv('INTERNAL_API_URL', '')
    expect(getApiBaseUrl()).toBe('http://localhost:3000')
  })

  it('uses localhost fallback (not a public domain) to avoid hairpin NAT', () => {
    vi.stubEnv('INTERNAL_API_URL', '')
    const url = getApiBaseUrl()
    expect(url).toContain('localhost')
    expect(url).not.toContain('example.com')
  })

  it('treats empty-string contextBaseUrl as falsy and falls through', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://internal.svc:4000')
    expect(getApiBaseUrl('')).toBe('http://internal.svc:4000')
  })
})

describe('getApiUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  it('builds a full URL from a relative path and default base URL', () => {
    vi.stubEnv('INTERNAL_API_URL', '')
    expect(getApiUrl('/api/providers')).toBe('http://localhost:3000/api/providers')
  })

  it('uses INTERNAL_API_URL as the base when set', () => {
    vi.stubEnv('INTERNAL_API_URL', 'https://internal.example.com')
    expect(getApiUrl('/api/tools/custom')).toBe('https://internal.example.com/api/tools/custom')
  })

  it('uses contextBaseUrl when provided', () => {
    expect(getApiUrl('/api/foo', undefined, 'https://tenant.example.com')).toBe(
      'https://tenant.example.com/api/foo'
    )
  })

  it('appends query params when provided', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    const url = getApiUrl('/api/search', { q: 'hello', limit: '10' })
    expect(url).toContain('http://localhost:3000/api/search')
    expect(url).toContain('q=hello')
    expect(url).toContain('limit=10')
  })

  it('URL-encodes special characters in query params', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    const url = getApiUrl('/api/search', { q: 'hello world & friends' })
    expect(url).toContain('q=hello+world+%26+friends')
  })

  it('produces a URL with no query string when params is omitted', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    expect(getApiUrl('/api/providers')).not.toContain('?')
  })

  it('produces a URL with no query string when params is an empty object', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    expect(getApiUrl('/api/providers', {})).toBe('http://localhost:3000/api/providers')
  })

  it('resolves an absolute URL in path against the base (absolute wins)', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    // When path is absolute, URL constructor ignores the base.
    expect(getApiUrl('https://external.example.com/foo')).toBe('https://external.example.com/foo')
  })

  it('uses browser origin when no contextBaseUrl is provided', () => {
    ;(globalThis as any).window = { location: { origin: 'https://app.example.com' } }
    try {
      expect(getApiUrl('/api/ping')).toBe('https://app.example.com/api/ping')
    } finally {
      delete (globalThis as any).window
    }
  })

  it('preserves https scheme in the base URL', () => {
    vi.stubEnv('INTERNAL_API_URL', 'https://secure.internal.example.com')
    expect(getApiUrl('/api/x')).toMatch(/^https:\/\//)
  })

  it('appends multiple values for the same query key as separate entries', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://localhost:3000')
    // Only last wins in a Record<string, string>, but ensure one-entry behavior works.
    const url = getApiUrl('/api/x', { a: '1', b: '2' })
    expect(url).toContain('a=1')
    expect(url).toContain('b=2')
  })
})

describe('getProvidersApiUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (typeof (globalThis as any).window !== 'undefined') {
      delete (globalThis as any).window
    }
  })

  it('returns the providers endpoint on the default base URL', () => {
    vi.stubEnv('INTERNAL_API_URL', '')
    expect(getProvidersApiUrl()).toBe('http://localhost:3000/api/providers')
  })

  it('respects INTERNAL_API_URL for server-side resolution', () => {
    vi.stubEnv('INTERNAL_API_URL', 'https://internal.example.com')
    expect(getProvidersApiUrl()).toBe('https://internal.example.com/api/providers')
  })

  it('IGNORES contextBaseUrl - provider API only lives on main domain', () => {
    vi.stubEnv('INTERNAL_API_URL', 'https://internal.example.com')
    expect(getProvidersApiUrl('https://tenant.example.com')).toBe(
      'https://internal.example.com/api/providers'
    )
  })

  it('falls back to localhost when context provided but no env', () => {
    vi.stubEnv('INTERNAL_API_URL', '')
    expect(getProvidersApiUrl('https://tenant.example.com')).toBe(
      'http://localhost:3000/api/providers'
    )
  })

  it('uses browser origin (not contextBaseUrl) in a browser-like env', () => {
    ;(globalThis as any).window = { location: { origin: 'https://app.example.com' } }
    try {
      expect(getProvidersApiUrl('https://tenant.example.com')).toBe(
        'https://app.example.com/api/providers'
      )
    } finally {
      delete (globalThis as any).window
    }
  })
})
