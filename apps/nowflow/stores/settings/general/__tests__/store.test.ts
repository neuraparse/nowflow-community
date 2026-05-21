/**
 * @vitest-environment jsdom
 *
 * Tests for the general settings Zustand store.
 * Covers initial state, toggles, theme actions, loadSettings, updateSetting,
 * and safe-storage persistence integration.
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

// Mock safe-storage to a deterministic in-memory stub so we don't rely on
// the real localStorage-backed implementation for assertions here.
vi.mock('@/stores/safe-storage', () => {
  const mem = new Map<string, string>()
  return {
    safeStorage: {
      getItem: (name: string) => {
        const raw = mem.get(name)
        return raw ? JSON.parse(raw) : null
      },
      setItem: (name: string, value: unknown) => {
        mem.set(name, JSON.stringify(value))
      },
      removeItem: (name: string) => {
        mem.delete(name)
      },
    },
    __mem: mem,
  }
})

describe('useGeneralStore', () => {
  let useGeneralStore: typeof import('../store').useGeneralStore

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    global.fetch = vi.fn()

    const mod = await import('../store')
    useGeneralStore = mod.useGeneralStore

    // Reset to a known initial state between tests.
    useGeneralStore.setState({
      isAutoConnectEnabled: true,
      isDebugModeEnabled: false,
      isAutoFillEnvVarsEnabled: true,
      isLiveValidationEnabled: true,
      theme: 'dark',
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has the expected initial state', () => {
    const state = useGeneralStore.getState()
    expect(state.isAutoConnectEnabled).toBe(true)
    expect(state.isDebugModeEnabled).toBe(false)
    expect(state.isAutoFillEnvVarsEnabled).toBe(true)
    expect(state.isLiveValidationEnabled).toBe(true)
    expect(state.theme).toBe('dark')
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  describe('toggles', () => {
    beforeEach(() => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      })
    })

    it('toggleAutoConnect flips the flag and PATCHes the setting', async () => {
      useGeneralStore.getState().toggleAutoConnect()
      expect(useGeneralStore.getState().isAutoConnectEnabled).toBe(false)

      // Wait for the fire-and-forget updateSetting microtasks to flush.
      await Promise.resolve()
      await Promise.resolve()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/settings',
        expect.objectContaining({ method: 'PATCH' })
      )
      const [, init] = (global.fetch as any).mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ autoConnect: false })
    })

    it('toggleDebugMode flips the flag and PATCHes the setting', async () => {
      useGeneralStore.getState().toggleDebugMode()
      expect(useGeneralStore.getState().isDebugModeEnabled).toBe(true)

      await Promise.resolve()
      await Promise.resolve()

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ debugMode: true })
    })

    it('toggleAutoFillEnvVars flips the flag and PATCHes the setting', async () => {
      useGeneralStore.getState().toggleAutoFillEnvVars()
      expect(useGeneralStore.getState().isAutoFillEnvVarsEnabled).toBe(false)

      await Promise.resolve()
      await Promise.resolve()

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ autoFillEnvVars: false })
    })

    it('toggleLiveValidation is local-only (no network call)', () => {
      useGeneralStore.getState().toggleLiveValidation()
      expect(useGeneralStore.getState().isLiveValidationEnabled).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()

      useGeneralStore.getState().toggleLiveValidation()
      expect(useGeneralStore.getState().isLiveValidationEnabled).toBe(true)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('theme', () => {
    beforeEach(() => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      })
    })

    it('setTheme sets the theme and PATCHes it', async () => {
      useGeneralStore.getState().setTheme('light')
      expect(useGeneralStore.getState().theme).toBe('light')

      await Promise.resolve()
      await Promise.resolve()

      const [, init] = (global.fetch as any).mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ theme: 'light' })
    })

    it('toggleTheme cycles light → dark → system → light', async () => {
      useGeneralStore.setState({ theme: 'light' })
      useGeneralStore.getState().toggleTheme()
      expect(useGeneralStore.getState().theme).toBe('dark')

      useGeneralStore.getState().toggleTheme()
      expect(useGeneralStore.getState().theme).toBe('system')

      useGeneralStore.getState().toggleTheme()
      expect(useGeneralStore.getState().theme).toBe('light')

      await Promise.resolve()
      await Promise.resolve()
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('loadSettings', () => {
    it('applies server-returned settings to local state', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            autoConnect: false,
            debugMode: true,
            autoFillEnvVars: false,
            theme: 'light',
          },
        }),
      })

      await useGeneralStore.getState().loadSettings(true)

      const state = useGeneralStore.getState()
      expect(state.isAutoConnectEnabled).toBe(false)
      expect(state.isDebugModeEnabled).toBe(true)
      expect(state.isAutoFillEnvVarsEnabled).toBe(false)
      expect(state.theme).toBe('light')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('sets an error when the response is not ok', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await useGeneralStore.getState().loadSettings(true)

      const state = useGeneralStore.getState()
      expect(state.error).toBe('Failed to fetch settings')
      expect(state.isLoading).toBe(false)
    })

    it('stores the error message when fetch rejects', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('boom'))
      await useGeneralStore.getState().loadSettings(true)

      const state = useGeneralStore.getState()
      expect(state.error).toBe('boom')
      expect(state.isLoading).toBe(false)
    })

    it('uses the cache and skips fetch when called twice within the cache window', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            autoConnect: true,
            debugMode: false,
            autoFillEnvVars: true,
            theme: 'dark',
          },
        }),
      })

      await useGeneralStore.getState().loadSettings(true)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Non-forced second call within the cache timeout must be skipped.
      await useGeneralStore.getState().loadSettings(false)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Forced call bypasses the cache.
      await useGeneralStore.getState().loadSettings(true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateSetting', () => {
    it('sends a PATCH request and clears the error on success', async () => {
      useGeneralStore.setState({ error: 'prev' })
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await useGeneralStore.getState().updateSetting('theme', 'system')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/settings',
        expect.objectContaining({ method: 'PATCH' })
      )
      const [, init] = (global.fetch as any).mock.calls[0]
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body)).toEqual({ theme: 'system' })
      expect(useGeneralStore.getState().error).toBeNull()
    })

    it('sets the error message and retries loadSettings when the PATCH fails', async () => {
      // Both PATCH and the retry loadSettings fail so the final error state
      // is observable after the promise chain settles.
      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })

      await useGeneralStore.getState().updateSetting('debugMode', true)

      // Allow queued microtasks (the retry reload) to complete.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      const state = useGeneralStore.getState()
      expect(state.error).toMatch(/Failed to (update setting|fetch settings)/)
      // Two fetches: one failed PATCH + one retry load.
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
