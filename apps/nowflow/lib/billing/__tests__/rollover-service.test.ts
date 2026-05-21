import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStarterPlan } from '@/lib/subscription'
import { db } from '@/db'
import { RolloverService } from '../rollover-service'

vi.mock('@/db', () => {
  const selectResult = {
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => []), orderBy: vi.fn(() => []) })),
    })),
  }
  return {
    db: {
      select: vi.fn(() => selectResult),
      insert: vi.fn(() => ({ values: vi.fn() })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
      })),
    },
  }
})
vi.mock('@/db/schema', () => ({
  subscription: { referenceId: 'referenceId', planId: 'planId', status: 'status' },
  subscriptionPlan: {
    id: 'id',
    name: 'name',
    apiCallsLimit: 'apiCallsLimit',
    storageLimit: 'storageLimit',
    costLimit: 'costLimit',
    workflowLimit: 'workflowLimit',
    $inferSelect: {},
  },
  userStats: { userId: 'userId', $inferSelect: {} },
  quotaRollover: {
    id: 'id',
    userId: 'userId',
    quotaType: 'quotaType',
    status: 'status',
    expiresAt: 'expiresAt',
    rolledFromDate: 'rolledFromDate',
  },
}))
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/subscription', () => ({ isStarterPlan: vi.fn() }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  ne: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  lte: vi.fn(),
}))

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function mockPlanQuery(plan: Record<string, unknown> | null) {
  const rows = plan ? [plan] : []
  mockDb.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(() => rows) })),
      })),
    })),
  })
}

function mockStatsQuery(stats: Record<string, unknown>[] = []) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => stats) })) })),
  })
}

function mockRolloverSelect(rows: Record<string, unknown>[] = []) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => rows),
      orderBy: undefined,
    })),
  })
  // Also handle chained orderBy variant
}

const svc = new RolloverService()

describe('RolloverService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('calculateUnusedQuota', () => {
    it('returns 0 when user has no plan', async () => {
      mockPlanQuery(null)
      expect(await svc.calculateUnusedQuota('u1', 'api_calls')).toBe(0)
    })

    it('returns full limit when no usage stats exist', async () => {
      mockPlanQuery({ apiCallsLimit: 1000 })
      mockStatsQuery([])
      expect(await svc.calculateUnusedQuota('u1', 'api_calls')).toBe(1000)
    })

    it('computes unused as limit minus usage', async () => {
      mockPlanQuery({ apiCallsLimit: 1000 })
      mockStatsQuery([{ totalApiCalls: 300 }])
      expect(await svc.calculateUnusedQuota('u1', 'api_calls')).toBe(700)
    })

    it('returns 0 when usage exceeds limit', async () => {
      mockPlanQuery({ apiCallsLimit: 100 })
      mockStatsQuery([{ totalApiCalls: 200 }])
      expect(await svc.calculateUnusedQuota('u1', 'api_calls')).toBe(0)
    })
  })

  describe('createRollover', () => {
    it('returns null for free-plan users', async () => {
      vi.mocked(isStarterPlan).mockResolvedValue(false)
      const result = await svc.createRollover('u1', 'api_calls', new Date(), new Date())
      expect(result).toBeNull()
    })

    it('caps rollover at 50% of plan limit', async () => {
      vi.mocked(isStarterPlan).mockResolvedValue(true)
      // getPlanForUser for createRollover
      mockPlanQuery({ apiCallsLimit: 1000 })
      // calculateUnusedQuota internal calls
      mockPlanQuery({ apiCallsLimit: 1000 })
      mockStatsQuery([{ totalApiCalls: 0 }]) // 1000 unused, but cap is 500
      mockDb.insert.mockReturnValue({ values: vi.fn() })

      const result = await svc.createRollover(
        'u1',
        'api_calls',
        new Date('2025-01-01'),
        new Date('2025-02-01')
      )
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(500) // 50% of 1000
    })
  })

  describe('getAvailableQuota', () => {
    it('sums base quota and active rollover remainder', async () => {
      mockPlanQuery({ storageLimit: 500 })
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => [
            { amount: 100, consumedAmount: 20 },
            { amount: 50, consumedAmount: 50 },
          ]),
        })),
      })
      expect(await svc.getAvailableQuota('u1', 'storage')).toBe(580) // 500 + 80 + 0
    })
  })

  describe('consumeQuota', () => {
    it('returns 0 for non-positive amounts', async () => {
      expect(await svc.consumeQuota('u1', 'api_calls', 0)).toBe(0)
    })

    it('consumes oldest rollover first (FIFO) and marks consumed', async () => {
      const updateSet = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) }))
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => [
              { id: 'r1', amount: 30, consumedAmount: 10 }, // 20 available
              { id: 'r2', amount: 50, consumedAmount: 0 }, // 50 available
            ]),
          })),
        })),
      })
      mockDb.update.mockReturnValue({ set: updateSet })

      const consumed = await svc.consumeQuota('u1', 'api_calls', 40)
      expect(consumed).toBe(40)
      expect(mockDb.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('expireOldRollovers', () => {
    it('returns count of expired rollovers', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => [{ id: 'r1' }, { id: 'r2' }]),
          })),
        })),
      })
      expect(await svc.expireOldRollovers()).toBe(2)
    })
  })

  describe('getQuotaBreakdown', () => {
    it('returns full breakdown with rollover and usage', async () => {
      mockPlanQuery({ apiCallsLimit: 1000, planName: 'pro' })
      mockStatsQuery([{ totalApiCalls: 200 }])
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ amount: 100, consumedAmount: 10 }]),
        })),
      })
      const bd = await svc.getQuotaBreakdown('u1', 'api_calls')
      expect(bd.baseQuota).toBe(1000)
      expect(bd.rolloverAmount).toBe(90)
      expect(bd.totalAvailable).toBe(1090)
      expect(bd.usage).toBe(200)
      expect(bd.remaining).toBe(890)
      expect(bd.planName).toBe('pro')
    })
  })
})
