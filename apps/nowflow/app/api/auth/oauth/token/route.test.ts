/**
 * Tests for OAuth token API routes
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest } from '@/app/api/__test-utils__/utils'

describe('OAuth Token API Routes', () => {
  const mockGetSession = vi.fn()
  const mockGetCredential = vi.fn()
  const mockRefreshTokenIfNeeded = vi.fn()
  const mockIsAllowedRedirectUri = vi.fn()
  const mockDbLimit = vi.fn()

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }

  const mockUUID = 'mock-uuid-12345678-90ab-cdef-1234-567890abcdef'
  const mockRequestId = mockUUID.slice(0, 8)

  beforeEach(() => {
    vi.resetModules()

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(mockUUID),
    })

    vi.doMock('@/lib/auth', () => ({
      getSession: mockGetSession,
    }))

    vi.doMock('../utils', () => ({
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

    vi.doMock('@/db', () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: mockDbLimit,
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

  /**
   * POST route tests
   */
  describe('POST handler', () => {
    it('should return access token successfully with session', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        providerId: 'google',
      })
      mockRefreshTokenIfNeeded.mockResolvedValueOnce({
        accessToken: 'fresh-token',
        refreshed: false,
      })

      const req = createMockRequest('POST', { credentialId: 'credential-id' })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accessToken', 'fresh-token')
      expect(mockGetCredential).toHaveBeenCalledWith(mockRequestId, 'credential-id', 'test-user-id')
      expect(mockRefreshTokenIfNeeded).toHaveBeenCalled()
    })

    it('should accept workflowId only when the session user owns that workflow', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'workflow-owner-id' } })
      mockDbLimit.mockResolvedValueOnce([{ userId: 'workflow-owner-id' }])
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        providerId: 'google',
      })
      mockRefreshTokenIfNeeded.mockResolvedValueOnce({
        accessToken: 'fresh-token',
        refreshed: false,
      })

      const req = createMockRequest('POST', {
        credentialId: 'credential-id',
        workflowId: 'workflow-id',
      })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accessToken', 'fresh-token')
      expect(mockGetCredential).toHaveBeenCalledWith(
        mockRequestId,
        'credential-id',
        'workflow-owner-id'
      )
    })

    it('should return 403 when session user does not own supplied workflowId', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'attacker-id' } })
      mockDbLimit.mockResolvedValueOnce([{ userId: 'victim-id' }])

      const req = createMockRequest('POST', {
        credentialId: 'credential-id',
        workflowId: 'victims-workflow',
      })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error')
      expect(mockGetCredential).not.toHaveBeenCalled()
    })

    it('should handle missing credentialId', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })

      const req = createMockRequest('POST', {})

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Credential ID is required')
    })

    it('should return 401 when there is no session', async () => {
      mockGetSession.mockResolvedValueOnce(null)

      const req = createMockRequest('POST', { credentialId: 'credential-id' })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
    })

    it('should return 404 when workflow is not found', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'user-id' } })
      mockDbLimit.mockResolvedValueOnce([])

      const req = createMockRequest('POST', {
        credentialId: 'credential-id',
        workflowId: 'nonexistent-workflow-id',
      })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Workflow not found')
    })

    it('should handle credential not found', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce(undefined)

      const req = createMockRequest('POST', { credentialId: 'nonexistent-credential-id' })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Credential not found')
    })

    it('should handle token refresh failure', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() - 3600 * 1000),
        providerId: 'google',
      })
      mockRefreshTokenIfNeeded.mockRejectedValueOnce(new Error('Refresh failure'))

      const req = createMockRequest('POST', { credentialId: 'credential-id' })

      const { POST } = await import('./route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Failed to refresh access token')
    })
  })

  /**
   * GET route tests
   */
  describe('GET handler', () => {
    it('should return access token successfully', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        providerId: 'google',
      })
      mockRefreshTokenIfNeeded.mockResolvedValueOnce({
        accessToken: 'fresh-token',
        refreshed: false,
      })

      const req = new Request(
        'http://localhost:3000/api/auth/oauth/token?credentialId=credential-id'
      )

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('accessToken', 'fresh-token')
      expect(mockGetCredential).toHaveBeenCalledWith(mockRequestId, 'credential-id', 'test-user-id')
    })

    it('should handle missing credentialId', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })

      const req = new Request('http://localhost:3000/api/auth/oauth/token')

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Credential ID is required')
    })

    it('should return 401 when there is no session', async () => {
      mockGetSession.mockResolvedValueOnce(null)

      const req = new Request(
        'http://localhost:3000/api/auth/oauth/token?credentialId=credential-id'
      )

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
    })

    it('should handle credential not found', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce(undefined)

      const req = new Request(
        'http://localhost:3000/api/auth/oauth/token?credentialId=nonexistent-credential-id'
      )

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error', 'Credential not found')
    })

    it('should handle missing access token', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: null,
        refreshToken: 'refresh-token',
        providerId: 'google',
      })

      const req = new Request(
        'http://localhost:3000/api/auth/oauth/token?credentialId=credential-id'
      )

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'No access token available')
    })

    it('should handle token refresh failure', async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: 'test-user-id' } })
      mockGetCredential.mockResolvedValueOnce({
        id: 'credential-id',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: new Date(Date.now() - 3600 * 1000),
        providerId: 'google',
      })
      mockRefreshTokenIfNeeded.mockRejectedValueOnce(new Error('Refresh failure'))

      const req = new Request(
        'http://localhost:3000/api/auth/oauth/token?credentialId=credential-id'
      )

      const { GET } = await import('./route')
      const response = await GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error', 'Failed to refresh access token')
    })
  })
})
