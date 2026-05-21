import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateWorkflowSize } from '@/lib/storage-limits'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'
import { db } from '@/db'

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}))

vi.mock('@/db/schema', () => ({
  workflow: {
    id: 'id',
    userId: 'userId',
    workspaceId: 'workspaceId',
    name: 'name',
    description: 'description',
    color: 'color',
    icon: 'icon',
    state: 'state',
    marketplaceData: 'marketplaceData',
    storageSize: 'storageSize',
    isDeployed: 'isDeployed',
    runCount: 'runCount',
    lastSynced: 'lastSynced',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/subscription-plan-access', () => ({
  getEffectiveSubscriptionPlan: vi.fn(),
}))

vi.mock('@/lib/storage-limits', () => ({
  calculateWorkflowSize: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  count: vi.fn(() => '__count__'),
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  sum: vi.fn(() => '__sum__'),
}))

const mockDb = db as unknown as {
  transaction: ReturnType<typeof vi.fn>
}

type MockTransaction = {
  execute: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}

function createTransactionHarness(initialCount: number, initialStorage = 0) {
  let workflowCount = initialCount
  let storageTotal = initialStorage
  let transactionLocked = false
  const waiters: Array<() => void> = []

  const tx: MockTransaction = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn((selection: Record<string, unknown>) => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          if ('count' in selection) {
            return [{ count: workflowCount }]
          }

          if ('total' in selection) {
            return [{ total: storageTotal }]
          }

          return []
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, any>) => ({
        returning: vi.fn(async () => {
          workflowCount += 1
          storageTotal += Number(values.storageSize || 0)

          return [
            {
              id: values.id,
              name: values.name,
              workspaceId: values.workspaceId ?? null,
            },
          ]
        }),
      })),
    })),
  }

  mockDb.transaction.mockImplementation(
    async (callback: (tx: MockTransaction) => Promise<unknown>) => {
      if (transactionLocked) {
        await new Promise<void>((resolve) => waiters.push(resolve))
      }

      transactionLocked = true

      try {
        return await callback(tx)
      } finally {
        transactionLocked = false
        waiters.shift()?.()
      }
    }
  )

  return {
    tx,
    getWorkflowCount: () => workflowCount,
    getStorageTotal: () => storageTotal,
  }
}

describe('createWorkflowWithLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getEffectiveSubscriptionPlan).mockResolvedValue({
      id: 'free-plan',
      name: 'free',
      displayName: 'Free',
      workflowLimit: 3,
      apiCallsLimit: 100,
      storageLimit: 10,
      costLimit: 0,
      sharingEnabled: false,
      multiplayerEnabled: false,
      workspaceCollaborationEnabled: false,
      price: null,
    })

    vi.mocked(calculateWorkflowSize).mockReturnValue(1)
  })

  it('serializes concurrent workflow creation so only one request can consume the last slot', async () => {
    const harness = createTransactionHarness(2, 0)
    const { createWorkflowWithLimits, WorkflowCreationLimitError } =
      await import('../create-workflow')

    const baseInput = {
      userId: 'user-1',
      name: 'Workflow',
      state: { blocks: {}, edges: [], loops: {} },
    }

    const results = await Promise.allSettled([
      createWorkflowWithLimits({ ...baseInput, id: 'wf-1' }),
      createWorkflowWithLimits({ ...baseInput, id: 'wf-2' }),
    ])

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled'
    )
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toBeInstanceOf(WorkflowCreationLimitError)
    expect(rejected[0].reason.message).toContain('workflow limit')
    expect(harness.getWorkflowCount()).toBe(3)
    expect(harness.getStorageTotal()).toBe(1)
    expect(harness.tx.execute).toHaveBeenCalledTimes(2)
    expect(harness.tx.insert).toHaveBeenCalledTimes(1)
  })

  it('creates a workflow when the user is still below the plan limit', async () => {
    const harness = createTransactionHarness(1, 2)
    const { createWorkflowWithLimits } = await import('../create-workflow')

    const created = await createWorkflowWithLimits({
      id: 'wf-3',
      userId: 'user-1',
      name: 'Safe Create',
      workspaceId: 'workspace-1',
      state: { blocks: {}, edges: [], loops: {} },
    })

    expect(created).toEqual({
      id: 'wf-3',
      name: 'Safe Create',
      workspaceId: 'workspace-1',
    })
    expect(harness.getWorkflowCount()).toBe(2)
    expect(harness.tx.insert).toHaveBeenCalledTimes(1)
  })
})
