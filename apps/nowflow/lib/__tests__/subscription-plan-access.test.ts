import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEffectiveSubscriptionPlan } from '@/lib/subscription-plan-access'

const { db, state } = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    selectCallCount: 0,
    selectErrorOnCall: null as number | null,
  }

  const db = {
    select: vi.fn(() => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        orderBy: () => chain,
        innerJoin: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          state.selectCallCount += 1
          if (
            state.selectErrorOnCall !== null &&
            state.selectErrorOnCall === state.selectCallCount
          ) {
            if (reject) return reject(new Error('db error'))
            throw new Error('db error')
          }
          const next = state.selectQueue.shift() ?? []
          return resolve(next)
        },
      }
      return chain
    }),
  }

  return { db, state }
})

vi.mock('@/db', () => ({ db }))

vi.mock('@/db/schema', () => ({
  subscriptionPlan: {
    id: 'id',
    name: 'name',
    displayName: 'displayName',
    workflowLimit: 'workflowLimit',
    apiCallsLimit: 'apiCallsLimit',
    storageLimit: 'storageLimit',
    costLimit: 'costLimit',
    sharingEnabled: 'sharingEnabled',
    multiplayerEnabled: 'multiplayerEnabled',
    workspaceCollaborationEnabled: 'workspaceCollaborationEnabled',
    price: 'price',
  },
  subscription: {
    id: 'id',
    planId: 'planId',
    referenceId: 'referenceId',
    status: 'status',
  },
  member: {
    userId: 'userId',
    organizationId: 'organizationId',
  },
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

describe('subscription-plan-access', () => {
  beforeEach(() => {
    state.selectQueue = []
    state.selectCallCount = 0
    state.selectErrorOnCall = null
    db.select.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the fallback free plan when userId is empty', async () => {
    const plan = await getEffectiveSubscriptionPlan('')
    expect(plan.id).toBe('fallback-free-plan')
    expect(plan.name).toBe('free')
    expect(plan.displayName).toBe('Free')
    expect(plan.price).toBeNull()
    expect(plan.workflowLimit).toBe(3)
    expect(plan.apiCallsLimit).toBe(20)
    expect(plan.sharingEnabled).toBe(false)
    expect(plan.multiplayerEnabled).toBe(false)
    expect(plan.workspaceCollaborationEnabled).toBe(false)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('returns an active pro plan linked to the user', async () => {
    const proPlan = {
      id: 'plan_pro',
      name: 'pro',
      displayName: 'Pro',
      workflowLimit: 50,
      apiCallsLimit: 2000,
      storageLimit: 5120,
      costLimit: 40,
      sharingEnabled: true,
      multiplayerEnabled: false,
      workspaceCollaborationEnabled: false,
      price: 20,
    }

    state.selectQueue.push([]) // memberships
    state.selectQueue.push([proPlan]) // activePlan

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.id).toBe('plan_pro')
    expect(plan.name).toBe('pro')
    expect(plan.displayName).toBe('Pro')
    expect(plan.workflowLimit).toBe(50)
    expect(plan.sharingEnabled).toBe(true)
    expect(plan.multiplayerEnabled).toBe(false)
    expect(plan.price).toBe(20)
  })

  it('returns an active team plan with collaboration features enabled', async () => {
    const teamPlan = {
      id: 'plan_team',
      name: 'team',
      displayName: 'Team',
      workflowLimit: 200,
      apiCallsLimit: 10000,
      storageLimit: 20480,
      costLimit: 40,
      sharingEnabled: true,
      multiplayerEnabled: true,
      workspaceCollaborationEnabled: true,
      price: 50,
    }

    state.selectQueue.push([{ organizationId: 'org_1' }]) // memberships
    state.selectQueue.push([teamPlan]) // activePlan

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.name).toBe('team')
    expect(plan.sharingEnabled).toBe(true)
    expect(plan.multiplayerEnabled).toBe(true)
    expect(plan.workspaceCollaborationEnabled).toBe(true)
    expect(plan.workflowLimit).toBe(200)
  })

  it('falls back to the DB-seeded free plan when no active subscription exists', async () => {
    const freePlanFromDb = {
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

    state.selectQueue.push([]) // memberships
    state.selectQueue.push([]) // activePlan - none
    state.selectQueue.push([freePlanFromDb]) // seeded free plan

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.id).toBe('plan_free')
    expect(plan.name).toBe('free')
    expect(plan.workflowLimit).toBe(3)
    expect(plan.sharingEnabled).toBe(false)
  })

  it('falls back to hardcoded DEFAULT_FREE_PLAN when DB query throws', async () => {
    state.selectErrorOnCall = 1 // first select throws

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.id).toBe('fallback-free-plan')
    expect(plan.name).toBe('free')
    expect(plan.price).toBeNull()
    expect(plan.workflowLimit).toBe(3)
  })

  it('falls back to hardcoded DEFAULT_FREE_PLAN when neither active nor seeded free plan is found', async () => {
    state.selectQueue.push([]) // memberships
    state.selectQueue.push([]) // activePlan
    state.selectQueue.push([]) // seeded free plan lookup - empty

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.id).toBe('fallback-free-plan')
    expect(plan.name).toBe('free')
    expect(plan.displayName).toBe('Free')
  })

  it('defaults plan name to "free" when the active plan row has null name', async () => {
    const planWithoutName = {
      id: 'plan_x',
      name: null,
      displayName: 'Mystery',
      workflowLimit: 10,
      apiCallsLimit: 100,
      storageLimit: 500,
      costLimit: 15,
      sharingEnabled: false,
      multiplayerEnabled: false,
      workspaceCollaborationEnabled: false,
      price: 0,
    }

    state.selectQueue.push([]) // memberships
    state.selectQueue.push([planWithoutName]) // active plan with null name

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.name).toBe('free')
    expect(plan.id).toBe('plan_x')
    expect(plan.displayName).toBe('Mystery')
  })

  it('combines user and organization reference ids when looking up active subscriptions', async () => {
    const enterprisePlan = {
      id: 'plan_ent',
      name: 'enterprise',
      displayName: 'Enterprise',
      workflowLimit: 999999,
      apiCallsLimit: 999999,
      storageLimit: 999999,
      costLimit: 999999,
      sharingEnabled: true,
      multiplayerEnabled: true,
      workspaceCollaborationEnabled: true,
      price: null,
    }

    state.selectQueue.push([{ organizationId: 'org_a' }, { organizationId: 'org_b' }]) // memberships
    state.selectQueue.push([enterprisePlan])

    const plan = await getEffectiveSubscriptionPlan('user_1')

    expect(plan.name).toBe('enterprise')
    expect(plan.workflowLimit).toBe(999999)
    expect(plan.sharingEnabled).toBe(true)
    expect(plan.multiplayerEnabled).toBe(true)
    expect(plan.workspaceCollaborationEnabled).toBe(true)
  })
})
