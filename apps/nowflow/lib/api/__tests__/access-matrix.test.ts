import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withWorkflowAccess, withWorkspaceAccess } from '../route-helpers'

/**
 * Permission access matrix — integration test for `withWorkspaceAccess` and
 * `withWorkflowAccess`. Each describe block sweeps the four canonical user
 * relationships (owner / workspace member / workflow collaborator /
 * unrelated outsider) and pins the expected handler-or-status outcome.
 *
 * The intent is to lock down the auth contract so a future refactor of
 * `route-helpers.ts` immediately fails CI if any of these matrix cells
 * accidentally flip from "handler invoked" to "rejected" or vice versa.
 */

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

const fakeRequest = (url = 'http://localhost/api/test') => ({
  method: 'GET',
  url,
  json: async () => ({}),
})

const session = (userId: string) => ({ user: { id: userId, email: 'e', name: 'n' } })

beforeEach(() => {
  getSessionMock.mockReset()
  dbResultRef.value = []
})

// ─── Workspace access matrix ─────────────────────────────────────────────────

describe('withWorkspaceAccess — access matrix', () => {
  type Cell = {
    label: string
    sessionUser: string | null
    dbRow: any[]
    requireOwner?: boolean
    requireAdmin?: boolean
    expect: 'handler' | 401 | 403 | 404
  }

  const matrix: Cell[] = [
    {
      label: 'unauthenticated -> 401',
      sessionUser: null,
      dbRow: [],
      expect: 401,
    },
    {
      label: 'workspace not found -> 404',
      sessionUser: 'u',
      dbRow: [],
      expect: 404,
    },
    {
      label: 'unrelated user -> 403',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: null }],
      expect: 403,
    },
    {
      label: 'owner -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'u', memberRole: null }],
      expect: 'handler',
    },
    {
      label: 'member -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: 'member' }],
      expect: 'handler',
    },
    {
      label: 'admin member -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: 'admin' }],
      expect: 'handler',
    },
    {
      label: 'requireOwner: member -> 403',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: 'member' }],
      requireOwner: true,
      expect: 403,
    },
    {
      label: 'requireOwner: owner -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'u', memberRole: null }],
      requireOwner: true,
      expect: 'handler',
    },
    {
      label: 'requireAdmin: member -> 403',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: 'member' }],
      requireAdmin: true,
      expect: 403,
    },
    {
      label: 'requireAdmin: admin -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'someone-else', memberRole: 'admin' }],
      requireAdmin: true,
      expect: 'handler',
    },
    {
      label: 'requireAdmin: owner -> handler',
      sessionUser: 'u',
      dbRow: [{ ownerId: 'u', memberRole: null }],
      requireAdmin: true,
      expect: 'handler',
    },
  ]

  it.each(matrix)(
    '$label',
    async ({ sessionUser, dbRow, requireOwner, requireAdmin, expect: exp }) => {
      if (sessionUser) {
        getSessionMock.mockResolvedValue(session(sessionUser))
      } else {
        getSessionMock.mockResolvedValue(null)
      }
      dbResultRef.value = dbRow

      const handler = vi.fn(async () => ({ status: 200 }) as any)
      const wrapped = withWorkspaceAccess(handler, {
        source: 'query',
        requireOwner,
        requireAdmin,
      })
      const result = await wrapped(fakeRequest('http://localhost/x?workspaceId=ws-1') as any)

      if (exp === 'handler') {
        expect(handler).toHaveBeenCalledTimes(1)
        expect((result as any).status).toBe(200)
      } else {
        expect(handler).not.toHaveBeenCalled()
        expect((result as any).status).toBe(exp)
      }
    }
  )
})

// ─── Workflow access matrix ──────────────────────────────────────────────────

