import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleSlackChallenge,
  handleWhatsAppVerification,
  validateSlackSignature,
  verifyProviderWebhook,
} from '../provider-verification'

const { dbSelectMock } = vi.hoisted(() => {
  // Build a chainable mock that returns whatever `rowsRef` contains
  const rowsRef: { current: any[] } = { current: [] }
  const selectMock = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => rowsRef.current),
    })),
  }))
  return { dbSelectMock: { selectMock, rowsRef } }
})

vi.mock('@/db', () => ({
  db: { select: dbSelectMock.selectMock },
}))

vi.mock('@/db/schema', () => ({
  webhook: { provider: 'provider', isActive: 'isActive' },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ and: args }),
  eq: (col: any, val: any) => ({ eq: [col, val] }),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('next/server', () => {
  class MockNextResponse {
    status: number
    body: string
    headers: Record<string, string>
    constructor(body: string = '', init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }
    static json(data: any, init?: { status?: number }) {
      const r = new MockNextResponse(JSON.stringify(data), init)
      r.headers = { 'Content-Type': 'application/json' }
      return r
    }
  }
  return { NextRequest: class {}, NextResponse: MockNextResponse }
})

beforeEach(() => {
  dbSelectMock.rowsRef.current = []
  dbSelectMock.selectMock.mockClear()
})

describe('handleSlackChallenge', () => {
  it('returns challenge json for url_verification', () => {
    const res = handleSlackChallenge({ type: 'url_verification', challenge: 'abc' })
    expect(res).not.toBeNull()
    expect((res as any).status).toBe(200)
    expect((res as any).body).toBe(JSON.stringify({ challenge: 'abc' }))
  })

  it('returns null for non-url_verification events', () => {
    expect(handleSlackChallenge({ type: 'event_callback' })).toBeNull()
    expect(handleSlackChallenge({ type: 'url_verification' })).toBeNull()
  })
})

describe('handleWhatsAppVerification', () => {
  it('returns null when mode/token/challenge not all provided', async () => {
    expect(await handleWhatsAppVerification('rid', '/p', null, null, null)).toBeNull()
    expect(await handleWhatsAppVerification('rid', '/p', 'subscribe', null, 'c')).toBeNull()
  })

  it('returns 400 for wrong mode', async () => {
    const res = await handleWhatsAppVerification('rid', '/p', 'other', 'token', 'c')
    expect((res as any).status).toBe(400)
  })

  it('returns 403 when no matching webhook token found', async () => {
    dbSelectMock.rowsRef.current = [
      { id: 'wh1', providerConfig: { verificationToken: 'different-token' } },
    ]
    const res = await handleWhatsAppVerification('rid', '/p', 'subscribe', 'supplied-token', 'ch')
    expect((res as any).status).toBe(403)
  })

  it('returns challenge when token matches', async () => {
    dbSelectMock.rowsRef.current = [
      { id: 'wh1', providerConfig: { verificationToken: 'match-token' } },
    ]
    const res = await handleWhatsAppVerification('rid', '/p', 'subscribe', 'match-token', 'chall')
    expect((res as any).status).toBe(200)
    expect((res as any).body).toBe('chall')
    expect((res as any).headers['Content-Type']).toBe('text/plain')
  })

  it('skips webhooks without verificationToken', async () => {
    dbSelectMock.rowsRef.current = [
      { id: 'w1', providerConfig: {} },
      { id: 'w2', providerConfig: { verificationToken: 'token' } },
    ]
    const res = await handleWhatsAppVerification('rid', '/p', 'subscribe', 'token', 'chal')
    expect((res as any).status).toBe(200)
  })
})

describe('validateSlackSignature', () => {
  async function computeSig(secret: string, timestamp: string, body: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`v0:${timestamp}:${body}`))
    const hex = Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `v0=${hex}`
  }

  it('returns false when any argument missing', async () => {
    expect(await validateSlackSignature('', 's', 't', 'b')).toBe(false)
    expect(await validateSlackSignature('a', '', 't', 'b')).toBe(false)
    expect(await validateSlackSignature('a', 's', '', 'b')).toBe(false)
    expect(await validateSlackSignature('a', 's', 't', '')).toBe(false)
  })

  it('returns false for old timestamps (>5 min)', async () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 600)
    const sig = await computeSig('secret', oldTs, 'body')
    expect(await validateSlackSignature('secret', sig, oldTs, 'body')).toBe(false)
  })

  it('returns true for valid signature', async () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = await computeSig('secret', ts, 'body')
    expect(await validateSlackSignature('secret', sig, ts, 'body')).toBe(true)
  })

  it('returns false when signatures mismatch', async () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = await computeSig('secret', ts, 'body')
    expect(await validateSlackSignature('other-secret', sig, ts, 'body')).toBe(false)
  })

  it('returns false on length mismatch', async () => {
    const ts = String(Math.floor(Date.now() / 1000))
    expect(await validateSlackSignature('secret', 'v0=short', ts, 'body')).toBe(false)
  })
})

