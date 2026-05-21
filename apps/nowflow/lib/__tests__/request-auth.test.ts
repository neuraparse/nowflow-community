import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasValidInternalApiKey,
  requireSession,
  requireSessionOrInternalApiKey,
} from '@/lib/request-auth'

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}))

vi.mock('next/server', () => {
  class MockNextResponse {
    body: any
    status: number
    constructor(body: any, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
    static json(body: any, init?: { status?: number }) {
      return new MockNextResponse(body, init)
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
  }
})

vi.mock('@/lib/auth', () => ({
  getSession: (...args: any[]) => getSessionMock(...args),
}))

const makeRequest = (headers: Record<string, string> = {}) =>
  ({
    headers: {
      get: (key: string) => {
        const match = Object.entries(headers).find(([k]) => k.toLowerCase() === key.toLowerCase())
        return match ? match[1] : null
      },
    },
  }) as unknown as Request

describe('request-auth', () => {
  const originalKey = process.env.INTERNAL_API_KEY

  beforeEach(() => {
    getSessionMock.mockReset()
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_API_KEY
    } else {
      process.env.INTERNAL_API_KEY = originalKey
    }
  })

  // ---------------------------------------------------------------------
  // hasValidInternalApiKey
  // ---------------------------------------------------------------------
  describe('hasValidInternalApiKey', () => {
    it('returns false when INTERNAL_API_KEY env is not set', () => {
      delete process.env.INTERNAL_API_KEY
      const req = makeRequest({ authorization: 'Bearer anything' })
      expect(hasValidInternalApiKey(req)).toBe(false)
    })

    it('returns false when no Authorization header is present', () => {
      process.env.INTERNAL_API_KEY = 'secret-key'
      const req = makeRequest()
      expect(hasValidInternalApiKey(req)).toBe(false)
    })

    it('returns false when Authorization header is not a Bearer token', () => {
      process.env.INTERNAL_API_KEY = 'secret-key'
      const req = makeRequest({ authorization: 'Basic abcdef' })
      expect(hasValidInternalApiKey(req)).toBe(false)
    })

    it('returns false when Bearer token does not match', () => {
      process.env.INTERNAL_API_KEY = 'secret-key'
      const req = makeRequest({ authorization: 'Bearer wrong-key' })
      expect(hasValidInternalApiKey(req)).toBe(false)
    })

    it('returns false when bearer token has different length', () => {
      // Different lengths - timingSafeEqual requires equal length so the safeCompare short-circuits
      process.env.INTERNAL_API_KEY = 'short'
      const req = makeRequest({ authorization: 'Bearer much-longer-token' })
      expect(hasValidInternalApiKey(req)).toBe(false)
    })

    it('returns true when Bearer token exactly matches the configured secret', () => {
      process.env.INTERNAL_API_KEY = 'secret-key'
      const req = makeRequest({ authorization: 'Bearer secret-key' })
      expect(hasValidInternalApiKey(req)).toBe(true)
    })

    it('is case-sensitive on the token value', () => {
      process.env.INTERNAL_API_KEY = 'SecretKey'
      const req = makeRequest({ authorization: 'Bearer secretkey' })
      expect(hasValidInternalApiKey(req)).toBe(false)
    })
  })

  // ---------------------------------------------------------------------
  // requireSession
  // ---------------------------------------------------------------------
  describe('requireSession', () => {
    it('returns a 401 NextResponse when no session is present', async () => {
      getSessionMock.mockResolvedValue(null)
      const res: any = await requireSession()
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
    })

    it('returns a 401 NextResponse when session has no user.id', async () => {
      getSessionMock.mockResolvedValue({ user: {} })
      const res: any = await requireSession()
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
    })

    it('returns the session when a valid user is present', async () => {
      const session = { user: { id: 'u1', email: 'a@b.com' } }
      getSessionMock.mockResolvedValue(session)
      const res: any = await requireSession()
      expect(res).toBe(session)
    })
  })

  // ---------------------------------------------------------------------
  // requireSessionOrInternalApiKey
  // ---------------------------------------------------------------------
  describe('requireSessionOrInternalApiKey', () => {
    it('returns { isInternal: true, session: null } when internal API key matches', async () => {
      process.env.INTERNAL_API_KEY = 'super-secret'
      const req = makeRequest({ authorization: 'Bearer super-secret' })

      const res: any = await requireSessionOrInternalApiKey(req)
      expect(res).toEqual({ isInternal: true, session: null })
      // Must not have called getSession
      expect(getSessionMock).not.toHaveBeenCalled()
    })

    it('falls back to session auth when API key is missing and returns isInternal: false', async () => {
      delete process.env.INTERNAL_API_KEY
      const session = { user: { id: 'u1' } }
      getSessionMock.mockResolvedValue(session)
      const req = makeRequest()

      const res: any = await requireSessionOrInternalApiKey(req)
      expect(res).toEqual({ session, isInternal: false })
    })

    it('returns 401 when API key is invalid and session is missing', async () => {
      process.env.INTERNAL_API_KEY = 'secret'
      getSessionMock.mockResolvedValue(null)
      const req = makeRequest({ authorization: 'Bearer wrong' })

      const res: any = await requireSessionOrInternalApiKey(req)
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
    })

    it('returns 401 when session exists but has no user.id', async () => {
      delete process.env.INTERNAL_API_KEY
      getSessionMock.mockResolvedValue({ user: {} })

      const res: any = await requireSessionOrInternalApiKey(makeRequest())
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Unauthorized' })
    })

    it('prefers API key path over session lookup when both are valid', async () => {
      process.env.INTERNAL_API_KEY = 'abc'
      getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
      const req = makeRequest({ authorization: 'Bearer abc' })

      const res: any = await requireSessionOrInternalApiKey(req)
      expect(res.isInternal).toBe(true)
      expect(res.session).toBeNull()
      expect(getSessionMock).not.toHaveBeenCalled()
    })
  })
})