describe('withWorkflowAccess — access matrix', () => {
  type Cell = {
    label: string
    sessionUser: string | null
    dbRow: any[]
    expect: 'handler' | 401 | 403 | 404
  }

  // Helper to build a workflow access query result row.
  const wfRow = (
    overrides: Partial<{
      workflowUserId: string
      workflowWorkspaceId: string | null
      collaborators: any
      ownerId: string | null
      memberUserId: string | null
    }>
  ) => ({
    workflowUserId: overrides.workflowUserId ?? 'someone-else',
    workflowWorkspaceId: overrides.workflowWorkspaceId ?? 'ws',
    collaborators: overrides.collaborators ?? [],
    ownerId: overrides.ownerId ?? null,
    memberUserId: overrides.memberUserId ?? null,
  })

  const matrix: Cell[] = [
    {
      label: 'unauthenticated -> 401',
      sessionUser: null,
      dbRow: [],
      expect: 401,
    },
    {
      label: 'workflow not found -> 404',
      sessionUser: 'u',
      dbRow: [],
      expect: 404,
    },
    {
      label: 'workflow owner via workflow.userId -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ workflowUserId: 'u' })],
      expect: 'handler',
    },
    {
      label: 'workspace owner -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ ownerId: 'u' })],
      expect: 'handler',
    },
    {
      label: 'workspace member -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ memberUserId: 'u' })],
      expect: 'handler',
    },
    {
      label: 'collaborator (object form) -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ collaborators: [{ userId: 'u', role: 'editor' }] })],
      expect: 'handler',
    },
    {
      label: 'collaborator (legacy string[] form) -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ collaborators: ['u', 'someone-else'] })],
      expect: 'handler',
    },
    {
      label: 'collaborator (JSONB-as-string form) -> handler',
      sessionUser: 'u',
      dbRow: [wfRow({ collaborators: '[{"userId":"u"}]' })],
      expect: 'handler',
    },
    {
      label: 'unrelated user -> 403',
      sessionUser: 'u',
      dbRow: [wfRow({ workflowUserId: 'x', ownerId: 'y', memberUserId: null })],
      expect: 403,
    },
    {
      label: 'malformed collaborators -> 403',
      sessionUser: 'u',
      dbRow: [wfRow({ collaborators: 'not-json' })],
      expect: 403,
    },
  ]

  it.each(matrix)('$label', async ({ sessionUser, dbRow, expect: exp }) => {
    if (sessionUser) {
      getSessionMock.mockResolvedValue(session(sessionUser))
    } else {
      getSessionMock.mockResolvedValue(null)
    }
    dbResultRef.value = dbRow

    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withWorkflowAccess(handler)
    const result = await wrapped(fakeRequest() as any, {
      params: Promise.resolve({ id: 'wf-1' }),
    })

    if (exp === 'handler') {
      expect(handler).toHaveBeenCalledTimes(1)
      expect((result as any).status).toBe(200)
    } else {
      expect(handler).not.toHaveBeenCalled()
      expect((result as any).status).toBe(exp)
    }
  })

  it('passes workspaceId, role, isOwner to handler context for workspace owner', async () => {
    getSessionMock.mockResolvedValue(session('u'))
    dbResultRef.value = [wfRow({ ownerId: 'u', workflowWorkspaceId: 'ws-42' })]

    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withWorkflowAccess(handler)
    await wrapped(fakeRequest() as any, {
      params: Promise.resolve({ id: 'wf-1' }),
    })

    expect(handler).toHaveBeenCalledTimes(1)
    const ctx = (handler.mock.calls[0] as any[])[1]
    expect(ctx.workspaceId).toBe('ws-42')
    expect(ctx.isOwner).toBe(true)
    expect(ctx.userId).toBe('u')
  })

  it('passes isOwner=false to handler context for collaborator', async () => {
    getSessionMock.mockResolvedValue(session('u'))
    dbResultRef.value = [
      wfRow({
        workflowUserId: 'someone-else',
        ownerId: 'someone-else',
        collaborators: [{ userId: 'u', role: 'editor' }],
      }),
    ]

    const handler = vi.fn(async () => ({ status: 200 }) as any)
    const wrapped = withWorkflowAccess(handler)
    await wrapped(fakeRequest() as any, {
      params: Promise.resolve({ id: 'wf-1' }),
    })

    expect(handler).toHaveBeenCalledTimes(1)
    const ctx = (handler.mock.calls[0] as any[])[1]
    expect(ctx.isOwner).toBe(false)
  })
})
