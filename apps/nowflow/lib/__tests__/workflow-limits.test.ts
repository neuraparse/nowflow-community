import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canCreateWorkflow, getUserWorkflowCount, getWorkflowUsage } from '@/lib/workflow-limits'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Chainable select mock -> where() resolves to [{ count: N }]
let mockCount: number = 0
let mockShouldThrow = false

vi.mock('@/db', () => {
  const selectChain: any = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => {
      if (mockShouldThrow) {
        return Promise.reject(new Error('mock db failure'))
      }
      return Promise.resolve([{ count: mockCount }])
    }),
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
    },
  }
})

vi.mock('@/db/schema', () => ({
  workflow: {
    id: 'workflow.id',
    userId: 'workflow.userId',
    deletedAt: 'workflow.deletedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ _and: args }),
  eq: (a: any, b: any) => ({ _eq: [a, b] }),
  isNull: (a: any) => ({ _isNull: a }),
  count: () => ({ _count: true }),
}))

// Swappable subscription plan mock
let mockPlan: any = null
let mockPlanShouldThrow = false
vi.mock('@/lib/subscription-plan-access', () => ({
  getEffectiveSubscriptionPlan: vi.fn(async () => {
    if (mockPlanShouldThrow) {
      throw new Error('plan lookup failed')
    }
    return mockPlan
  }),
}))

const FREE_PLAN = {
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

const PRO_PLAN = {
  id: 'plan-pro',
  name: 'pro',
  displayName: 'Pro',
  price: 20,
  workflowLimit: 50,
  apiCallsLimit: 2000,
  storageLimit: 5120,
  costLimit: 40,
  sharingEnabled: true,
  multiplayerEnabled: false,
  workspaceCollaborationEnabled: false,
}

const ENTERPRISE_PLAN = {
  id: 'plan-ent',
  name: 'enterprise',
  displayName: 'Enterprise',
  price: null,
  workflowLimit: 999999,
  apiCallsLimit: 999999,
  storageLimit: 999999,
  costLimit: 999999,
  sharingEnabled: true,
  multiplayerEnabled: true,
  workspaceCollaborationEnabled: true,
}

describe('workflow-limits', () => {
  beforeEach(() => {
    mockCount = 0
    mockShouldThrow = false
    mockPlanShouldThrow = false
    mockPlan = FREE_PLAN
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserWorkflowCount', () => {
    it('returns 0 when there are no workflows', async () => {
      mockCount = 0
      expect(await getUserWorkflowCount('user-1')).toBe(0)
    })

    it('returns the count from the db result', async () => {
      mockCount = 7
      expect(await getUserWorkflowCount('user-1')).toBe(7)
    })

    it('coerces stringy count results via Number()', async () => {
      // Drizzle sometimes returns counts as strings in some drivers
      mockCount = '12' as any
      expect(await getUserWorkflowCount('user-1')).toBe(12)
    })

    it('returns 0 on db error', async () => {
      mockShouldThrow = true
      expect(await getUserWorkflowCount('user-1')).toBe(0)
    })
  })

  describe('canCreateWorkflow', () => {
    it('allows creation when under the free tier limit', async () => {
      mockPlan = FREE_PLAN
      mockCount = 2
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(true)
      expect(r.currentCount).toBe(2)
      expect(r.limit).toBe(3)
      expect(r.planName).toBe('free')
      expect(r.message).toBeUndefined()
    })

    it('blocks at exactly the free tier limit (boundary)', async () => {
      mockPlan = FREE_PLAN
      mockCount = 3
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(false)
      expect(r.currentCount).toBe(3)
      expect(r.limit).toBe(3)
      expect(r.message).toMatch(/workflow limit/i)
      expect(r.message).toMatch(/Free plan/)
    })

    it('blocks above the free tier limit', async () => {
      mockPlan = FREE_PLAN
      mockCount = 5
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(false)
    })

    it('allows creation on the pro plan up to 49 workflows', async () => {
      mockPlan = PRO_PLAN
      mockCount = 49
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(true)
      expect(r.limit).toBe(50)
      expect(r.planName).toBe('pro')
    })

    it('blocks pro plan users exactly at 50 workflows (boundary)', async () => {
      mockPlan = PRO_PLAN
      mockCount = 50
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(false)
      expect(r.planName).toBe('pro')
    })

    it('allows very large counts on enterprise plan', async () => {
      mockPlan = ENTERPRISE_PLAN
      mockCount = 10_000
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(true)
      expect(r.limit).toBe(999999)
      expect(r.planName).toBe('enterprise')
    })

    it('returns a disallowed response when the plan lookup returns null', async () => {
      mockPlan = null
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(false)
      expect(r.message).toMatch(/No subscription plan/)
      expect(r.currentCount).toBe(0)
      expect(r.limit).toBe(0)
    })

    it('returns a safe error response when the plan lookup throws', async () => {
      mockPlanShouldThrow = true
      const r = await canCreateWorkflow('user-1')
      expect(r.allowed).toBe(false)
      expect(r.message).toMatch(/Unable to verify workflow limits/)
    })
  })

  describe('getWorkflowUsage', () => {
    it('returns current/limit/percentage/plan for a free user', async () => {
      mockPlan = FREE_PLAN
      mockCount = 1
      const u = await getWorkflowUsage('user-1')
      expect(u.current).toBe(1)
      expect(u.limit).toBe(3)
      // round(1/3*100) = 33
      expect(u.percentage).toBe(33)
      expect(u.planName).toBe('free')
    })

    it('returns 100% at the boundary', async () => {
      mockPlan = FREE_PLAN
      mockCount = 3
      const u = await getWorkflowUsage('user-1')
      expect(u.percentage).toBe(100)
    })

    it('computes percentage for pro plan', async () => {
      mockPlan = PRO_PLAN
      mockCount = 10
      const u = await getWorkflowUsage('user-1')
      expect(u.current).toBe(10)
      expect(u.limit).toBe(50)
      expect(u.percentage).toBe(20)
      expect(u.planName).toBe('pro')
    })

    it('returns an unknown-plan fallback when plan lookup returns null', async () => {
      mockPlan = null
      const u = await getWorkflowUsage('user-1')
      expect(u.current).toBe(0)
      expect(u.limit).toBe(0)
      expect(u.percentage).toBe(0)
      expect(u.planName).toBe('unknown')
    })

    it('returns an unknown-plan fallback when the plan lookup throws', async () => {
      mockPlanShouldThrow = true
      const u = await getWorkflowUsage('user-1')
      expect(u.current).toBe(0)
      expect(u.limit).toBe(0)
      expect(u.percentage).toBe(0)
      expect(u.planName).toBe('unknown')
    })
  })
})
