import { describe, expect, it } from 'vitest'
import {
  formatApiCalls,
  formatStorageSize,
  getDefaultLimits,
  getTierLimits,
  type SubscriptionTier,
  TIER_LIMITS,
} from '@/lib/subscription-limits'

describe('subscription-limits', () => {
  describe('TIER_LIMITS', () => {
    it('defines limits for every known tier', () => {
      const expected: SubscriptionTier[] = ['free', 'starter', 'mid', 'pro', 'team', 'enterprise']
      for (const tier of expected) {
        expect(TIER_LIMITS[tier]).toBeDefined()
      }
    })

    it('free tier has the most restrictive limits', () => {
      const free = TIER_LIMITS.free
      expect(free.workflowLimit).toBe(3)
      expect(free.apiCallsLimit).toBe(20)
      expect(free.storageLimit).toBe(50)
      expect(free.costLimit).toBe(5)
      expect(free.sharingEnabled).toBe(false)
      expect(free.multiplayerEnabled).toBe(false)
      expect(free.workspaceCollaborationEnabled).toBe(false)
    })

    it('pro tier enables sharing but not multiplayer/collaboration', () => {
      const pro = TIER_LIMITS.pro
      expect(pro.workflowLimit).toBe(50)
      expect(pro.apiCallsLimit).toBe(2000)
      expect(pro.storageLimit).toBe(5120)
      expect(pro.sharingEnabled).toBe(true)
      expect(pro.multiplayerEnabled).toBe(false)
      expect(pro.workspaceCollaborationEnabled).toBe(false)
    })

    it('team tier enables multiplayer and workspace collaboration', () => {
      const team = TIER_LIMITS.team
      expect(team.sharingEnabled).toBe(true)
      expect(team.multiplayerEnabled).toBe(true)
      expect(team.workspaceCollaborationEnabled).toBe(true)
      expect(team.workflowLimit).toBe(200)
      expect(team.storageLimit).toBe(20480)
    })

    it('enterprise tier uses effectively-unlimited values', () => {
      const ent = TIER_LIMITS.enterprise
      expect(ent.workflowLimit).toBe(999999)
      expect(ent.apiCallsLimit).toBe(999999)
      expect(ent.storageLimit).toBe(999999)
      expect(ent.costLimit).toBe(999999)
      expect(ent.sharingEnabled).toBe(true)
      expect(ent.multiplayerEnabled).toBe(true)
    })

    it('workflow limits are monotonically non-decreasing up through team', () => {
      const tiersInOrder: SubscriptionTier[] = ['free', 'starter', 'mid', 'pro', 'team']
      for (let i = 1; i < tiersInOrder.length; i++) {
        expect(TIER_LIMITS[tiersInOrder[i]].workflowLimit).toBeGreaterThanOrEqual(
          TIER_LIMITS[tiersInOrder[i - 1]].workflowLimit
        )
      }
    })

    it('storage limits are monotonically non-decreasing up through team', () => {
      const tiersInOrder: SubscriptionTier[] = ['free', 'starter', 'mid', 'pro', 'team']
      for (let i = 1; i < tiersInOrder.length; i++) {
        expect(TIER_LIMITS[tiersInOrder[i]].storageLimit).toBeGreaterThanOrEqual(
          TIER_LIMITS[tiersInOrder[i - 1]].storageLimit
        )
      }
    })
  })

  describe('getTierLimits', () => {
    it('returns the free tier config', () => {
      expect(getTierLimits('free')).toEqual(TIER_LIMITS.free)
    })

    it('returns the pro tier config', () => {
      expect(getTierLimits('pro')).toEqual(TIER_LIMITS.pro)
    })

    it('returns the enterprise tier config', () => {
      expect(getTierLimits('enterprise')).toEqual(TIER_LIMITS.enterprise)
    })

    it('returns the same reference as TIER_LIMITS', () => {
      expect(getTierLimits('starter')).toBe(TIER_LIMITS.starter)
    })
  })

  describe('getDefaultLimits', () => {
    it('returns free tier as the default', () => {
      expect(getDefaultLimits()).toEqual(TIER_LIMITS.free)
    })
  })

  describe('formatStorageSize', () => {
    it('returns "0 B" for zero', () => {
      expect(formatStorageSize(0)).toBe('0 B')
    })

    it('formats bytes under 1 KB', () => {
      expect(formatStorageSize(512)).toBe('512 B')
    })

    it('formats exact KB boundary', () => {
      expect(formatStorageSize(1024)).toBe('1 KB')
    })

    it('formats MB values', () => {
      expect(formatStorageSize(1024 * 1024)).toBe('1 MB')
    })

    it('formats GB values', () => {
      expect(formatStorageSize(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('formats TB values', () => {
      expect(formatStorageSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
    })

    it('formats non-round MB values with 2-decimal precision', () => {
      expect(formatStorageSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })
  })

  describe('formatApiCalls', () => {
    it('returns plain numbers below 1K', () => {
      expect(formatApiCalls(0)).toBe('0')
      expect(formatApiCalls(999)).toBe('999')
    })

    it('formats thousands with K suffix', () => {
      expect(formatApiCalls(1000)).toBe('1.0K')
      expect(formatApiCalls(1500)).toBe('1.5K')
      expect(formatApiCalls(999999)).toBe('1000.0K')
    })

    it('formats millions with M suffix', () => {
      expect(formatApiCalls(1_000_000)).toBe('1.0M')
      expect(formatApiCalls(2_500_000)).toBe('2.5M')
    })

    it('handles the exact 1000 boundary', () => {
      expect(formatApiCalls(999)).toBe('999')
      expect(formatApiCalls(1000)).toBe('1.0K')
    })

    it('handles the exact 1M boundary', () => {
      expect(formatApiCalls(999_999)).not.toBe('1.0M')
      expect(formatApiCalls(1_000_000)).toBe('1.0M')
    })
  })
})
