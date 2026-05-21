import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canExecuteTrigger,
  canSendEmailTo,
  canSendFailureNotification,
  canSendWorkflowNotification,
  getTriggerRemainingExecutions,
} from '@/lib/spam-guard'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock the redis-store with a deterministic in-memory fixed-window
// counter so tests don't depend on a live Redis instance and the
// per-key state is predictable across tests.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

const checkRateLimit = vi.fn(async (key: string, limit: number, windowMs: number) => {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt, backend: 'memory' as const }
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, backend: 'memory' as const }
  }
  existing.count++
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    backend: 'memory' as const,
  }
})

vi.mock('@/lib/rate-limit/redis-store', () => ({
  redisRateLimit: {
    checkRateLimit: (...args: [string, number, number]) => checkRateLimit(...args),
  },
}))

describe('spam-guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
    buckets.clear()
    checkRateLimit.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Use unique identifiers per test to keep keys predictable.
  let counter = 0
  const uniq = (label: string) => `${label}-${counter++}`

  describe('delegation to redisRateLimit', () => {
    it('canSendEmailTo delegates with spam:email: prefix and correct limits', async () => {
      const email = `${uniq('user')}@example.com`
      await canSendEmailTo(email)
      expect(checkRateLimit).toHaveBeenCalledWith(`spam:email:min:${email}`, 10, 60 * 1000)
      expect(checkRateLimit).toHaveBeenCalledWith(`spam:email:hour:${email}`, 50, 60 * 60 * 1000)
    })

    it('canExecuteTrigger delegates with spam:trigger: prefix and correct limits', async () => {
      const triggerId = uniq('trig')
      await canExecuteTrigger(triggerId)
      expect(checkRateLimit).toHaveBeenCalledWith(`spam:trigger:min:${triggerId}`, 30, 60 * 1000)
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:trigger:hour:${triggerId}`,
        500,
        60 * 60 * 1000
      )
    })

    it('canSendWorkflowNotification delegates with spam:notification: prefix', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      await canSendWorkflowNotification(userId, workflowId)
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:notification:wf:${userId}:${workflowId}`,
        3,
        10 * 1000
      )
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:notification:user-hour:${userId}`,
        120,
        60 * 60 * 1000
      )
    })

    it('canSendFailureNotification delegates with spam:notification: prefix', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      await canSendFailureNotification(userId, workflowId)
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:notification:failure-circuit:${userId}:${workflowId}`,
        5,
        60 * 60 * 1000
      )
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:notification:failure-wf:${userId}:${workflowId}`,
        2,
        5 * 60 * 1000
      )
      expect(checkRateLimit).toHaveBeenCalledWith(
        `spam:notification:failure-user-hour:${userId}`,
        20,
        60 * 60 * 1000
      )
    })

    it('uses distinct prefixes so notification/email/trigger keys cannot collide', async () => {
      const id = uniq('shared-id')
      await canSendEmailTo(`${id}@example.com`)
      await canExecuteTrigger(id)
      await canSendWorkflowNotification(id, id)

      const allKeys = checkRateLimit.mock.calls.map((c) => c[0])
      // Every key must start with one of the three namespaces
      for (const key of allKeys) {
        expect(
          key.startsWith('spam:email:') ||
            key.startsWith('spam:trigger:') ||
            key.startsWith('spam:notification:')
        ).toBe(true)
      }
    })
  })

  describe('canSendWorkflowNotification', () => {
    it('allows the first notification for a workflow', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(true)
    })

    it('allows up to NOTIFICATION_MAX_PER_WORKFLOW (3) in the cooldown window', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(true)
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(true)
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(true)
    })

    it('blocks the 4th notification within the 10s workflow cooldown', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      for (let i = 0; i < 3; i++) {
        await canSendWorkflowNotification(userId, workflowId)
      }
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(false)
    })

    it('re-allows after the 10s cooldown window passes', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      for (let i = 0; i < 3; i++) {
        await canSendWorkflowNotification(userId, workflowId)
      }
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(false)

      // Advance past cooldown
      vi.advanceTimersByTime(10 * 1000 + 1)
      expect(await canSendWorkflowNotification(userId, workflowId)).toBe(true)
    })

    it('separate workflows are tracked independently', async () => {
      const userId = uniq('user')
      const wfA = uniq('wfA')
      const wfB = uniq('wfB')
      for (let i = 0; i < 3; i++) {
        await canSendWorkflowNotification(userId, wfA)
      }
      expect(await canSendWorkflowNotification(userId, wfA)).toBe(false)
      expect(await canSendWorkflowNotification(userId, wfB)).toBe(true)
    })
  })

  describe('canSendFailureNotification', () => {
    it('allows an initial failure notification', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      expect(await canSendFailureNotification(userId, workflowId)).toBe(true)
    })

    it('blocks beyond FAILURE_MAX_PER_WORKFLOW (2) within 5 min cooldown', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      // First two allowed
      expect(await canSendFailureNotification(userId, workflowId)).toBe(true)
      expect(await canSendFailureNotification(userId, workflowId)).toBe(true)
      // Third should be blocked by per-workflow cooldown (FAILURE_MAX=2)
      expect(await canSendFailureNotification(userId, workflowId)).toBe(false)
    })

    it('opens the circuit breaker after threshold failures in an hour', async () => {
      const userId = uniq('user')
      const workflowId = uniq('wf')
      // Call up to threshold (5), advancing time past the 5 min per-workflow cooldown each time
      for (let i = 0; i < 5; i++) {
        expect(await canSendFailureNotification(userId, workflowId)).toBe(true)
        // Advance past per-workflow cooldown but within the 1hr circuit window
        vi.advanceTimersByTime(5 * 60 * 1000 + 1)
      }
      // Circuit breaker is now at threshold - next call should be blocked
      expect(await canSendFailureNotification(userId, workflowId)).toBe(false)
    })
  })

  describe('canSendEmailTo', () => {
    it('allows the first email to a recipient', async () => {
      const email = `${uniq('user')}@example.com`
      expect(await canSendEmailTo(email)).toBe(true)
    })

    it('normalizes email case and whitespace', async () => {
      const base = uniq('user')
      const lower = `${base}@example.com`
      const upper = `  ${base.toUpperCase()}@EXAMPLE.COM  `
      // First 10 allowed (per-minute limit)
      for (let i = 0; i < 10; i++) {
        expect(await canSendEmailTo(lower)).toBe(true)
      }
      // 11th should be blocked, and blocked for the same email in different case
      expect(await canSendEmailTo(upper)).toBe(false)
    })

    it('enforces the per-minute (10/min) burst limit', async () => {
      const email = `${uniq('user')}@example.com`
      for (let i = 0; i < 10; i++) {
        expect(await canSendEmailTo(email)).toBe(true)
      }
      expect(await canSendEmailTo(email)).toBe(false)
    })

    it('re-allows after the 1 minute window elapses', async () => {
      const email = `${uniq('user')}@example.com`
      for (let i = 0; i < 10; i++) {
        await canSendEmailTo(email)
      }
      expect(await canSendEmailTo(email)).toBe(false)

      vi.advanceTimersByTime(60 * 1000 + 1)
      expect(await canSendEmailTo(email)).toBe(true)
    })
  })

  describe('canExecuteTrigger', () => {
    it('allows initial execution', async () => {
      const triggerId = uniq('trig')
      expect(await canExecuteTrigger(triggerId)).toBe(true)
    })

    it('allows up to 30 per minute', async () => {
      const triggerId = uniq('trig')
      for (let i = 0; i < 30; i++) {
        expect(await canExecuteTrigger(triggerId)).toBe(true)
      }
      expect(await canExecuteTrigger(triggerId)).toBe(false)
    })

    it('re-allows after 1 minute window elapses', async () => {
      const triggerId = uniq('trig')
      for (let i = 0; i < 30; i++) {
        await canExecuteTrigger(triggerId)
      }
      expect(await canExecuteTrigger(triggerId)).toBe(false)

      vi.advanceTimersByTime(60 * 1000 + 1)
      expect(await canExecuteTrigger(triggerId)).toBe(true)
    })

    it('tracks different triggers independently', async () => {
      const t1 = uniq('trig')
      const t2 = uniq('trig')
      for (let i = 0; i < 30; i++) {
        await canExecuteTrigger(t1)
      }
      expect(await canExecuteTrigger(t1)).toBe(false)
      expect(await canExecuteTrigger(t2)).toBe(true)
    })
  })

  describe('getTriggerRemainingExecutions', () => {
    it('reports near-full remaining for a fresh trigger id', async () => {
      const triggerId = uniq('trig')
      const { perMinute, perHour } = await getTriggerRemainingExecutions(triggerId)
      // The remaining() helper itself consumes one slot per bucket, so a
      // fresh id reports limit-1 (29 / 499) on first call.
      expect(perMinute).toBe(29)
      expect(perHour).toBe(499)
    })

    it('decrements perMinute as the trigger fires', async () => {
      const triggerId = uniq('trig')
      await canExecuteTrigger(triggerId)
      await canExecuteTrigger(triggerId)
      await canExecuteTrigger(triggerId)
      // 3 consume + 1 from the remaining-call itself = 4 used out of 30
      const { perMinute } = await getTriggerRemainingExecutions(triggerId)
      expect(perMinute).toBe(26)
    })

    it('returns zero when the per-minute window is exhausted', async () => {
      const triggerId = uniq('trig')
      for (let i = 0; i < 30; i++) {
        await canExecuteTrigger(triggerId)
      }
      const { perMinute } = await getTriggerRemainingExecutions(triggerId)
      expect(perMinute).toBe(0)
    })
  })
})
