import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureFreePlan, ensureFreeSubscriptionForUser } from '@/lib/subscription-plan'

// ---------------------------------------------------------------------------
// DB mock with a lightweight query-builder chain.
// Each chained method returns a thenable so awaits resolve to the configured
// result. Tests swap result sets before each invocation.
// ---------------------------------------------------------------------------

const { db, dbResults } = vi.hoisted(() => {
  const dbResults = {
    select: [] as unknown[],
    insert: [] as unknown[],
    selectSequence: [] as unknown[][],
  }

  const buildSelectChain = () => {
    const chain: any = {
      from: (..._args: unknown[]) => chain,
      where: (..._args: unknown[]) => chain,
      limit: (..._args: unknown[]) => chain,
      orderBy: (..._args: unknown[]) => chain,
      innerJoin: (..._args: unknown[]) => chain,
      then: (resolve: (v: unknown) => unknown) => {
        if (dbResults.selectSequence.length > 0) {
          return resolve(dbResults.selectSequence.shift())
        }
        return resolve(dbResults.select)
      },
    }
    return chain
  }

  const buildInsertChain = () => {
    const chain: any = {
      values: (..._args: unknown[]) => chain,
      returning: async () => dbResults.insert,
    }
    return chain
  }

  const db = {
    select: vi.fn(() => buildSelectChain()),
    insert: vi.fn(() => buildInsertChain()),
    update: vi.fn(() => buildSelectChain()),
    delete: vi.fn(() => buildSelectChain()),
  }

  return { db, dbResults }
})

vi.mock('@/db', () => ({ db }))

vi.mock('@/db/schema', () => ({
  subscriptionPlan: { id: 'id', name: 'name' },
  subscription: { id: 'id', referenceId: 'referenceId' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  desc: vi.fn((x) => ({ desc: x })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('subscription-plan helpers', () => {
  beforeEach(() => {
    dbResults.select = []
    dbResults.insert = []
    dbResults.selectSequence = []
    db.select.mockClear()
    db.insert.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureFreePlan', () => {
    it('returns the existing FREE plan when one exists in the db', async () => {
      const existingPlan = {
        id: 'plan_free',
        name: 'free',
        displayName: 'Free',
        workflowLimit: 3,
      }
      dbResults.select = [existingPlan]

      const plan = await ensureFreePlan()

      expect(plan).toEqual(existingPlan)
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('creates and returns the default FREE plan when none exists', async () => {
      dbResults.select = [] // No existing plan
      const insertedPlan = {
        id: 'plan_free',
        name: 'free',
        displayName: 'Free',
        workflowLimit: 3,
        apiCallsLimit: 20,
        storageLimit: 50,
        costLimit: 5,
        sharingEnabled: false,
        multiplayerEnabled: false,
        workspaceCollaborationEnabled: false,
        price: null,
      }
      dbResults.insert = [insertedPlan]

      const plan = await ensureFreePlan()

      expect(plan).toEqual(insertedPlan)
      expect(db.insert).toHaveBeenCalledTimes(1)
    })
  })

  describe('ensureFreeSubscriptionForUser', () => {
    it('throws when userId is missing', async () => {
      await expect(ensureFreeSubscriptionForUser('')).rejects.toThrow(
        'User ID is required to ensure subscription'
      )
    })

    it('returns existing subscription when one is already present for the user', async () => {
      const existingSubscription = {
        id: 'sub_abc',
        planId: 'plan_free',
        referenceId: 'user_1',
        status: 'active',
      }
      dbResults.select = [existingSubscription]

      const sub = await ensureFreeSubscriptionForUser('user_1')

      expect(sub).toEqual(existingSubscription)
      // No insert needed since subscription already exists
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('creates a new FREE subscription when user has none', async () => {
      const freePlan = {
        id: 'plan_free',
        name: 'free',
        displayName: 'Free',
      }
      const createdSubscription = {
        id: 'sub_new',
        planId: 'plan_free',
        referenceId: 'user_1',
        status: 'active',
      }

      // Sequence:
      //  1) select sub -> []
      //  2) ensureFreePlan -> select plan -> [freePlan]
      dbResults.selectSequence = [[], [freePlan]]
      dbResults.insert = [createdSubscription]

      const sub = await ensureFreeSubscriptionForUser('user_1')

      expect(sub).toEqual(createdSubscription)
      expect(db.insert).toHaveBeenCalledTimes(1)
    })
  })
})
