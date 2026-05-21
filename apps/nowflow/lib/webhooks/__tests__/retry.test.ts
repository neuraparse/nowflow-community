import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Import AFTER setInterval override
import { cancelRetry, clearRetryQueue, getRetryQueueStatus, scheduleWebhookRetry } from '../retry'

const { dbMocks } = vi.hoisted(() => {
  const webhookRow: any = {
    retryEnabled: true,
    maxRetries: 3,
    retryDelay: 1,
  }
  const rowsRef: { current: any[] } = { current: [webhookRow] }
  const updateSet = vi.fn()
  const updateWhere = vi.fn(async () => undefined)

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rowsRef.current),
      })),
    })),
  }))

  const update = vi.fn(() => ({
    set: (...args: any[]) => {
      updateSet(...args)
      return { where: updateWhere }
    },
  }))

  return {
    dbMocks: {
      select,
      update,
      updateSet,
      updateWhere,
      webhookRow,
      rowsRef,
    },
  }
})

vi.mock('@/db', () => ({
  db: { select: dbMocks.select, update: dbMocks.update },
}))

vi.mock('@/db/schema', () => ({
  webhook: { id: 'id' },
  webhookLog: { id: 'id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ eq: [col, val] }),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// Prevent the module's background setInterval from firing real work
const originalSetInterval = globalThis.setInterval
beforeEach(() => {
  // noop setInterval so module-level timer registration doesn't tick during tests
  globalThis.setInterval = ((_fn: any, _ms: number) => 0 as any) as typeof setInterval
})

afterEach(() => {
  globalThis.setInterval = originalSetInterval
})

describe('retry queue helpers', () => {
  beforeEach(() => {
    clearRetryQueue()
    dbMocks.rowsRef.current = [{ retryEnabled: true, maxRetries: 3, retryDelay: 1 }]
  })

  describe('scheduleWebhookRetry', () => {
    it('adds a job to the queue when retry enabled and under max', async () => {
      await scheduleWebhookRetry('wh-1', 'log-1', { a: 1 }, { h: '1' }, 0)
      const status = getRetryQueueStatus()
      expect(status.queueSize).toBe(1)
      expect(status.jobs[0]).toMatchObject({
        webhookId: 'wh-1',
        logId: 'log-1',
        retryCount: 1,
      })
      expect(status.jobs[0].nextRetryAt).toBeInstanceOf(Date)
    })

    it('does nothing when webhook not found', async () => {
      dbMocks.rowsRef.current = []
      await scheduleWebhookRetry('missing', 'log-x', {}, {}, 0)
      expect(getRetryQueueStatus().queueSize).toBe(0)
    })

    it('does nothing when retry disabled', async () => {
      dbMocks.rowsRef.current = [{ retryEnabled: false, maxRetries: 3, retryDelay: 1 }]
      await scheduleWebhookRetry('wh-1', 'log-1', {}, {}, 0)
      expect(getRetryQueueStatus().queueSize).toBe(0)
    })

    it('does nothing when retryCount >= maxRetries', async () => {
      dbMocks.rowsRef.current = [{ retryEnabled: true, maxRetries: 2, retryDelay: 1 }]
      await scheduleWebhookRetry('wh-1', 'log-1', {}, {}, 2)
      expect(getRetryQueueStatus().queueSize).toBe(0)
    })

    it('uses exponential backoff for delay', async () => {
      const before = Date.now()
      await scheduleWebhookRetry('wh-1', 'log-1', {}, {}, 0)
      await scheduleWebhookRetry('wh-2', 'log-2', {}, {}, 1)
      await scheduleWebhookRetry('wh-3', 'log-3', {}, {}, 2)
      const status = getRetryQueueStatus()
      const [j1, j2, j3] = status.jobs
      // delays are retryDelay * 2^retryCount seconds (1, 2, 4)
      expect(j1.nextRetryAt.getTime() - before).toBeGreaterThanOrEqual(999)
      expect(j2.nextRetryAt.getTime() - before).toBeGreaterThanOrEqual(1999)
      expect(j3.nextRetryAt.getTime() - before).toBeGreaterThanOrEqual(3999)
    })

    it('calls db.update to bump retryCount on the webhookLog row', async () => {
      dbMocks.update.mockClear()
      await scheduleWebhookRetry('wh-1', 'log-1', {}, {}, 0)
      expect(dbMocks.update).toHaveBeenCalled()
      expect(dbMocks.updateSet).toHaveBeenCalledWith({ retryCount: 1 })
    })
  })

  describe('cancelRetry', () => {
    it('removes a queued job by logId and returns true', async () => {
      await scheduleWebhookRetry('wh', 'log-99', {}, {}, 0)
      expect(cancelRetry('log-99')).toBe(true)
      expect(getRetryQueueStatus().queueSize).toBe(0)
    })

    it('returns false for unknown logId', () => {
      expect(cancelRetry('does-not-exist')).toBe(false)
    })
  })

  describe('clearRetryQueue', () => {
    it('empties the queue', async () => {
      await scheduleWebhookRetry('wh', 'a', {}, {}, 0)
      await scheduleWebhookRetry('wh', 'b', {}, {}, 0)
      expect(getRetryQueueStatus().queueSize).toBe(2)
      clearRetryQueue()
      expect(getRetryQueueStatus().queueSize).toBe(0)
    })
  })

  describe('getRetryQueueStatus', () => {
    it('returns an empty status for an empty queue', () => {
      clearRetryQueue()
      const s = getRetryQueueStatus()
      expect(s.queueSize).toBe(0)
      expect(s.jobs).toEqual([])
    })
  })
})
