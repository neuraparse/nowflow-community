/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { createWorkflowWithLimits } from '@/lib/workflows/create-workflow'
import { db } from '@/db'

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/workflows/create-workflow', () => ({
  createWorkflowWithLimits: vi.fn(),
  WorkflowCreationLimitError: class WorkflowCreationLimitError extends Error {
    code: string
    status: number

    constructor(message: string, code = 'WORKFLOW_LIMIT_EXCEEDED', status = 429) {
      super(message)
      this.code = code
      this.status = status
    }
  },
}))

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('@/db/schema', () => ({
  workflow: { id: 'id', deletedAt: 'deletedAt' },
  workspace: { id: 'id', ownerId: 'ownerId' },
  workspaceMember: { workspaceId: 'workspaceId', userId: 'userId' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
}))

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
}

function mockSelectResult(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => rows),
      })),
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => rows),
        })),
      })),
    })),
  })
}

const validBody = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Workflow 1',
  description: 'Test workflow',
  color: '#3972F6',
  icon: 'workflow',
  state: {
    blocks: {},
    edges: [],
    loops: {},
    marketplaceData: null,
  },
  workspaceId: '22222222-2222-4222-8222-222222222222',
  marketplaceData: null,
}

describe('POST /api/workflows/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as any)
  })

  it('rejects creation in a workspace the user cannot access', async () => {
    mockSelectResult([])
    mockSelectResult([
      {
        id: validBody.workspaceId,
        ownerId: 'different-user',
        memberUserId: null,
      },
    ])

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost:3000/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(validBody),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('WORKSPACE_ACCESS_DENIED')
    expect(createWorkflowWithLimits).not.toHaveBeenCalled()
  })

  it('maps unique-constraint races to a stable 409 response', async () => {
    mockSelectResult([])
    vi.mocked(createWorkflowWithLimits).mockRejectedValueOnce({
      code: '23505',
      constraint: 'workflow_pkey',
    })

    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost:3000/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify({
        ...validBody,
        workspaceId: undefined,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('WORKFLOW_EXISTS')
    expect(data.error).toBe('Workflow already exists')
  })
})
