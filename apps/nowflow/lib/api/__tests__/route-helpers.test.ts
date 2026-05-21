import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  apiCreated,
  apiNoContent,
  apiSuccess,
  badRequest,
  checkWorkflowAccess,
  checkWorkspaceAccess,
  conflict,
  forbidden,
  notFound,
  parseJson,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
  withAuth,
  withWorkflowAccess,
  withWorkspaceAccess,
} from '../route-helpers'

const { getSessionMock, dbResultRef } = vi.hoisted(() => {
  const getSessionMock = vi.fn()
  const dbResultRef: { value: any[] } = { value: [] }
  return { getSessionMock, dbResultRef }
})

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('next/server', () => {
  class MockNextResponse {
    body: any
    status: number
    headers: Headers
    constructor(body: any, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = new Headers(init?.headers)
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

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: any[]) => ({ _and: args })),
  eq: vi.fn((a, b) => ({ _eq: true, a, b })),
}))

vi.mock('@/lib/auth', () => ({
  getSession: (...args: any[]) => getSessionMock(...args),
}))

vi.mock('@/db', () => {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(dbResultRef.value)),
  }
  return {
    db: {
      select: vi.fn(() => chain),
    },
  }
})

vi.mock('@/db/schema', () => ({
  workflow: { id: 'workflow.id', userId: 'workflow.user_id', workspaceId: 'workflow.workspace_id' },
  workspace: { id: 'workspace.id', ownerId: 'workspace.owner_id' },
  workspaceMember: {
    workspaceId: 'workspace_member.workspace_id',
    userId: 'workspace_member.user_id',
    role: 'workspace_member.role',
  },
}))

const fakeRequest = (overrides: { method?: string; url?: string; body?: any } = {}) => ({
  method: overrides.method ?? 'GET',
  url: overrides.url ?? 'http://localhost/api/test',
  json: async () => overrides.body ?? {},
})

beforeEach(() => {
  getSessionMock.mockReset()
  dbResultRef.value = []
})

describe('error response helpers', () => {
  it('unauthorized returns 401', () => {
    expect(unauthorized().status).toBe(401)
  })
  it('forbidden returns 403', () => {
    expect(forbidden().status).toBe(403)
  })
  it('notFound returns 404', () => {
    expect(notFound().status).toBe(404)
  })
  it('badRequest returns 400', () => {
    expect(badRequest('bad').status).toBe(400)
  })
  it('conflict returns 409', () => {
    expect(conflict().status).toBe(409)
  })
  it('serverError returns 500', () => {
    expect(serverError().status).toBe(500)
  })
  it('tooManyRequests returns 429 with code', () => {
    const r = tooManyRequests()
    expect(r.status).toBe(429)
    expect((r as any).body.code).toBe('RATE_LIMIT_EXCEEDED')
  })
})

describe('success envelope helpers', () => {
  it('apiSuccess wraps data in { data }', () => {
    const r = apiSuccess({ name: 'test' })
    expect((r as any).body).toEqual({ data: { name: 'test' } })
    expect(r.status).toBe(200)
  })
  it('apiCreated returns 201', () => {
    expect(apiCreated({ id: '1' }).status).toBe(201)
  })
  it('apiNoContent returns 204 with no body', () => {
    expect(apiNoContent().status).toBe(204)
  })
})

describe('validationError', () => {
  it('returns 400 with parsed Zod issues', () => {
    const schema = z.object({ a: z.string() })
    const parsed = schema.safeParse({ a: 1 })
    if (parsed.success) throw new Error('expected failure')
    const r = validationError(parsed.error)
    expect(r.status).toBe(400)
    expect((r as any).body.code).toBe('VALIDATION_ERROR')
    expect((r as any).body.issues[0].path).toBe('a')
  })
})

describe('parseJson', () => {
  it('returns parsed value when body matches schema', async () => {
    const schema = z.object({ name: z.string() })
    const result = await parseJson(
      fakeRequest({ method: 'POST', body: { name: 'ok' } }) as any,
      schema
    )
    expect(result).toEqual({ name: 'ok' })
  })

  it('returns 400 when JSON parsing fails', async () => {
    const schema = z.object({ name: z.string() })
    const req = {
      method: 'POST',
      json: async () => {
        throw new Error('bad json')
      },
    }
    const result = await parseJson(req as any, schema)
    expect((result as any).status).toBe(400)
  })

  it('returns 400 with validation issues when body fails schema', async () => {
    const schema = z.object({ name: z.string() })
    const result = await parseJson(
      fakeRequest({ method: 'POST', body: { name: 42 } }) as any,
      schema
    )
    expect((result as any).status).toBe(400)
    expect((result as any).body.code).toBe('VALIDATION_ERROR')
  })
})

describe('withAuth', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const handler = vi.fn()
    const wrapped = withAuth(handler)
    const result = await wrapped(fakeRequest() as any)
    expect((result as any).status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('invokes handler with userId and parsed body for POST', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u-1', email: 'e', name: 'n' } })
    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withAuth(handler)
    await wrapped(fakeRequest({ method: 'POST', body: { foo: 'bar' } }) as any)
    expect(handler).toHaveBeenCalled()
    const ctx = (handler.mock.calls[0] as any[])[1]
    expect(ctx.userId).toBe('u-1')
    expect(ctx.body).toEqual({ foo: 'bar' })
  })

  it('does not parse body for GET requests', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u-1', email: 'e', name: 'n' } })
    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withAuth(handler)
    await wrapped(fakeRequest({ method: 'GET' }) as any)
    expect((handler.mock.calls[0] as any[])[1].body).toBeNull()
  })

  it('returns 500 when handler throws', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u-1', email: 'e', name: 'n' } })
    const handler = vi.fn(async () => {
      throw new Error('oops')
    })
    const wrapped = withAuth(handler)
    const result = await wrapped(fakeRequest() as any)
    expect((result as any).status).toBe(500)
  })

  it('forwards dynamic route params', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u-1', email: 'e', name: 'n' } })
    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withAuth(handler)
    await wrapped(fakeRequest() as any, { params: Promise.resolve({ id: 'abc' }) })
    expect((handler.mock.calls[0] as any[])[1].params).toEqual({ id: 'abc' })
  })
})