describe('verifyProviderWebhook', () => {
  function makeRequest(headers: Record<string, string | null>) {
    return {
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    } as any
  }

  it('returns null for github (no auth)', () => {
    const wh = { provider: 'github', providerConfig: {} }
    expect(verifyProviderWebhook(wh, makeRequest({}), 'rid')).toBeNull()
  })

  it('returns null for stripe (no auth)', () => {
    const wh = { provider: 'stripe', providerConfig: {} }
    expect(verifyProviderWebhook(wh, makeRequest({}), 'rid')).toBeNull()
  })

  it('generic: passes when requireAuth is false', () => {
    const wh = { provider: 'generic', providerConfig: { requireAuth: false } }
    expect(verifyProviderWebhook(wh, makeRequest({}), 'rid')).toBeNull()
  })

  it('generic: returns 401 when requireAuth with bad bearer token', () => {
    const wh = { provider: 'generic', providerConfig: { requireAuth: true, token: 'good' } }
    const res = verifyProviderWebhook(wh, makeRequest({ authorization: 'Bearer bad' }), 'rid')
    expect((res as any).status).toBe(401)
  })

  it('generic: passes when Bearer matches', () => {
    const wh = { provider: 'generic', providerConfig: { requireAuth: true, token: 'good' } }
    expect(
      verifyProviderWebhook(wh, makeRequest({ authorization: 'Bearer good' }), 'rid')
    ).toBeNull()
  })

  it('generic: passes via secretHeaderName when Bearer missing', () => {
    const wh = {
      provider: 'generic',
      providerConfig: {
        requireAuth: true,
        token: 'good',
        secretHeaderName: 'x-custom-auth',
      },
    }
    expect(verifyProviderWebhook(wh, makeRequest({ 'x-custom-auth': 'good' }), 'rid')).toBeNull()
  })

  it('generic: returns 403 when IP not in allowedIps', () => {
    const wh = {
      provider: 'generic',
      providerConfig: { requireAuth: false, allowedIps: ['1.1.1.1'] },
    }
    const res = verifyProviderWebhook(wh, makeRequest({ 'x-forwarded-for': '2.2.2.2' }), 'rid')
    expect((res as any).status).toBe(403)
  })

  it('generic: passes when IP in allowedIps', () => {
    const wh = {
      provider: 'generic',
      providerConfig: { requireAuth: false, allowedIps: ['1.1.1.1'] },
    }
    expect(
      verifyProviderWebhook(wh, makeRequest({ 'x-forwarded-for': '1.1.1.1' }), 'rid')
    ).toBeNull()
  })

  it('default provider: returns 401 when token set and mismatched', () => {
    const wh = { provider: 'slack', providerConfig: { token: 'good' } }
    const res = verifyProviderWebhook(wh, makeRequest({ authorization: 'Bearer bad' }), 'rid')
    expect((res as any).status).toBe(401)
  })

  it('default provider: passes when token matches', () => {
    const wh = { provider: 'slack', providerConfig: { token: 'good' } }
    expect(
      verifyProviderWebhook(wh, makeRequest({ authorization: 'Bearer good' }), 'rid')
    ).toBeNull()
  })

  it('default provider: passes when no token configured', () => {
    const wh = { provider: 'slack', providerConfig: {} }
    expect(verifyProviderWebhook(wh, makeRequest({}), 'rid')).toBeNull()
  })
})
