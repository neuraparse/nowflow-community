/**
 * Tests for Phase -1 S4: OAuth token endpoint MUST require a session and MUST
 * reject client-supplied redirect URIs that are not on the server-side
 * allowlist.
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest } from '@/app/api/__test-utils__/utils'

describe('OAuth token endpoint - session requirement and redirect allowlist', () => {
  const mockGetSession = vi.fn()
  const mockGetCredential = vi.fn()
  const mockRefreshTokenIfNeeded = vi.fn()
  const mockIsAllowedRedirectUri = vi.fn()

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }

  const mockUUID = 'mock-uuid-12345678-90ab-cdef-1234-567890abcdef'

  beforeEach(() => {
    vi.resetModules()

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(mockUUID),
    })

    vi.doMock('@/lib/auth', () => ({
      getSession: mockGetSession,
    }))

    vi.doMock('../../utils', () => ({
      getCredential: mockGetCredential,
      refreshTokenIfNeeded: mockRefreshTokenIfNeeded,
      getUserId: vi.fn(),
    }))

    vi.doMock('@/lib/oauth/redirect-allowlist', () => ({
      isAllowedRedirectUri: mockIsAllowedRedirectUri,
    }))

    vi.doMock('@/lib/logs/console-logger', () => ({
      createLogger: vi.fn().mockReturnValue(mockLogger),
    }))

    // Minimal db mock so importing the route does not explode; the workflow
    // ownership path is not exercised by these tests.
    vi.doMock('@/db', () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      },
    }))

    vi.doMock('@/db/schema', () => ({
      workflow: {},
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('POST returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const req = createMockRequest('POST', { credentialId: 'credential-id' })

    const { POST } = await import('../route')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error')
    expect(mockGetCredential).not.toHaveBeenCalled()
    expect(mockRefreshTokenIfNeeded).not.toHaveBeenCalled()
  })

  it('POST returns 401 when session has no user id', async () => {
    mockGetSession.mockResolvedValueOnce({ user: {} })

    const req = createMockRequest('POST', { credentialId: 'credential-id' })

    const { POST } = await import('../route')
    const response = await POST(req)

    expect(response.status).toBe(401)
    expect(mockGetCredential).not.toHaveBeenCalled()
  })

  it('POST returns 400 for disallowed redirect URI even when authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockIsAllowedRedirectUri.mockReturnValueOnce(false)

    const req = createMockRequest('POST', {
      credentialId: 'credential-id',
      redirectUri: 'https://evil.com/callback',
    })

    const { POST } = await import('../route')
    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/redirect/i)
    expect(mockIsAllowedRedirectUri).toHaveBeenCalledWith('https://evil.com/callback')
    expect(mockGetCredential).not.toHaveBeenCalled()
  })

  it('GET returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const req = new Request('http://localhost:3000/api/auth/oauth/token?credentialId=credential-id')

    const { GET } = await import('../route')
    const response = await GET(req as any)

    expect(response.status).toBe(401)
    expect(mockGetCredential).not.toHaveBeenCalled()
  })

  it('GET returns 400 for disallowed redirect URI query param', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockIsAllowedRedirectUri.mockReturnValueOnce(false)

    const req = new Request(
      'http://localhost:3000/api/auth/oauth/token?credentialId=credential-id&redirectUri=https%3A%2F%2Fevil.com%2Fcallback'
    )

    const { GET } = await import('../route')
    const response = await GET(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toMatch(/redirect/i)
    expect(mockIsAllowedRedirectUri).toHaveBeenCalledWith('https://evil.com/callback')
    expect(mockGetCredential).not.toHaveBeenCalled()
  })
})

describe('isAllowedRedirectUri helper', () => {
  beforeEach(() => {
    vi.resetModules()
    // The first describe block doMocks this module; unmock it here so we
    // import the real implementation.
    vi.doUnmock('@/lib/oauth/redirect-allowlist')
  })

  afterEach(() => {
    delete process.env.OAUTH_ALLOWED_REDIRECT_URIS
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.BETTER_AUTH_URL
    vi.clearAllMocks()
  })

  it('rejects empty / invalid URIs', async () => {
    const { isAllowedRedirectUri } = await import('@/lib/oauth/redirect-allowlist')
    expect(isAllowedRedirectUri('')).toBe(false)
    expect(isAllowedRedirectUri('not-a-url')).toBe(false)
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
  })

  it('accepts URIs in OAUTH_ALLOWED_REDIRECT_URIS', async () => {
    process.env.OAUTH_ALLOWED_REDIRECT_URIS =
      'https://app.example.com/callback, https://partner.example.com/cb'
    const { isAllowedRedirectUri } = await import('@/lib/oauth/redirect-allowlist')
    expect(isAllowedRedirectUri('https://app.example.com/callback')).toBe(true)
    expect(isAllowedRedirectUri('https://partner.example.com/cb')).toBe(true)
    expect(isAllowedRedirectUri('https://evil.com/callback')).toBe(false)
  })

  it('accepts same-origin deployment URIs via NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    const { isAllowedRedirectUri } = await import('@/lib/oauth/redirect-allowlist')
    expect(isAllowedRedirectUri('https://app.example.com/any/path')).toBe(true)
    expect(isAllowedRedirectUri('https://other.example.com/path')).toBe(false)
  })
})
