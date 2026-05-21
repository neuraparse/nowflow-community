import { beforeEach, describe, expect, it, vi } from 'vitest'
// -- Imports after mocks ----------------------------------------------------

import { canMakeApiCall, consumeApiCallQuota, getApiCallUsage } from '@/lib/api-rate-limits'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'

// -- Mocks (must be declared before importing the module under test) --------

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/environment', () => ({
  isProd: true,
}))

vi.mock('@/lib/subscription-plan-access', () => ({
  getEffectiveSubscriptionPlan: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ __op: 'eq', a, b })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      __sql: strings.join('?'),
      values,
    }),
    { raw: vi.fn() }
  ),
}))

vi.mock('@/db/schema', () => ({
  userStats: {
    userId: { name: 'userId' },
    apiCallsToday: { name: 'apiCallsToday' },
    apiCallsResetAt: { name: 'apiCallsResetAt' },
    lastActive: { name: 'lastActive' },
  },
}))

// A mock-DB with chainable query builders and a controllable transaction.
type SelectResult = any[]

const dbState: {
  selectResults: SelectResult[]
  insertCalls: any[]
  updateCalls: any[]
  executeCalls: any[]
  shouldThrowOnSelect: boolean
  transactionShouldThrow: boolean
} = {
  selectResults: [],
  insertCalls: [],
  updateCalls: [],
  executeCalls: [],
  shouldThrowOnSelect: false,
  transactionShouldThrow: false,
}

const makeSelectChain = () => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn(() => {
    if (dbState.shouldThrowOnSelect) {
      throw new Error('db exploded')
    }
    const next = dbState.selectResults.shift()
    return Promise.resolve(next ?? [])
  }),
})

const makeInsertChain = () => ({
  values: vi.fn((vals) => {
    dbState.insertCalls.push(vals)
    return Promise.resolve()
  }),
})

const makeUpdateChain = () => ({
  set: vi.fn(function (this: any, vals: any) {
    this.__setVals = vals
    return this
  }),
  where: vi.fn(function (this: any, cond: any) {
    dbState.updateCalls.push({ set: this.__setVals, where: cond })
    return Promise.resolve()
  }),
})

const mockTx = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
  execute: vi.fn((val: any) => {
    dbState.executeCalls.push(val)
    return Promise.resolve()
  }),
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => makeInsertChain()),
    update: vi.fn(() => makeUpdateChain()),
    execute: vi.fn((val: any) => {
      dbState.executeCalls.push(val)
      return Promise.resolve()
    }),
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<any>) => {
      if (dbState.transactionShouldThrow) {
        throw new Error('tx failed')
      }
      return fn(mockTx)
    }),
  },
}))

const planMock = getEffectiveSubscriptionPlan as unknown as ReturnType<typeof vi.fn>

const resetState = () => {
  dbState.selectResults = []
  dbState.insertCalls = []
  dbState.updateCalls = []
  dbState.executeCalls = []
  dbState.shouldThrowOnSelect = false
  dbState.transactionShouldThrow = false
}

beforeEach(() => {
  resetState()
  planMock.mockReset()
})

// ---------------------------------------------------------------------------
// canMakeApiCall
// ---------------------------------------------------------------------------
describe('canMakeApiCall', () => {
  it('allows the call when under the plan limit', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 100, name: 'free', displayName: 'Free' })

    // 1st select: resetDailyCounterIfNeeded -> return stats with recent reset
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 5,
        apiCallsResetAt: new Date(),
      },
    ])
    // 2nd select: ensureUserStatsRecord -> stats exist
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 5,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await canMakeApiCall('u1')
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(5)
    expect(result.limit).toBe(100)
  })

  it('denies the call when at/over the plan limit', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 10, name: 'free', displayName: 'Free' })

    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 10,
        apiCallsResetAt: new Date(),
      },
    ])
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 10,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await canMakeApiCall('u1')
    expect(result.allowed).toBe(false)
    expect(result.currentCalls).toBe(10)
    expect(result.limit).toBe(10)
    expect(result.message).toMatch(/reached the API call limit/i)
    expect(result.message).toContain('Free')
  })

  it('creates a user stats record when none exists', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 50, name: 'free', displayName: 'Free' })

    // reset check -> no stats
    dbState.selectResults.push([])
    // ensureUserStatsRecord: first select empty, then after insert returns a row
    dbState.selectResults.push([])
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 0,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await canMakeApiCall('u1')
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(0)
    expect(dbState.insertCalls.length).toBeGreaterThan(0)
    expect(dbState.insertCalls[0]).toMatchObject({
      id: 'stats_u1',
      userId: 'u1',
      apiCallsToday: 0,
    })
  })

  it('resets the daily counter when more than 24 hours have passed', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 100, name: 'free', displayName: 'Free' })

    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000)
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 100,
        apiCallsResetAt: stale,
      },
    ])
    // After the reset update, ensureUserStatsRecord runs and sees refreshed data
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 0,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await canMakeApiCall('u1')
    expect(dbState.updateCalls.length).toBe(1)
    expect(dbState.updateCalls[0].set).toMatchObject({ apiCallsToday: 0 })
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(0)
  })

  it('returns a safe denied result when the plan lookup throws', async () => {
    planMock.mockRejectedValue(new Error('plan lookup broke'))
    // reset check still runs first
    dbState.selectResults.push([])

    const result = await canMakeApiCall('u1')
    expect(result.allowed).toBe(false)
    expect(result.currentCalls).toBe(0)
    expect(result.limit).toBe(0)
    expect(result.message).toMatch(/unable to verify/i)
  })
})

