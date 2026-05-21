import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Import store AFTER mocks are registered
import { useOllamaStore } from '@/stores/ollama/store'

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock providers util
const updateOllamaProviderModelsMock = vi.fn()
vi.mock('@/providers/utils', () => ({
  updateOllamaProviderModels: (models: string[]) => updateOllamaProviderModelsMock(models),
}))

const initialState = useOllamaStore.getState()

beforeEach(() => {
  // Reset store to clean slate
  useOllamaStore.setState(
    {
      ...initialState,
      models: [],
      isLoading: false,
      lastRefreshed: 0,
    },
    true
  )
  updateOllamaProviderModelsMock.mockClear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useOllamaStore - initial state', () => {
  it('has expected initial state values', () => {
    const state = useOllamaStore.getState()
    expect(state.models).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.lastRefreshed).toBe(0)
    expect(typeof state.setModels).toBe('function')
    expect(typeof state.refreshModels).toBe('function')
    expect(typeof state.refreshIfNeeded).toBe('function')
  })
})

describe('setModels', () => {
  it('updates models in state and syncs to providers', () => {
    useOllamaStore.getState().setModels(['llama3', 'mistral'])
    expect(useOllamaStore.getState().models).toEqual(['llama3', 'mistral'])
    expect(updateOllamaProviderModelsMock).toHaveBeenCalledWith(['llama3', 'mistral'])
  })

  it('can replace models with an empty array', () => {
    useOllamaStore.setState({ models: ['llama3'] })
    useOllamaStore.getState().setModels([])
    expect(useOllamaStore.getState().models).toEqual([])
    expect(updateOllamaProviderModelsMock).toHaveBeenCalledWith([])
  })
})

describe('refreshModels', () => {
  it('fetches models, updates state and sets lastRefreshed', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, models: ['llama3', 'phi3'] }),
    } as Response)

    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const result = await useOllamaStore.getState().refreshModels()

    expect(fetchSpy).toHaveBeenCalledWith('/api/ollama/refresh', { method: 'POST' })
    expect(result).toEqual(['llama3', 'phi3'])

    const state = useOllamaStore.getState()
    expect(state.models).toEqual(['llama3', 'phi3'])
    expect(state.isLoading).toBe(false)
    expect(state.lastRefreshed).toBe(now)
    expect(updateOllamaProviderModelsMock).toHaveBeenCalledWith(['llama3', 'phi3'])
  })

  it('defaults to an empty array when response has no models field', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])
    expect(useOllamaStore.getState().models).toEqual([])
  })

  it('clears models when fetch returns non-ok status', async () => {
    useOllamaStore.setState({ models: ['stale-model'] })
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])

    const state = useOllamaStore.getState()
    expect(state.models).toEqual([])
    expect(state.isLoading).toBe(false)
  })

  it('returns empty when body says service is not available', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Ollama service is not available' }),
    } as Response)

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])
    expect(useOllamaStore.getState().models).toEqual([])
    expect(useOllamaStore.getState().isLoading).toBe(false)
  })

  it('clears state and returns empty on generic error from response body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Failed for some other reason' }),
    } as Response)

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])
    expect(useOllamaStore.getState().models).toEqual([])
    expect(useOllamaStore.getState().isLoading).toBe(false)
  })

  it('handles fetch rejection with ECONNREFUSED', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'))

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])
    expect(useOllamaStore.getState().models).toEqual([])
    expect(useOllamaStore.getState().isLoading).toBe(false)
  })

  it('handles unknown thrown values gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue('boom')

    const result = await useOllamaStore.getState().refreshModels()
    expect(result).toEqual([])
    expect(useOllamaStore.getState().isLoading).toBe(false)
  })
})

describe('refreshIfNeeded', () => {
  it('returns current models without refreshing when a refresh is in flight', async () => {
    useOllamaStore.setState({ models: ['a'], isLoading: true, lastRefreshed: 0 })
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await useOllamaStore.getState().refreshIfNeeded()
    expect(result).toEqual(['a'])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refreshes when models are empty', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, models: ['x'] }),
    } as Response)

    const result = await useOllamaStore.getState().refreshIfNeeded()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual(['x'])
  })

  it('skips refresh when models are fresh', async () => {
    const now = 5_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    useOllamaStore.setState({
      models: ['cached'],
      isLoading: false,
      lastRefreshed: now - 1000,
    })
    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await useOllamaStore.getState().refreshIfNeeded()
    expect(result).toEqual(['cached'])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refreshes when models are stale', async () => {
    const now = 10_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    useOllamaStore.setState({
      models: ['cached'],
      isLoading: false,
      // older than AUTO_REFRESH_INTERVAL (30s)
      lastRefreshed: now - 60_000,
    })
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, models: ['fresh'] }),
    } as Response)

    const result = await useOllamaStore.getState().refreshIfNeeded()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual(['fresh'])
  })
})
