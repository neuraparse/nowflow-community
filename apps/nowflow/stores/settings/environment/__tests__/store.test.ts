/**
 * Tests for the environment settings Zustand store.
 * Covers initial state, load/save env variables, getters,
 * and error handling (network, non-ok responses, 401).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('useEnvironmentStore', () => {
  let useEnvironmentStore: typeof import('../store').useEnvironmentStore

  beforeEach(async () => {
    vi.resetModules()
    global.fetch = vi.fn()
    const mod = await import('../store')
    useEnvironmentStore = mod.useEnvironmentStore
    useEnvironmentStore.setState({
      variables: {},
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has the expected initial state', () => {
    const state = useEnvironmentStore.getState()
    expect(state.variables).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  describe('loadEnvironmentVariables', () => {
    it('loads variables successfully and populates state', async () => {
      const data = {
        API_KEY: { key: 'API_KEY', value: 'abc' },
        DB_URL: { key: 'DB_URL', value: 'postgres://x' },
      }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data }),
      })

      await useEnvironmentStore.getState().loadEnvironmentVariables()

      const state = useEnvironmentStore.getState()
      expect(state.variables).toEqual(data)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('handles 401 (unauthenticated) by clearing variables without an error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await useEnvironmentStore.getState().loadEnvironmentVariables()

      const state = useEnvironmentStore.getState()
      expect(state.variables).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('sets error state when the response is non-ok (and not 401)', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await useEnvironmentStore.getState().loadEnvironmentVariables()

      const state = useEnvironmentStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toContain('Failed to load environment variables')
      expect(state.variables).toEqual({})
    })

    it('resets to empty variables when the payload has no data object', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      })

      await useEnvironmentStore.getState().loadEnvironmentVariables()

      expect(useEnvironmentStore.getState().variables).toEqual({})
      expect(useEnvironmentStore.getState().isLoading).toBe(false)
    })

    it('stores the error message when fetch rejects', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('network down'))

      await useEnvironmentStore.getState().loadEnvironmentVariables()

      const state = useEnvironmentStore.getState()
      expect(state.error).toBe('network down')
      expect(state.isLoading).toBe(false)
      expect(state.variables).toEqual({})
    })
  })

  describe('saveEnvironmentVariables', () => {
    it('optimistically updates state and POSTs variables', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })

      await useEnvironmentStore.getState().saveEnvironmentVariables({ FOO: 'bar', BAZ: 'qux' })

      const state = useEnvironmentStore.getState()
      expect(state.variables).toEqual({
        FOO: { key: 'FOO', value: 'bar' },
        BAZ: { key: 'BAZ', value: 'qux' },
      })
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body)).toEqual({
        variables: { FOO: 'bar', BAZ: 'qux' },
      })
    })

    it('sets error state and attempts to reload from DB on failure', async () => {
      // First call: saving fails.
      // Second call (loadEnvironmentVariables reload triggered from the catch
      // block): also fails so the error state is observable after the promise
      // chain settles.
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        })

      await useEnvironmentStore.getState().saveEnvironmentVariables({ FOO: 'bar' })
      // Allow the fire-and-forget reload microtasks to settle.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      const state = useEnvironmentStore.getState()
      expect(state.error).toMatch(/Failed to (save|load) environment variables/)
      expect(state.isLoading).toBe(false)
      // Save path triggers a reload, so fetch was called twice.
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('setVariables (legacy)', () => {
    it('delegates to saveEnvironmentVariables', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })

      useEnvironmentStore.getState().setVariables({ A: '1' })
      // Allow the microtask chain started by setVariables to resolve.
      await Promise.resolve()
      await Promise.resolve()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      // Optimistic update should have applied synchronously.
      expect(useEnvironmentStore.getState().variables).toEqual({
        A: { key: 'A', value: '1' },
      })
    })
  })

  describe('getters', () => {
    it('getVariable returns the value for an existing key or undefined', () => {
      useEnvironmentStore.setState({
        variables: {
          FOO: { key: 'FOO', value: 'bar' },
        },
      })

      expect(useEnvironmentStore.getState().getVariable('FOO')).toBe('bar')
      expect(useEnvironmentStore.getState().getVariable('MISSING')).toBeUndefined()
    })

    it('getAllVariables returns the entire variables record', () => {
      const vars = { FOO: { key: 'FOO', value: 'bar' } }
      useEnvironmentStore.setState({ variables: vars })
      expect(useEnvironmentStore.getState().getAllVariables()).toEqual(vars)
    })
  })
})