describe('checkWorkspaceAccess', () => {
  it('returns not-found when workspace does not exist', async () => {
    dbResultRef.value = []
    const result = await checkWorkspaceAccess('u', 'ws')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-found')
  })

  it('returns ok with isOwner=true when user owns the workspace', async () => {
    dbResultRef.value = [{ ownerId: 'u', memberRole: null }]
    const result = await checkWorkspaceAccess('u', 'ws')
    expect(result.ok).toBe(true)
    expect(result.isOwner).toBe(true)
    expect(result.role).toBe('owner')
  })

  it('returns ok with isOwner=false when user is a member', async () => {
    dbResultRef.value = [{ ownerId: 'someone-else', memberRole: 'member' }]
    const result = await checkWorkspaceAccess('u', 'ws')
    expect(result.ok).toBe(true)
    expect(result.isOwner).toBe(false)
    expect(result.role).toBe('member')
  })

  it('returns forbidden when workspace exists but user has no membership', async () => {
    dbResultRef.value = [{ ownerId: 'someone-else', memberRole: null }]
    const result = await checkWorkspaceAccess('u', 'ws')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('forbidden')
  })
})

describe('checkWorkflowAccess', () => {
  it('returns ok when user owns the workflow directly', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'u',
        workflowWorkspaceId: 'ws',
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(true)
    expect(result.isOwner).toBe(true)
  })

  it('returns ok when user is a workspace member', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        ownerId: 'someone-else',
        memberUserId: 'u',
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(true)
    expect(result.isOwner).toBe(false)
  })

  it('returns forbidden for unrelated user', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        collaborators: [],
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('forbidden')
  })

  it('grants access via the JSONB collaborators array (object form)', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        collaborators: [
          { userId: 'other-user', role: 'editor' },
          { userId: 'u', role: 'editor' },
        ],
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(true)
    expect(result.isOwner).toBe(false)
  })

  it('grants access via legacy string[] collaborators', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        collaborators: ['user-a', 'u'],
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(true)
  })

  it('handles a JSONB-as-string collaborators field gracefully', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        collaborators: '[{"userId":"u"}]',
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(true)
  })

  it('falls through to forbidden on malformed collaborators', async () => {
    dbResultRef.value = [
      {
        workflowUserId: 'someone-else',
        workflowWorkspaceId: 'ws',
        collaborators: 'not-json',
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('forbidden')
  })

  it('returns not-found for missing workflow', async () => {
    dbResultRef.value = []
    const result = await checkWorkflowAccess('u', 'wf')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-found')
  })
})

describe('withWorkspaceAccess', () => {
  it('returns 400 when workspaceId cannot be resolved', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    const handler = vi.fn()
    const wrapped = withWorkspaceAccess(handler, { source: 'query' })
    const result = await wrapped(fakeRequest({ url: 'http://localhost/api/x' }) as any)
    expect((result as any).status).toBe(400)
  })

  it('runs the handler when access is granted', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    dbResultRef.value = [{ ownerId: 'u', memberRole: null }]
    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withWorkspaceAccess(handler, { source: 'query' })
    await wrapped(fakeRequest({ url: 'http://localhost/x?workspaceId=ws-1' }) as any)
    expect(handler).toHaveBeenCalled()
    expect((handler.mock.calls[0] as any[])[1].workspaceId).toBe('ws-1')
    expect((handler.mock.calls[0] as any[])[1].isOwner).toBe(true)
  })

  it('returns 403 when workspace exists but user has no membership', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    dbResultRef.value = [{ ownerId: 'someone-else', memberRole: null }]
    const handler = vi.fn()
    const wrapped = withWorkspaceAccess(handler, { source: 'query' })
    const result = await wrapped(fakeRequest({ url: 'http://localhost/x?workspaceId=ws' }) as any)
    expect((result as any).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('enforces requireOwner', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    dbResultRef.value = [{ ownerId: 'someone-else', memberRole: 'member' }]
    const handler = vi.fn()
    const wrapped = withWorkspaceAccess(handler, { source: 'query', requireOwner: true })
    const result = await wrapped(fakeRequest({ url: 'http://localhost/x?workspaceId=ws' }) as any)
    expect((result as any).status).toBe(403)
  })
})

describe('withWorkflowAccess', () => {
  it('returns 400 when workflow id is missing in params', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    const handler = vi.fn()
    const wrapped = withWorkflowAccess(handler)
    const result = await wrapped(fakeRequest() as any, { params: Promise.resolve({}) })
    expect((result as any).status).toBe(400)
  })

  it('runs the handler when workflow access is granted', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u', email: 'e', name: 'n' } })
    dbResultRef.value = [
      {
        workflowUserId: 'u',
        workflowWorkspaceId: 'ws',
        ownerId: 'someone-else',
        memberUserId: null,
      },
    ]
    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withWorkflowAccess(handler)
    await wrapped(fakeRequest() as any, { params: Promise.resolve({ id: 'wf' }) })
    expect(handler).toHaveBeenCalled()
    expect((handler.mock.calls[0] as any[])[1].isOwner).toBe(true)
  })
})
