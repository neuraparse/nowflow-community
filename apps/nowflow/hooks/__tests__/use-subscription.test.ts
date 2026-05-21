/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

type SubscriptionModule = typeof import('@/hooks/use-subscription')

const loadModule = async (): Promise<SubscriptionModule> => {
  return await import('@/hooks/use-subscription')
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in loading state and resolves with fetched subscription data', async () => {
    const payload = { isPro: true, plan: { id: 'pro', name: 'Pro' } }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: async () => payload,
    })

    const { useSubscription } = await loadModule()
    const { result } = renderHook(() => useSubscription())

    expect(result.current.loading).toBe(true)
    expect(result.current.isPro).toBe(false)
    expect(result.current.plan).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/user/subscription',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(result.current.isPro).toBe(true)
    expect(result.current.plan).toEqual(payload.plan)
    expect(result.current.error).toBeNull()
  })

  it('exposes an error when the fetch response is not ok', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    })

    const { useSubscription } = await loadModule()
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toContain('Failed to fetch subscription')
    expect(result.current.isPro).toBe(false)
    expect(result.current.plan).toBeNull()
  })

  it('exposes an error when fetch rejects', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'))

    const { useSubscription } = await loadModule()
    const { result } = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('network down')
  })

  it('uses cached data on subsequent renders within TTL without refetching', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: async () => ({ isPro: false, plan: { id: 'free' } }),
    })

    const { useSubscription } = await loadModule()
    const first = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(second.result.current.plan).toEqual({ id: 'free' })
    expect(second.result.current.isPro).toBe(false)
  })

  it('invalidateSubscriptionCache forces a refetch on next render', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ isPro: false, plan: { id: 'free' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
        json: async () => ({ isPro: true, plan: { id: 'pro' } }),
      })

    const { useSubscription, invalidateSubscriptionCache } = await loadModule()
    const first = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false)
    })

    act(() => {
      invalidateSubscriptionCache()
    })

    const second = renderHook(() => useSubscription())

    await waitFor(() => {
      expect(second.result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(second.result.current.isPro).toBe(true)
    expect(second.result.current.plan).toEqual({ id: 'pro' })
  })
})
