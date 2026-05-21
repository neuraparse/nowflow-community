import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAutoSaveStatus,
  initAutoSave,
  stopAutoSave,
  triggerAutoSave,
} from '@/stores/workflows/sync/auto-save'
import { AUTO_SAVE_CHECK_INTERVAL, AUTO_SAVE_MIN_INTERVAL } from '@/stores/workflows/sync/constants'
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

// Mock auto-save service
const shouldAutoSaveMock = vi.fn()
const createAutoSaveVersionMock = vi.fn()
vi.mock('@/lib/workflows/auto-save-service', () => ({
  shouldAutoSave: (...args: any[]) => shouldAutoSaveMock(...args),
  createAutoSaveVersion: (...args: any[]) => createAutoSaveVersionMock(...args),
}))

// Mock workflow store
const workflowStoreState = {
  blocks: { a: { id: 'a' } },
  edges: [{ id: 'e1' }],
  loops: {},
  groups: {},
}
vi.mock('@/stores/workflows/workflow/store', () => ({
  useWorkflowStore: {
    getState: () => workflowStoreState,
  },
}))

describe('sync/auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
    shouldAutoSaveMock.mockReset()
    createAutoSaveVersionMock.mockReset()

    // Reset relevant state
    syncState.setAutoSaveTimer(null)
    syncState.setAutoSaveWorkflowId(null)
    syncState.setAutoSaveUserId(null)
    syncState.setLastAutoSaveState(null)
    syncState.setLastAutoSaveTime(0)
  })

  afterEach(() => {
    stopAutoSave()
    vi.useRealTimers()
  })

  describe('initAutoSave', () => {
    it('captures the initial state snapshot and workflow/user ids', () => {
      initAutoSave('wf-1', 'user-1')

      expect(syncState.autoSaveWorkflowId).toBe('wf-1')
      expect(syncState.autoSaveUserId).toBe('user-1')
      expect(syncState.lastAutoSaveState).toEqual({
        blocks: workflowStoreState.blocks,
        edges: workflowStoreState.edges,
        loops: workflowStoreState.loops,
        groups: workflowStoreState.groups,
      })
      // Snapshot must be a deep copy, not a reference
      expect(syncState.lastAutoSaveState).not.toBe(workflowStoreState.blocks)
    })

    it('starts an interval timer at AUTO_SAVE_CHECK_INTERVAL', () => {
      initAutoSave('wf-1', 'user-1')
      expect(syncState.autoSaveTimer).not.toBeNull()
    })

    it('stops any existing auto-save before starting a new one', () => {
      initAutoSave('wf-1', 'user-1')
      const firstTimer = syncState.autoSaveTimer

      initAutoSave('wf-2', 'user-2')
      expect(syncState.autoSaveWorkflowId).toBe('wf-2')
      expect(syncState.autoSaveTimer).not.toBe(firstTimer)
    })
  })

  describe('stopAutoSave', () => {
    it('clears timer and ids', () => {
      initAutoSave('wf-1', 'user-1')
      stopAutoSave()

      expect(syncState.autoSaveTimer).toBeNull()
      expect(syncState.autoSaveWorkflowId).toBeNull()
      expect(syncState.autoSaveUserId).toBeNull()
      expect(syncState.lastAutoSaveState).toBeNull()
    })

    it('is safe to call when nothing is running', () => {
      expect(() => stopAutoSave()).not.toThrow()
    })
  })

  describe('checkAutoSave interval behavior', () => {
    it('does not auto-save before AUTO_SAVE_MIN_INTERVAL has elapsed', async () => {
      initAutoSave('wf-1', 'user-1')
      shouldAutoSaveMock.mockResolvedValue(true)

      // Advance by one check interval (60s) - less than MIN_INTERVAL (5 min)
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_CHECK_INTERVAL)

      expect(shouldAutoSaveMock).not.toHaveBeenCalled()
      expect(createAutoSaveVersionMock).not.toHaveBeenCalled()
    })

    it('triggers createAutoSaveVersion once AUTO_SAVE_MIN_INTERVAL has elapsed and changes are significant', async () => {
      initAutoSave('wf-1', 'user-1')
      shouldAutoSaveMock.mockResolvedValue(true)
      createAutoSaveVersionMock.mockResolvedValue({ versionNumber: 2 })

      // Advance past min-interval (5 min)
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_MIN_INTERVAL + AUTO_SAVE_CHECK_INTERVAL)

      expect(shouldAutoSaveMock).toHaveBeenCalledWith('wf-1')
      expect(createAutoSaveVersionMock).toHaveBeenCalledTimes(1)
    })

    it('skips createAutoSaveVersion if shouldAutoSave returns false', async () => {
      initAutoSave('wf-1', 'user-1')
      shouldAutoSaveMock.mockResolvedValue(false)

      await vi.advanceTimersByTimeAsync(AUTO_SAVE_MIN_INTERVAL + AUTO_SAVE_CHECK_INTERVAL)

      expect(shouldAutoSaveMock).toHaveBeenCalled()
      expect(createAutoSaveVersionMock).not.toHaveBeenCalled()
    })

    it('swallows errors from shouldAutoSave gracefully', async () => {
      initAutoSave('wf-1', 'user-1')
      shouldAutoSaveMock.mockRejectedValue(new Error('boom'))

      // Should not throw when interval fires
      await expect(
        vi.advanceTimersByTimeAsync(AUTO_SAVE_MIN_INTERVAL + AUTO_SAVE_CHECK_INTERVAL)
      ).resolves.not.toThrow()
    })

    it('updates lastAutoSaveTime after a successful version is created', async () => {
      initAutoSave('wf-1', 'user-1')
      const initialTime = syncState.lastAutoSaveTime
      shouldAutoSaveMock.mockResolvedValue(true)
      createAutoSaveVersionMock.mockResolvedValue({ versionNumber: 1 })

      await vi.advanceTimersByTimeAsync(AUTO_SAVE_MIN_INTERVAL + AUTO_SAVE_CHECK_INTERVAL)

      expect(syncState.lastAutoSaveTime).toBeGreaterThan(initialTime)
    })
  })

  describe('triggerAutoSave (manual trigger)', () => {
    it('returns false when no workflow is initialized', async () => {
      const result = await triggerAutoSave()
      expect(result).toBe(false)
      expect(createAutoSaveVersionMock).not.toHaveBeenCalled()
    })

    it('returns true on successful manual save', async () => {
      initAutoSave('wf-1', 'user-1')
      createAutoSaveVersionMock.mockResolvedValue({ versionNumber: 42 })

      const result = await triggerAutoSave()

      expect(result).toBe(true)
      expect(createAutoSaveVersionMock).toHaveBeenCalledWith(
        'wf-1',
        'user-1',
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('returns false when createAutoSaveVersion returns falsy', async () => {
      initAutoSave('wf-1', 'user-1')
      createAutoSaveVersionMock.mockResolvedValue(null)

      const result = await triggerAutoSave()
      expect(result).toBe(false)
    })

    it('returns false when createAutoSaveVersion throws (error case)', async () => {
      initAutoSave('wf-1', 'user-1')
      createAutoSaveVersionMock.mockRejectedValue(new Error('network error'))

      const result = await triggerAutoSave()
      expect(result).toBe(false)
    })
  })

  describe('getAutoSaveStatus', () => {
    it('reports disabled when not initialized', () => {
      const status = getAutoSaveStatus()
      expect(status.isEnabled).toBe(false)
      expect(status.workflowId).toBeNull()
    })

    it('reports enabled and workflow id after init', () => {
      initAutoSave('wf-1', 'user-1')
      const status = getAutoSaveStatus()
      expect(status.isEnabled).toBe(true)
      expect(status.workflowId).toBe('wf-1')
      expect(typeof status.lastAutoSaveTime).toBe('number')
    })
  })
})
