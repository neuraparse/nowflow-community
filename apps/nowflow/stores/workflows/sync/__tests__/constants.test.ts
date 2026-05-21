import { describe, expect, it } from 'vitest'
import * as constants from '@/stores/workflows/sync/constants'

describe('sync/constants', () => {
  describe('auto-save constants', () => {
    it('has AUTO_SAVE_CHECK_INTERVAL of 60 seconds', () => {
      expect(constants.AUTO_SAVE_CHECK_INTERVAL).toBe(60000)
      expect(typeof constants.AUTO_SAVE_CHECK_INTERVAL).toBe('number')
    })

    it('has AUTO_SAVE_MIN_INTERVAL of 5 minutes', () => {
      expect(constants.AUTO_SAVE_MIN_INTERVAL).toBe(300000)
      expect(typeof constants.AUTO_SAVE_MIN_INTERVAL).toBe('number')
    })

    it('AUTO_SAVE_MIN_INTERVAL is greater than AUTO_SAVE_CHECK_INTERVAL', () => {
      expect(constants.AUTO_SAVE_MIN_INTERVAL).toBeGreaterThan(constants.AUTO_SAVE_CHECK_INTERVAL)
    })
  })

  describe('sync debounce values', () => {
    it('has USER_ACTION_DEBOUNCE of 100ms', () => {
      expect(constants.USER_ACTION_DEBOUNCE).toBe(100)
    })

    it('has IMMEDIATE_SYNC_DEBOUNCE of 50ms', () => {
      expect(constants.IMMEDIATE_SYNC_DEBOUNCE).toBe(50)
    })

    it('has BACKGROUND_SYNC_DEBOUNCE of 30 seconds', () => {
      expect(constants.BACKGROUND_SYNC_DEBOUNCE).toBe(30000)
    })

    it('has debounce values in correct order (immediate < user < background)', () => {
      expect(constants.IMMEDIATE_SYNC_DEBOUNCE).toBeLessThan(constants.USER_ACTION_DEBOUNCE)
      expect(constants.USER_ACTION_DEBOUNCE).toBeLessThan(constants.BACKGROUND_SYNC_DEBOUNCE)
    })
  })

  describe('polling intervals', () => {
    it('has POLLING_INTERVAL_SSE_ACTIVE of 30 seconds', () => {
      expect(constants.POLLING_INTERVAL_SSE_ACTIVE).toBe(30000)
    })

    it('has POLLING_INTERVAL_SSE_INACTIVE of 5 seconds', () => {
      expect(constants.POLLING_INTERVAL_SSE_INACTIVE).toBe(5000)
    })

    it('active polling interval is longer than inactive (backup vs primary)', () => {
      expect(constants.POLLING_INTERVAL_SSE_ACTIVE).toBeGreaterThan(
        constants.POLLING_INTERVAL_SSE_INACTIVE
      )
    })

    it('has POLLING_PAUSE_AFTER_USER_ACTION of 3 seconds', () => {
      expect(constants.POLLING_PAUSE_AFTER_USER_ACTION).toBe(3000)
    })

    it('has FETCH_THROTTLE_MS of 3 seconds', () => {
      expect(constants.FETCH_THROTTLE_MS).toBe(3000)
    })

    it('has ACTIVE_CLIENT_WINDOW of 10 seconds', () => {
      expect(constants.ACTIVE_CLIENT_WINDOW).toBe(10000)
    })

    it('has SSE_HEALTHY_THRESHOLD of 15 seconds', () => {
      expect(constants.SSE_HEALTHY_THRESHOLD).toBe(15000)
    })
  })

  describe('pending operation TTLs', () => {
    it('has PENDING_DELETE_TTL_MS of 15 seconds', () => {
      expect(constants.PENDING_DELETE_TTL_MS).toBe(15000)
    })

    it('has PENDING_CREATE_TTL_MS of 15 seconds', () => {
      expect(constants.PENDING_CREATE_TTL_MS).toBe(15000)
    })

    it('delete and create TTLs are equal', () => {
      expect(constants.PENDING_DELETE_TTL_MS).toBe(constants.PENDING_CREATE_TTL_MS)
    })
  })

  describe('loading and workspace switch timeouts', () => {
    it('has LOADING_TIMEOUT of 10 seconds', () => {
      expect(constants.LOADING_TIMEOUT).toBe(10000)
    })

    it('has WORKSPACE_SWITCH_TIMEOUT of 5 seconds', () => {
      expect(constants.WORKSPACE_SWITCH_TIMEOUT).toBe(5000)
    })
  })

  describe('fetch debounce', () => {
    it('has FETCH_DEBOUNCE_MS of 1 second', () => {
      expect(constants.FETCH_DEBOUNCE_MS).toBe(1000)
    })
  })

  describe('failure tracking', () => {
    it('has MAX_CONSECUTIVE_FAILURES of 3', () => {
      expect(constants.MAX_CONSECUTIVE_FAILURES).toBe(3)
      expect(typeof constants.MAX_CONSECUTIVE_FAILURES).toBe('number')
    })

    it('MAX_CONSECUTIVE_FAILURES is a positive integer', () => {
      expect(constants.MAX_CONSECUTIVE_FAILURES).toBeGreaterThan(0)
      expect(Number.isInteger(constants.MAX_CONSECUTIVE_FAILURES)).toBe(true)
    })
  })

  describe('all exported constants are numbers', () => {
    it('every exported constant is a finite number', () => {
      for (const [name, value] of Object.entries(constants)) {
        expect(typeof value, `${name} should be a number`).toBe('number')
        expect(Number.isFinite(value as number), `${name} should be finite`).toBe(true)
      }
    })
  })
})
