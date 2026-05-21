import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateWorkflowSize,
  canUseStorage,
  getStorageUsage,
  getUserStorageUsed,
  updateWorkflowStorageSize,
} from '@/lib/storage-limits'

// --- Mocks: must be set up before importing the module under test ---

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Chainable query-builder mock. We override `mockSumTotal` / `mockShouldThrow`
// for each test, and `.where()` resolves to `[{ total: mockSumTotal }]` so
// both `db.select()...where()` and `await db.select()...where()` paths work.
let mockSumTotal: number | string | null = 0
let mockShouldThrow = false

// Capture update calls so we can assert on them
const updateWhereMock = vi.fn()
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }))
const updateMock = vi.fn(() => ({ set: updateSetMock }))

vi.mock('@/db', () => {
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => {
      if (mockShouldThrow) {
        return Promise.reject(new Error('mock db failure'))
      }
      return Promise.resolve([{ total: mockSumTotal }])
    }),
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
      update: (table?: unknown) => (updateMock as any)(table),
    },
  }
})

vi.mock('@/db/schema', () => ({
  workflow: {
    id: 'workflow.id',
    userId: 'workflow.userId',
    deletedAt: 'workflow.deletedAt',
    storageSize: 'workflow.storageSize',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ _and: args }),
  eq: (a: any, b: any) => ({ _eq: [a, b] }),
  isNull: (a: any) => ({ _isNull: a }),
  sum: (a: any) => ({ _sum: a }),
}))

// Toggle-able isProd flag
const mockIsProd = { value: false }
vi.mock('@/lib/environment', () => ({
  get isProd() {
    return mockIsProd.value
  },
}))

// Swappable subscription plan mock
let mockPlan: any = {
  id: 'plan-free',
  name: 'free',
  displayName: 'Free',
  price: null,
  workflowLimit: 3,
  apiCallsLimit: 20,
  storageLimit: 50,
  costLimit: 5,
  sharingEnabled: false,
  multiplayerEnabled: false,
  workspaceCollaborationEnabled: false,
}
vi.mock('@/lib/subscription-plan-access', () => ({
  getEffectiveSubscriptionPlan: vi.fn(async () => mockPlan),
}))

