import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADING_TIMEOUT, WORKSPACE_SWITCH_TIMEOUT } from '@/stores/workflows/sync/constants'
import * as state from '@/stores/workflows/sync/state'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('sync/state', () => {
  beforeEach(() => {
    // Reset all settable state to defaults
    state.setLastAutoSaveTime(0)
    state.setLastAutoSaveState(null)
    state.setAutoSaveTimer(null)
    state.setAutoSaveWorkflowId(null)
    state.setAutoSaveUserId(null)
    state.setUserActionSyncTimer(null)
    state.setBackgroundSyncTimer(null)
    state.setImmediateSyncTimer(null)
    state.setIsSyncInProgress(false)
    state.setPendingSyncAfterCurrent(false)
    state.setHasLoggedPendingSync(false)
    state.setIsLoadingFromDB(false)
    state.setLoadingFromDBToken(null)
    state.setLoadingFromDBStartTime(0)
    state.setLastDBSyncTimestamp(0)
    state.setLastFetchTime(0)
    state.setIsOnline(true)
    state.setHasPendingSync(false)
    state.setLastFetchTimestamp(0)
    state.setIsFetchInProgress(false)
    state.setPendingFetchTimer(null)
    state.setConsecutiveFailures(0)
    state.setPollingTimer(null)
    state.setIsPollingActive(false)
    state.setWindowFocusHandler(null)
    state.setSkipInitialPoll(false)
    state.setSSEUpdateReceived(false)
    state.setLastSSEUpdateTime(0)
    state.setIsSSEConnected(false)
    state.setSSEDebounceTimer(null)
    state.endWorkspaceSwitch()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auto-save state setters', () => {
    it('setLastAutoSaveTime updates the exported value', () => {
      state.setLastAutoSaveTime(12345)
      expect(state.lastAutoSaveTime).toBe(12345)
    })

    it('setLastAutoSaveState can set and clear the snapshot', () => {
      const snapshot = { blocks: {}, edges: [], loops: {}, groups: {} }
      state.setLastAutoSaveState(snapshot)
      expect(state.lastAutoSaveState).toBe(snapshot)

      state.setLastAutoSaveState(null)
      expect(state.lastAutoSaveState).toBeNull()
    })

    it('setAutoSaveTimer stores a timer reference', () => {
      const timer = setTimeout(() => {}, 1000)
      state.setAutoSaveTimer(timer)
      expect(state.autoSaveTimer).toBe(timer)
      clearTimeout(timer)
      state.setAutoSaveTimer(null)
    })

    it('setAutoSaveWorkflowId / setAutoSaveUserId round-trip', () => {
      state.setAutoSaveWorkflowId('wf-1')
      state.setAutoSaveUserId('user-1')
      expect(state.autoSaveWorkflowId).toBe('wf-1')
      expect(state.autoSaveUserId).toBe('user-1')
    })
  })

  describe('sync lock state machine (idle -> syncing -> synced/error)', () => {
    it('defaults to idle (no sync in progress, no pending)', () => {
      expect(state.isSyncInProgress).toBe(false)
      expect(state.pendingSyncAfterCurrent).toBe(false)
      expect(state.hasLoggedPendingSync).toBe(false)
    })

    it('transitions idle -> syncing', () => {
      state.setIsSyncInProgress(true)
      expect(state.isSyncInProgress).toBe(true)
    })

    it('while syncing, queues a pending follow-up sync', () => {
      state.setIsSyncInProgress(true)
      state.setPendingSyncAfterCurrent(true)
      expect(state.isSyncInProgress).toBe(true)
      expect(state.pendingSyncAfterCurrent).toBe(true)
    })

    it('transitions syncing -> synced (success clears progress and pending)', () => {
      state.setIsSyncInProgress(true)
      state.setHasPendingSync(true)
      state.setIsSyncInProgress(false)
      state.setHasPendingSync(false)
      expect(state.isSyncInProgress).toBe(false)
      expect(state.hasPendingSync).toBe(false)
    })

    it('transitions syncing -> error (failure sets hasPendingSync)', () => {
      state.setIsSyncInProgress(true)
      state.setIsSyncInProgress(false)
      state.setHasPendingSync(true)
      expect(state.isSyncInProgress).toBe(false)
      expect(state.hasPendingSync).toBe(true)
    })
  })

  describe('user action time helpers', () => {
    it('updateLastUserActionTime sets lastUserActionTime to roughly now', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.updateLastUserActionTime()
      expect(state.getLastUserActionTime()).toBe(Date.now())
    })

    it('getLastUserActionTime returns the most recently updated value', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.updateLastUserActionTime()
      const first = state.getLastUserActionTime()

      vi.advanceTimersByTime(5000)
      state.updateLastUserActionTime()
      const second = state.getLastUserActionTime()

      expect(second).toBeGreaterThan(first)
      expect(second - first).toBe(5000)
    })
  })

  describe('isActivelyLoadingFromDB', () => {
    it('returns false when no loading token is set', () => {
      expect(state.isActivelyLoadingFromDB()).toBe(false)
    })

    it('returns true immediately after starting a load', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.setLoadingFromDBToken('loading')
      state.setLoadingFromDBStartTime(Date.now())
      expect(state.isActivelyLoadingFromDB()).toBe(true)
    })

    it('clears the token and returns false once LOADING_TIMEOUT elapses', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.setLoadingFromDBToken('loading')
      state.setLoadingFromDBStartTime(Date.now())

      vi.advanceTimersByTime(LOADING_TIMEOUT + 1)
      expect(state.isActivelyLoadingFromDB()).toBe(false)
      // Side-effect: token should be cleared
      expect(state.loadingFromDBToken).toBeNull()
    })
  })

  describe('workspace switch lock', () => {
    it('isActivelyWorkspaceSwitching defaults to false', () => {
      expect(state.isActivelyWorkspaceSwitching()).toBe(false)
    })

    it('startWorkspaceSwitch enables the lock', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.startWorkspaceSwitch()
      expect(state.isActivelyWorkspaceSwitching()).toBe(true)
    })

    it('endWorkspaceSwitch releases the lock', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.startWorkspaceSwitch()
      state.endWorkspaceSwitch()
      expect(state.isActivelyWorkspaceSwitching()).toBe(false)
    })

    it('auto-releases after WORKSPACE_SWITCH_TIMEOUT elapses', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
      state.startWorkspaceSwitch()
      vi.advanceTimersByTime(WORKSPACE_SWITCH_TIMEOUT + 1)
      expect(state.isActivelyWorkspaceSwitching()).toBe(false)
    })
  })

  describe('online/offline state', () => {
    it('setIsOnline updates the value', () => {
      state.setIsOnline(false)
      expect(state.isOnline).toBe(false)
      state.setIsOnline(true)
      expect(state.isOnline).toBe(true)
    })

    it('setHasPendingSync updates the value', () => {
      state.setHasPendingSync(true)
      expect(state.hasPendingSync).toBe(true)
    })
  })

  describe('fetch throttle state', () => {
    it('setLastFetchTimestamp / setIsFetchInProgress round-trip', () => {
      state.setLastFetchTimestamp(42)
      state.setIsFetchInProgress(true)
      expect(state.lastFetchTimestamp).toBe(42)
      expect(state.isFetchInProgress).toBe(true)
    })

    it('setPendingFetchTimer stores the timer', () => {
      const timer = setTimeout(() => {}, 1000)
      state.setPendingFetchTimer(timer)
      expect(state.pendingFetchTimer).toBe(timer)
      clearTimeout(timer)
      state.setPendingFetchTimer(null)
    })
  })

  describe('failure tracking helpers', () => {
    it('setConsecutiveFailures sets absolute value', () => {
      state.setConsecutiveFailures(2)
      expect(state.consecutiveFailures).toBe(2)
    })

    it('incrementConsecutiveFailures increments by one', () => {
      state.setConsecutiveFailures(0)
      state.incrementConsecutiveFailures()
      state.incrementConsecutiveFailures()
      expect(state.consecutiveFailures).toBe(2)
    })
  })

  describe('polling state', () => {
    it('setIsPollingActive / setPollingTimer round-trip', () => {
      state.setIsPollingActive(true)
      expect(state.isPollingActive).toBe(true)
      const timer = setTimeout(() => {}, 1000)
      state.setPollingTimer(timer)
      expect(state.pollingTimer).toBe(timer)
      clearTimeout(timer)
      state.setPollingTimer(null)
    })

    it('setSkipInitialPoll round-trips boolean', () => {
      state.setSkipInitialPoll(true)
      expect(state.skipInitialPoll).toBe(true)
      state.setSkipInitialPoll(false)
      expect(state.skipInitialPoll).toBe(false)
    })
  })

  describe('SSE state', () => {
    it('setSSEUpdateReceived / setIsSSEConnected round-trip', () => {
      state.setSSEUpdateReceived(true)
      state.setIsSSEConnected(true)
      expect(state.sseUpdateReceived).toBe(true)
      expect(state.isSSEConnected).toBe(true)
    })

    it('setLastSSEUpdateTime records a timestamp', () => {
      state.setLastSSEUpdateTime(1234567890)
      expect(state.lastSSEUpdateTime).toBe(1234567890)
    })

    it('setSSEDebounceTimer stores a timer reference', () => {
      const timer = setTimeout(() => {}, 1000)
      state.setSSEDebounceTimer(timer)
      expect(state.sseDebounceTimer).toBe(timer)
      clearTimeout(timer)
      state.setSSEDebounceTimer(null)
    })
  })
})
