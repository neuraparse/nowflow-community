/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// -------------------------------------------------------------------------
// Hoisted mocks
// -------------------------------------------------------------------------

const { selectMock, getEffectiveSubscriptionPlanMock, isProdRef } = vi.hoisted(() => {
  const selectMock = vi.fn()
  const getEffectiveSubscriptionPlanMock = vi.fn()
  const isProdRef = { value: false }
  return { selectMock, getEffectiveSubscriptionPlanMock, isProdRef }
})

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _eq: true, a, b })),
}))

vi.mock('@/lib/environment', () => ({
  get isProd() {
    return isProdRef.value
  },
}))

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => selectMock(...args),
  },
}))

vi.mock('@/db/schema', () => ({
  userStats: {
    id: 'userStats.id',
    userId: 'userStats.userId',
    totalCost: 'userStats.totalCost',
  },
}))

vi.mock('@/lib/subscription-plan-access', () => ({
  getEffectiveSubscriptionPlan: (...args: any[]) => getEffectiveSubscriptionPlanMock(...args),
}))

// Build a drizzle-style chainable query that returns provided rows
function makeQueryChain(rows: any[] | Error) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => {
      if (rows instanceof Error) return Promise.reject(rows)
      return Promise.resolve(rows)
    }),
  }
  return chain
}

describe('usage-monitor', () => {
  beforeEach(() => {
    selectMock.mockReset()
    getEffectiveSubscriptionPlanMock.mockReset()
    isProdRef.value = false
    // Default: test mode (not prod, NODE_ENV=test)
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  describe('checkUsageStatus (non-prod / test env)', () => {
    it('returns permissive defaults with actual usage when DB is available', async () => {
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '42.5' }]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')

      expect(result.currentUsage).toBe(42.5)
      expect(result.limit).toBe(1000)
      expect(result.isExceeded).toBe(false)
      expect(result.isWarning).toBe(false)
      expect(result.percentUsed).toBe(Math.round((42.5 / 1000) * 100))
    })

    it('falls back to permissive defaults when DB query throws', async () => {
      selectMock.mockReturnValue(makeQueryChain(new Error('db down')))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result).toEqual({
        percentUsed: 0,
        isWarning: false,
        isExceeded: false,
        currentUsage: 0,
        limit: 1000,
      })
    })

    it('returns zeros when no user stats row exists', async () => {
      selectMock.mockReturnValue(makeQueryChain([]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result.currentUsage).toBe(0)
      expect(result.percentUsed).toBe(0)
    })
  })

  describe('checkUsageStatus (prod env)', () => {
    beforeEach(() => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('returns zero usage when no stats record exists', async () => {
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 20 })
      selectMock.mockReturnValue(makeQueryChain([]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result).toEqual({
        percentUsed: 0,
        isWarning: false,
        isExceeded: false,
        currentUsage: 0,
        limit: 20,
      })
    })

    it('flags isWarning when usage is >=80% but <100%', async () => {
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '85' }]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result.percentUsed).toBe(85)
      expect(result.isWarning).toBe(true)
      expect(result.isExceeded).toBe(false)
    })

    it('flags isExceeded when usage >= limit', async () => {
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 50 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '75' }]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result.isExceeded).toBe(true)
      expect(result.percentUsed).toBe(100) // capped at 100
      expect(result.isWarning).toBe(false) // isWarning requires <100
    })

    it('does not flag warning at exactly 100%', async () => {
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '100' }]))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result.isExceeded).toBe(true)
      expect(result.isWarning).toBe(false)
    })

    it('returns safe-fail sentinel when plan lookup throws', async () => {
      getEffectiveSubscriptionPlanMock.mockRejectedValue(new Error('plan lookup failed'))
      const { checkUsageStatus } = await import('@/lib/usage-monitor')

      const result = await checkUsageStatus('user-1')
      expect(result).toEqual({
        percentUsed: 0,
        isWarning: false,
        isExceeded: true,
        currentUsage: 0,
        limit: 0,
      })
    })
  })

  describe('checkAndNotifyUsage', () => {
    it('is a no-op in development', async () => {
      isProdRef.value = false
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      const { checkAndNotifyUsage } = await import('@/lib/usage-monitor')
      await checkAndNotifyUsage('user-1')
      expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('dispatches usage-exceeded event when user is over limit in prod', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 10 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '15' }]))

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      const { checkAndNotifyUsage } = await import('@/lib/usage-monitor')
      await checkAndNotifyUsage('user-1')

      const events = dispatchSpy.mock.calls.map((c) => (c[0] as CustomEvent).type)
      expect(events).toContain('usage-exceeded')
    })

    it('dispatches usage-warning and open-settings events when user is approaching limit', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '85' }]))

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      const { checkAndNotifyUsage } = await import('@/lib/usage-monitor')
      await checkAndNotifyUsage('user-1')

      const events = dispatchSpy.mock.calls.map((c) => (c[0] as CustomEvent).type)
      expect(events).toContain('usage-warning')
      expect(events).toContain('open-settings')
    })

    it('does not dispatch any event when user is well under limit', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '5' }]))

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

      const { checkAndNotifyUsage } = await import('@/lib/usage-monitor')
      await checkAndNotifyUsage('user-1')

      expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('swallows errors silently', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockRejectedValue(new Error('boom'))

      const { checkAndNotifyUsage } = await import('@/lib/usage-monitor')
      await expect(checkAndNotifyUsage('user-1')).resolves.toBeUndefined()
    })
  })

  describe('checkServerSideUsageLimits', () => {
    it('returns permissive defaults in development', async () => {
      isProdRef.value = false
      const { checkServerSideUsageLimits } = await import('@/lib/usage-monitor')

      const result = await checkServerSideUsageLimits('user-1')
      expect(result).toEqual({
        isExceeded: false,
        currentUsage: 0,
        limit: 1000,
      })
    })

    it('includes an upgrade message when limit is exceeded in prod', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 10 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '15' }]))

      const { checkServerSideUsageLimits } = await import('@/lib/usage-monitor')
      const result = await checkServerSideUsageLimits('user-1')

      expect(result.isExceeded).toBe(true)
      expect(result.message).toContain('Usage limit exceeded')
      expect(result.message).toContain('15.00$')
      expect(result.message).toContain('10$')
    })

    it('omits a message when within limits', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })
      selectMock.mockReturnValue(makeQueryChain([{ totalCost: '5' }]))

      const { checkServerSideUsageLimits } = await import('@/lib/usage-monitor')
      const result = await checkServerSideUsageLimits('user-1')

      expect(result.isExceeded).toBe(false)
      expect(result.message).toBeUndefined()
    })

    it('returns a safe-fail sentinel with an error message when checkUsageStatus throws', async () => {
      isProdRef.value = true
      vi.stubEnv('NODE_ENV', 'production')
      // Make db.select itself throw synchronously (not via chain)
      selectMock.mockImplementation(() => {
        throw new Error('select exploded')
      })
      getEffectiveSubscriptionPlanMock.mockResolvedValue({ name: 'free', costLimit: 100 })

      const { checkServerSideUsageLimits } = await import('@/lib/usage-monitor')
      const result = await checkServerSideUsageLimits('user-1')

      // Inner checkUsageStatus catches and returns a sentinel (limit:0, isExceeded:true)
      // which bubbles to server-side result with a message
      expect(result.isExceeded).toBe(true)
      expect(result.limit).toBe(0)
    })
  })
})
