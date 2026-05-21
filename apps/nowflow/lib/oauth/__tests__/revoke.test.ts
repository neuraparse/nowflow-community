import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { revokeProviderToken } from '../revoke'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.GITHUB_CLIENT_ID = 'gh-id'
  process.env.GITHUB_CLIENT_SECRET = 'gh-secret'
  process.env.X_CLIENT_ID = 'x-id'
  process.env.LINKEDIN_CLIENT_ID = 'li-id'
  process.env.LINKEDIN_CLIENT_SECRET = 'li-secret'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...originalEnv }
})

function mockFetchOk() {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
}

function mockFetch204() {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) })
}

function mockFetchError() {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
}

describe('revokeProviderToken', () => {
  it('returns "skipped" when both tokens are absent', async () => {
    expect(await revokeProviderToken('google', null, null)).toBe('skipped')
  })

  it('returns "skipped" for unknown providers', async () => {
    expect(await revokeProviderToken('does-not-exist', 'access', 'refresh')).toBe('skipped')
  })

  it('hits Google revocation endpoint with form-encoded token', async () => {
    mockFetchOk()
    const result = await revokeProviderToken('google', 'access-tok', 'refresh-tok')
    expect(result).toBe('ok')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/revoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    )
  })

  it('handles google-* prefixed scopes via family normalization', async () => {
    mockFetchOk()
    expect(await revokeProviderToken('google-drive', 'tok', null)).toBe('ok')
    expect(await revokeProviderToken('google-calendar', 'tok', null)).toBe('ok')
  })

  it('GitHub revocation expects 204 No Content; "ok" on 204', async () => {
    mockFetch204()
    const result = await revokeProviderToken('github', 'tok', null)
    expect(result).toBe('ok')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/applications/gh-id/token',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('GitHub returns "failed" on non-204 status', async () => {
    mockFetchOk() // 200, not 204
    expect(await revokeProviderToken('github', 'tok', null)).toBe('failed')
  })

  it('GitHub returns "failed" without client credentials', async () => {
    delete process.env.GITHUB_CLIENT_ID
    expect(await revokeProviderToken('github', 'tok', null)).toBe('failed')
  })

  it('Slack reads { ok: true } from response body', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    expect(await revokeProviderToken('slack', 'slack-token', null)).toBe('ok')
  })

  it('Slack returns "failed" when body says { ok: false }', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: false }) })
    expect(await revokeProviderToken('slack', 'slack-token', null)).toBe('failed')
  })

  it('X (Twitter) prefers refresh token when both are present', async () => {
    mockFetchOk()
    await revokeProviderToken('x', 'access', 'refresh')
    const args = (globalThis.fetch as any).mock.calls[0][1]
    expect(args.body).toContain('token=refresh')
    expect(args.body).toContain('token_type_hint=refresh_token')
  })

  it('X returns "failed" without X_CLIENT_ID', async () => {
    delete process.env.X_CLIENT_ID
    expect(await revokeProviderToken('x', 'tok', null)).toBe('failed')
  })

  it('LinkedIn sends client credentials in form body', async () => {
    mockFetchOk()
    await revokeProviderToken('linkedin', 'tok', null)
    const args = (globalThis.fetch as any).mock.calls[0][1]
    expect(args.body).toContain('client_id=li-id')
    expect(args.body).toContain('client_secret=li-secret')
  })

  it('returns "failed" rather than throwing on network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    expect(await revokeProviderToken('google', 'tok', null)).toBe('failed')
  })

  it('returns "failed" on non-2xx response', async () => {
    mockFetchError()
    expect(await revokeProviderToken('google', 'tok', null)).toBe('failed')
  })
})
