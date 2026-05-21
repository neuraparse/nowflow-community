import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retry } from '../src/retry'

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('succeeds on the first attempt with no backoff', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const onRetry = vi.fn()

    const result = await retry(fn, { attempts: 3, backoffMs: 100, onRetry })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('retries and eventually succeeds on the third attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok')

    const promise = retry(fn, { attempts: 3, backoffMs: 100, factor: 2 })

    // Flush microtasks so each attempt runs; then advance timers for backoff.
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'))

    const promise = retry(fn, { attempts: 3, backoffMs: 50 })

    // Attach a handler so the rejection isn't unhandled during timer run.
    const expectation = expect(promise).rejects.toThrow('persistent')
    await vi.runAllTimersAsync()
    await expectation

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stops immediately when `shouldRetry` returns false', async () => {
    const err = new Error('non-retriable')
    const fn = vi.fn().mockRejectedValue(err)
    const shouldRetry = vi.fn().mockReturnValue(false)

    const promise = retry(fn, {
      attempts: 5,
      backoffMs: 100,
      shouldRetry,
    })

    const expectation = expect(promise).rejects.toThrow('non-retriable')
    await vi.runAllTimersAsync()
    await expectation

    expect(fn).toHaveBeenCalledTimes(1)
    expect(shouldRetry).toHaveBeenCalledTimes(1)
    expect(shouldRetry).toHaveBeenCalledWith(err, 0)
  })

  it('continues retrying while `shouldRetry` returns true', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('retry-1')).mockResolvedValueOnce('ok')
    const shouldRetry = vi.fn().mockReturnValue(true)

    const promise = retry(fn, {
      attempts: 3,
      backoffMs: 10,
      shouldRetry,
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(shouldRetry).toHaveBeenCalledTimes(1)
  })

  it('invokes `onRetry` with error, attempt index, and delay', async () => {
    const err1 = new Error('fail-1')
    const err2 = new Error('fail-2')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2)
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()

    const promise = retry(fn, {
      attempts: 3,
      backoffMs: 100,
      factor: 2,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, err1, 0, 100)
    expect(onRetry).toHaveBeenNthCalledWith(2, err2, 1, 200)
  })

  it('applies exponential backoff by `factor`', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockRejectedValueOnce(new Error('fail-3'))
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()

    const promise = retry(fn, {
      attempts: 4,
      backoffMs: 50,
      factor: 3,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    // factor=3, backoffMs=50 → 50, 150, 450
    const delays = onRetry.mock.calls.map((call) => call[2])
    expect(delays).toEqual([50, 150, 450])
  })

  it('uses default factor of 2 when not specified', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()

    const promise = retry(fn, { attempts: 3, backoffMs: 20, onRetry })
    await vi.runAllTimersAsync()
    await promise

    const delays = onRetry.mock.calls.map((call) => call[2])
    expect(delays).toEqual([20, 40])
  })

  it('throws synchronously when `attempts < 1`', async () => {
    const fn = vi.fn()
    await expect(retry(fn, { attempts: 0, backoffMs: 10 })).rejects.toThrow(
      '`attempts` must be >= 1'
    )
    expect(fn).not.toHaveBeenCalled()
  })
})