// ---------------------------------------------------------------------------
// consumeApiCallQuota
// ---------------------------------------------------------------------------
describe('consumeApiCallQuota', () => {
  it('reserves one call when under the limit', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 10, name: 'free', displayName: 'Free' })

    // Within transaction: first select returns existing stats
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 3,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await consumeApiCallQuota('u1')
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(4)
    expect(result.limit).toBe(10)
    // Advisory lock acquired
    expect(dbState.executeCalls.length).toBe(1)
    // Update increments counter
    expect(dbState.updateCalls.length).toBe(1)
    expect(dbState.updateCalls[0].set).toMatchObject({ apiCallsToday: 4 })
  })

  it('refuses and reports limit message when quota exhausted', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 10, name: 'pro', displayName: 'Pro' })

    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 10,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await consumeApiCallQuota('u1')
    expect(result.allowed).toBe(false)
    expect(result.currentCalls).toBe(10)
    expect(result.limit).toBe(10)
    expect(result.message).toContain('Pro')
    expect(result.message).toContain('10 calls/day')
    // No update happens when refusing
    expect(dbState.updateCalls.length).toBe(0)
  })

  it('inserts a new stats row when missing, then reserves', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 50, name: 'free', displayName: 'Free' })

    // First select in tx -> empty
    dbState.selectResults.push([])
    // After insert, re-select returns the new row
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 0,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await consumeApiCallQuota('u1')
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(1)
    expect(dbState.insertCalls.length).toBe(1)
    expect(dbState.insertCalls[0]).toMatchObject({ id: 'stats_u1', userId: 'u1' })
  })

  it('resets counter atomically when >=24h elapsed, then reserves', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 100, name: 'free', displayName: 'Free' })

    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000)
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 100,
        apiCallsResetAt: stale,
      },
    ])

    const result = await consumeApiCallQuota('u1')
    expect(result.allowed).toBe(true)
    expect(result.currentCalls).toBe(1)
    // Expect a reset update and an increment update
    expect(dbState.updateCalls.length).toBe(2)
    expect(dbState.updateCalls[0].set).toMatchObject({ apiCallsToday: 0 })
    expect(dbState.updateCalls[1].set).toMatchObject({ apiCallsToday: 1 })
  })

  it('returns a safe denied result when the plan lookup throws', async () => {
    planMock.mockRejectedValue(new Error('plan lookup broke'))

    const result = await consumeApiCallQuota('u1')
    expect(result.allowed).toBe(false)
    expect(result.currentCalls).toBe(0)
    expect(result.limit).toBe(0)
    expect(result.message).toMatch(/unable to reserve/i)
  })
})

// ---------------------------------------------------------------------------
// getApiCallUsage
// ---------------------------------------------------------------------------
describe('getApiCallUsage', () => {
  it('returns usage breakdown including percentage and tier', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 100, name: 'pro', displayName: 'Pro' })

    // reset check -> stats exist, recent reset, no reset needed
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 25,
        apiCallsResetAt: new Date(),
      },
    ])
    // ensureUserStatsRecord
    dbState.selectResults.push([
      {
        userId: 'u1',
        apiCallsToday: 25,
        apiCallsResetAt: new Date(),
      },
    ])

    const result = await getApiCallUsage('u1')
    expect(result).toEqual({
      current: 25,
      limit: 100,
      percentage: 25,
      tier: 'pro',
    })
  })

  it('returns zeros on error', async () => {
    planMock.mockRejectedValue(new Error('boom'))
    // reset check still tries to select first
    dbState.selectResults.push([])

    const result = await getApiCallUsage('u1')
    expect(result).toEqual({
      current: 0,
      limit: 0,
      percentage: 0,
      tier: 'unknown',
    })
  })

  it('rounds percentage as expected', async () => {
    planMock.mockResolvedValue({ apiCallsLimit: 3, name: 'free', displayName: 'Free' })

    dbState.selectResults.push([{ userId: 'u1', apiCallsToday: 1, apiCallsResetAt: new Date() }])
    dbState.selectResults.push([{ userId: 'u1', apiCallsToday: 1, apiCallsResetAt: new Date() }])

    const result = await getApiCallUsage('u1')
    // 1/3 = 33.333... rounded to 33
    expect(result.percentage).toBe(33)
  })
})
