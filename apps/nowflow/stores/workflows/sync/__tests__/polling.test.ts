/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  POLLING_INTERVAL_SSE_ACTIVE,
  POLLING_INTERVAL_SSE_INACTIVE,
  POLLING_PAUSE_AFTER_USER_ACTION,
  SSE_HEALTHY_THRESHOLD,
} from '@/stores/workflows/sync/constants'
import {
  getAdaptivePollingInterval,
  isSSEHealthy,
  pausePolling,
  resumePolling,
  startAutoPolling,
  stopAutoPolling,
} from '@/stores/workflows/sync/polling'
import * as syncState from '@/stores/workflows/sync/state'

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock fetch module (polling calls fetchWorkflowsFromDB)
const fetchWorkflowsFromDBMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/workflows/sync/fetch', () => ({
  fetchWorkflowsFromDB: (...args: any[]) => fetchWorkflowsFromDBMock(...args),
  throttledFetchWorkflows: vi.fn(),
  _setWorkflowSyncRef: vi.fn(),
}))

describe('sync/polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
    fetchWorkflowsFromDBMock.mockClear()
    fetchWorkflowsFromDBMock.mockResolvedValue(undefined)

    // Reset relevant state
    syncState.setPollingTimer(null)
    syncState.setIsPollingActive(false)
    syncState.setWindowFocusHandler(null)
    syncState.setSkipInitialPoll(false)
    syncState.setSSEUpdateReceived(false)
    syncState.setLastSSEUpdateTime(0)
    syncState.setIsSSEConnected(false)
    syncState.setLoadingFromDBToken(null)
    syncState.setLoadingFromDBStartTime(0)
    syncState.endWorkspaceSwitch()
    syncState.updateLastUserActionTime()
    // Rewind user action so polling can fire
    vi.advanceTimersByTime(POLLING_PAUSE_AFTER_USER_ACTION + 1000)
  })

  afterEach(() => {
    stopAutoPolling()
    vi.useRealTimers()
  })

  describe('isSSEHealthy', () => {
    it('returns false when SSE is not connected', () => {
      syncState.setIsSSEConnected(false)
      expect(isSSEHealthy()).toBe(false)
    })

    it('returns true when connected and update was recent', () => {
      syncState.setIsSSEConnected(true)
      syncState.setLastSSEUpdateTime(Date.now())
      expect(isSSEHealthy()).toBe(true)
    })

    it('returns false when connected but last update is stale', () => {
      syncState.setIsSSEConnected(true)
      syncState.setLastSSEUpdateTime(Date.now() - SSE_HEALTHY_THRESHOLD - 1000)
      expect(isSSEHealthy()).toBe(false)
    })
  })

  describe('getAdaptivePollingInterval', () => {
    it('returns the ACTIVE (backup) interval when SSE is healthy', () => {
      syncState.setIsSSEConnected(true)
      syncState.setLastSSEUpdateTime(Date.now())
      expect(getAdaptivePollingInterval()).toBe(POLLING_INTERVAL_SSE_ACTIVE)
    })

    it('returns the INACTIVE (primary) interval when SSE is unhealthy', () => {
      syncState.setIsSSEConnected(false)
      expect(getAdaptivePollingInterval()).toBe(POLLING_INTERVAL_SSE_INACTIVE)
    })
  })

  describe('startAutoPolling', () => {
    it('marks polling as active', () => {
      startAutoPolling()
      expect(syncState.isPollingActive).toBe(true)
    })

    it('is idempotent - calling twice does not start multiple loops', () => {
      startAutoPolling()
      const timerFirst = syncState.pollingTimer
      startAutoPolling()
      // Second call should early-return (already active)
      expect(syncState.pollingTimer).toBe(timerFirst)
    })

    it('performs initial fetch after startup delay when skipInitialPoll is false', async () => {
      syncState.setSkipInitialPoll(false)
      startAutoPolling()

      // Initial fetch is scheduled with setTimeout(1000)
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetchWorkflowsFromDBMock).toHaveBeenCalled()
    })

    it('skips initial poll when skipInitialPoll is set', async () => {
      syncState.setSkipInitialPoll(true)
      startAutoPolling()

      // No initial fetch - next fetch must come from the scheduled cycle
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetchWorkflowsFromDBMock).not.toHaveBeenCalled()

      // skipInitialPoll should reset after consuming
      expect(syncState.skipInitialPoll).toBe(false)
    })

    it('schedules next poll at the adaptive interval and fires fetchWorkflowsFromDB', async () => {
      syncState.setSkipInitialPoll(true)
      syncState.setIsSSEConnected(false) // primary mode - 5s
      startAutoPolling()

      // Advance past first polling interval
      await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_SSE_INACTIVE + 100)
      expect(fetchWorkflowsFromDBMock).toHaveBeenCalled()
    })

    it('does not fetch if user recently performed an action', async () => {
      syncState.setSkipInitialPoll(true)
      startAutoPolling()

      // Advance almost to the poll fire moment, then register a fresh user action
      // so that when the poll callback runs, the action is within POLLING_PAUSE_AFTER_USER_ACTION.
      await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_SSE_INACTIVE - 100)
      syncState.updateLastUserActionTime()
      await vi.advanceTimersByTimeAsync(200)
      expect(fetchWorkflowsFromDBMock).not.toHaveBeenCalled()
    })

    it('does not fetch if actively loading from DB', async () => {
      syncState.setSkipInitialPoll(true)
      syncState.setLoadingFromDBToken('loading')
      syncState.setLoadingFromDBStartTime(Date.now())
      startAutoPolling()

      await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_SSE_INACTIVE + 100)
      expect(fetchWorkflowsFromDBMock).not.toHaveBeenCalled()
    })

    it('when sseUpdateReceived is set, performs fetch and clears flag', async () => {
      syncState.setSkipInitialPoll(true)
      syncState.setSSEUpdateReceived(true)
      startAutoPolling()

      await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_SSE_INACTIVE + 100)
      expect(fetchWorkflowsFromDBMock).toHaveBeenCalled()
      expect(syncState.sseUpdateReceived).toBe(false)
    })
  })

  describe('stopAutoPolling', () => {
    it('clears timer and marks polling inactive', () => {
      startAutoPolling()
      stopAutoPolling()
      expect(syncState.isPollingActive).toBe(false)
      expect(syncState.pollingTimer).toBeNull()
    })

    it('is safe to call when polling was never started', () => {
      expect(() => stopAutoPolling()).not.toThrow()
    })

    it('prevents further fetches after stop', async () => {
      syncState.setSkipInitialPoll(true)
      startAutoPolling()
      stopAutoPolling()
      fetchWorkflowsFromDBMock.mockClear()

      await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_SSE_INACTIVE * 2)
      expect(fetchWorkflowsFromDBMock).not.toHaveBeenCalled()
    })
  })

  describe('pausePolling / resumePolling', () => {
    it('both are no-throw helpers (state-driven pause)', () => {
      expect(() => pausePolling()).not.toThrow()
      expect(() => resumePolling()).not.toThrow()
    })
  })
})