describe('storage-limits', () => {
  beforeEach(() => {
    mockSumTotal = 0
    mockShouldThrow = false
    mockIsProd.value = true
    mockPlan = {
      id: 'plan-free',
      name: 'free',
      displayName: 'Free',
      price: null,
      workflowLimit: 3,
      apiCallsLimit: 20,
      storageLimit: 50,
      costLimit: 5,
      sharingEnabled: false,
      multiplayerEnabled: false,
      workspaceCollaborationEnabled: false,
    }
    updateMock.mockClear()
    updateSetMock.mockClear()
    updateWhereMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateWorkflowSize', () => {
    it('returns KB estimate from JSON length (round up)', () => {
      // JSON.stringify of {} is 2 chars -> ceil(2/1024) = 1
      expect(calculateWorkflowSize({})).toBe(1)
    })

    it('returns 0 on serialization errors (circular refs)', () => {
      const a: any = {}
      a.self = a
      expect(calculateWorkflowSize(a)).toBe(0)
    })

    it('handles large payloads', () => {
      const big = { data: 'x'.repeat(5000) }
      const kb = calculateWorkflowSize(big)
      // length is roughly 5015 chars -> ceil(5015/1024) = 5
      expect(kb).toBeGreaterThanOrEqual(5)
      expect(kb).toBeLessThanOrEqual(6)
    })
  })

  describe('getUserStorageUsed', () => {
    it('returns 0 when no workflows exist', async () => {
      mockSumTotal = 0
      const result = await getUserStorageUsed('user-1')
      expect(result).toBe(0)
    })

    it('converts KB sum to MB using ceil', async () => {
      mockSumTotal = 2048 // 2 MB exactly
      const result = await getUserStorageUsed('user-1')
      expect(result).toBe(2)
    })

    it('rounds partial MBs up', async () => {
      mockSumTotal = 1025 // 1.0009... MB -> ceil => 2
      const result = await getUserStorageUsed('user-1')
      expect(result).toBe(2)
    })

    it('returns 0 on db error', async () => {
      mockShouldThrow = true
      const result = await getUserStorageUsed('user-1')
      expect(result).toBe(0)
    })
  })

  describe('canUseStorage', () => {
    it('allows usage under the free plan limit', async () => {
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 50 }
      mockSumTotal = 10 * 1024 // 10 MB used
      const result = await canUseStorage('user-1', 1024) // +1 MB
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(50)
      expect(result.currentUsage).toBe(10)
    })

    it('denies usage that would exceed the free plan limit', async () => {
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 50 }
      mockSumTotal = 50 * 1024 // 50 MB used (full)
      const result = await canUseStorage('user-1', 1) // +1 KB => over
      expect(result.allowed).toBe(false)
      expect(result.limit).toBe(50)
      expect(result.message).toMatch(/Storage limit exceeded/)
      expect(result.message).toMatch(/Free plan/)
    })

    it('allows usage that hits the limit exactly (boundary)', async () => {
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 50 }
      // 50 MB = 51200 KB; use exactly the full amount in one shot
      mockSumTotal = 0
      const result = await canUseStorage('user-1', 50 * 1024)
      expect(result.allowed).toBe(true)
    })

    it('denies when 1 KB over the exact limit', async () => {
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 50 }
      mockSumTotal = 0
      const result = await canUseStorage('user-1', 50 * 1024 + 1)
      expect(result.allowed).toBe(false)
    })

    it('allows usage under the pro plan limit', async () => {
      mockPlan = { ...mockPlan, name: 'pro', displayName: 'Pro', storageLimit: 5120 }
      mockSumTotal = 100 * 1024 // 100 MB
      const result = await canUseStorage('user-1', 1024)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5120)
    })

    it('allows effectively-unlimited usage on enterprise plan', async () => {
      mockPlan = {
        ...mockPlan,
        name: 'enterprise',
        displayName: 'Enterprise',
        storageLimit: 999999,
      }
      mockSumTotal = 100 * 1024
      const result = await canUseStorage('user-1', 50 * 1024)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(999999)
    })

    it('returns a safe error response when the db throws', async () => {
      mockShouldThrow = true
      const result = await canUseStorage('user-1', 100)
      expect(result.allowed).toBe(false)
      expect(result.currentUsage).toBe(0)
      expect(result.limit).toBe(0)
      expect(result.message).toMatch(/Unable to verify storage limits/)
    })

    it('in non-prod mode uses dev override plan (pro-like 5120 limit)', async () => {
      mockIsProd.value = false
      // Real plan would be tiny, but dev override overrides to 5120
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 10 }
      mockSumTotal = 200 * 1024 // 200 MB
      const result = await canUseStorage('user-1', 1024)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5120)
    })
  })

  describe('updateWorkflowStorageSize', () => {
    it('writes the computed storage size for the workflow id', async () => {
      await updateWorkflowStorageSize('wf-1', { foo: 'bar' })
      expect(updateMock).toHaveBeenCalled()
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ storageSize: expect.any(Number) })
      )
      expect(updateWhereMock).toHaveBeenCalled()
    })

    it('swallows errors without throwing', async () => {
      updateWhereMock.mockImplementationOnce(() => {
        throw new Error('db down')
      })
      await expect(updateWorkflowStorageSize('wf-1', { foo: 'bar' })).resolves.toBeUndefined()
    })
  })

  describe('getStorageUsage', () => {
    it('returns current/limit/percentage/tier for a free user', async () => {
      mockPlan = { ...mockPlan, name: 'free', displayName: 'Free', storageLimit: 50 }
      mockSumTotal = 25 * 1024 // 25 MB
      const usage = await getStorageUsage('user-1')
      expect(usage.current).toBe(25)
      expect(usage.limit).toBe(50)
      expect(usage.percentage).toBe(50)
      expect(usage.tier).toBe('free')
    })

    it('caps data (no rounding oddities) for pro users', async () => {
      mockPlan = { ...mockPlan, name: 'pro', displayName: 'Pro', storageLimit: 5120 }
      mockSumTotal = 5120 * 1024 // full
      const usage = await getStorageUsage('user-1')
      expect(usage.current).toBe(5120)
      expect(usage.limit).toBe(5120)
      expect(usage.percentage).toBe(100)
      expect(usage.tier).toBe('pro')
    })

    it('returns a safe unknown-tier response on db error', async () => {
      mockShouldThrow = true
      const usage = await getStorageUsage('user-1')
      expect(usage.current).toBe(0)
      expect(usage.limit).toBe(0)
      expect(usage.percentage).toBe(0)
      expect(usage.tier).toBe('unknown')
    })
  })
})
