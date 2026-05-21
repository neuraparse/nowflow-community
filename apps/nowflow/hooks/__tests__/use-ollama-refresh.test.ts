/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

type OllamaState = {
  models: string[]
  isLoading: boolean
  refreshModels: ReturnType<typeof vi.fn>
  refreshIfNeeded: ReturnType<typeof vi.fn>
}

const state: OllamaState = {
  models: [],
  isLoading: false,
  refreshModels: vi.fn(),
  refreshIfNeeded: vi.fn(),
}

vi.mock('@/stores/ollama/store', () => ({
  useOllamaStore: <T>(selector: (s: OllamaState) => T): T => selector(state),
}))

const { useOllamaRefresh } = await import('@/hooks/use-ollama-refresh')

describe('useOllamaRefresh', () => {
  beforeEach(() => {
    state.models = []
    state.isLoading = false
    state.refreshModels = vi.fn().mockResolvedValue([])
    state.refreshIfNeeded = vi.fn().mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns models, loading state, and helpers from the store', () => {
    state.models = ['llama3', 'mistral']
    state.isLoading = false

    const { result } = renderHook(() => useOllamaRefresh())

    expect(result.current.models).toEqual(['llama3', 'mistral'])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasModels).toBe(true)
    expect(typeof result.current.refreshModels).toBe('function')
    expect(typeof result.current.refreshIfNeeded).toBe('function')
  })

  it('reports hasModels=false when the models list is empty', () => {
    state.models = []
    const { result } = renderHook(() => useOllamaRefresh())

    expect(result.current.hasModels).toBe(false)
  })

  it('reflects the loading flag from the store', () => {
    state.isLoading = true
    const { result } = renderHook(() => useOllamaRefresh())

    expect(result.current.isLoading).toBe(true)
  })

  it('delegates refreshModels calls to the underlying store action', async () => {
    const refreshModels = vi.fn().mockResolvedValue(['llama3'])
    state.refreshModels = refreshModels

    const { result } = renderHook(() => useOllamaRefresh())

    await act(async () => {
      await result.current.refreshModels()
    })

    expect(refreshModels).toHaveBeenCalledTimes(1)
  })

  it('delegates refreshIfNeeded calls to the underlying store action', async () => {
    const refreshIfNeeded = vi.fn().mockResolvedValue(['mistral'])
    state.refreshIfNeeded = refreshIfNeeded

    const { result } = renderHook(() => useOllamaRefresh())

    let returned: string[] = []
    await act(async () => {
      returned = await result.current.refreshIfNeeded()
    })

    expect(refreshIfNeeded).toHaveBeenCalledTimes(1)
    expect(returned).toEqual(['mistral'])
  })
})
