import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Utility to capture all process listeners added between setup and teardown
// so tests don't leak and we can invoke the handlers ourselves.
const captureListener = (
  event: 'uncaughtException' | 'unhandledRejection'
): ((...args: unknown[]) => void) | undefined => {
  const listeners = process.listeners(event as Parameters<typeof process.listeners>[0]) as Array<
    (...args: unknown[]) => void
  >
  return listeners[listeners.length - 1]
}

describe('lib/error-handlers', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let existingUncaughtExceptionListeners: Array<(...args: unknown[]) => void>
  let existingUnhandledRejectionListeners: Array<(...args: unknown[]) => void>

  beforeEach(() => {
    vi.resetModules()
    // Snapshot existing listeners so we can diff/clean up after each test.
    existingUncaughtExceptionListeners = [
      ...(process.listeners('uncaughtException') as Array<(...args: unknown[]) => void>),
    ]
    existingUnhandledRejectionListeners = [
      ...(process.listeners('unhandledRejection') as Array<(...args: unknown[]) => void>),
    ]
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    // Remove any listeners that were installed by importing the module.
    for (const fn of process.listeners('uncaughtException') as Array<
      (...args: unknown[]) => void
    >) {
      if (!existingUncaughtExceptionListeners.includes(fn)) {
        process.off('uncaughtException', fn as never)
      }
    }
    for (const fn of process.listeners('unhandledRejection') as Array<
      (...args: unknown[]) => void
    >) {
      if (!existingUnhandledRejectionListeners.includes(fn)) {
        process.off('unhandledRejection', fn as never)
      }
    }
    vi.unstubAllEnvs()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
    vi.resetModules()
  })

  describe('exports', () => {
    it('exposes setupErrorHandlers as a callable no-op', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const mod = await import('../error-handlers')
      expect(typeof mod.setupErrorHandlers).toBe('function')
      // Should not throw and returns undefined
      expect(mod.setupErrorHandlers()).toBeUndefined()
    })
  })

  describe('non-development environments', () => {
    it('does not install process listeners when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const before = process.listeners('uncaughtException').length
      const beforeRej = process.listeners('unhandledRejection').length
      await import('../error-handlers')
      expect(process.listeners('uncaughtException').length).toBe(before)
      expect(process.listeners('unhandledRejection').length).toBe(beforeRej)
    })

    it('does not install process listeners when NODE_ENV is test', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const before = process.listeners('uncaughtException').length
      const beforeRej = process.listeners('unhandledRejection').length
      await import('../error-handlers')
      expect(process.listeners('uncaughtException').length).toBe(before)
      expect(process.listeners('unhandledRejection').length).toBe(beforeRej)
    })
  })

  describe('development environment handlers', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('installs exactly one uncaughtException and one unhandledRejection listener', async () => {
      const beforeExc = process.listeners('uncaughtException').length
      const beforeRej = process.listeners('unhandledRejection').length
      await import('../error-handlers')
      expect(process.listeners('uncaughtException').length).toBe(beforeExc + 1)
      expect(process.listeners('unhandledRejection').length).toBe(beforeRej + 1)
    })

    it('logs uncaughtException errors with the [ErrorHandlers] prefix and the error stack', async () => {
      await import('../error-handlers')
      const handler = captureListener('uncaughtException')
      expect(handler).toBeDefined()
      const err = new Error('boom')
      handler!(err)
      expect(errorSpy).toHaveBeenCalledTimes(1)
      const args = errorSpy.mock.calls[0]
      expect(args[0]).toBe('[ErrorHandlers]')
      expect(args[1]).toBe('Uncaught Exception:')
      // stack/error instance is forwarded through
      expect(args[2]).toBe(err)
      expect((args[2] as Error).stack).toBeDefined()
    })

    it('suppresses uncaughtException with message "aborted"', async () => {
      await import('../error-handlers')
      const handler = captureListener('uncaughtException')
      handler!(new Error('aborted'))
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('suppresses uncaughtException containing ECONNRESET', async () => {
      await import('../error-handlers')
      const handler = captureListener('uncaughtException')
      handler!(new Error('read ECONNRESET'))
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('logs unhandledRejection with promise and reason', async () => {
      await import('../error-handlers')
      const handler = captureListener('unhandledRejection')
      expect(handler).toBeDefined()
      const promise = Promise.reject(new Error('rejected'))
      // Attach a catch so node doesn't also flag this as unhandled.
      promise.catch(() => {})
      const reason = new Error('reason-message')
      handler!(reason, promise)
      expect(errorSpy).toHaveBeenCalledTimes(1)
      const args = errorSpy.mock.calls[0]
      expect(args[0]).toBe('[ErrorHandlers]')
      expect(args[1]).toBe('Unhandled Rejection at:')
      expect(args[2]).toBe(promise)
      expect(args[3]).toBe('reason:')
      expect(args[4]).toBe(reason)
    })

    it('suppresses unhandledRejection when reason.message === "aborted"', async () => {
      await import('../error-handlers')
      const handler = captureListener('unhandledRejection')
      const promise = Promise.reject(new Error('aborted'))
      promise.catch(() => {})
      handler!({ message: 'aborted' }, promise)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('suppresses unhandledRejection when stringified reason contains ECONNRESET', async () => {
      await import('../error-handlers')
      const handler = captureListener('unhandledRejection')
      const promise = Promise.reject(new Error('ECONNRESET'))
      promise.catch(() => {})
      const reason = new Error('socket hang up ECONNRESET')
      handler!(reason, promise)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('does not log unhandledRejection when reason is a primitive (no message property)', async () => {
      await import('../error-handlers')
      const handler = captureListener('unhandledRejection')
      const promise = Promise.reject('string-reason')
      promise.catch(() => {})
      // The guard requires reason to be a non-null object with 'message'. A raw
      // string fails this guard, so nothing is logged.
      handler!('string-reason', promise)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('does not log unhandledRejection when reason is null', async () => {
      await import('../error-handlers')
      const handler = captureListener('unhandledRejection')
      const promise = Promise.reject(null)
      promise.catch(() => {})
      handler!(null, promise)
      expect(errorSpy).not.toHaveBeenCalled()
    })
  })
})
