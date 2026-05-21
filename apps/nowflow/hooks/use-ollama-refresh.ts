import { useOllamaStore } from '@/stores/ollama/store'

/**
 * Hook to provide Ollama models and refresh functionality.
 * Models are persisted in localStorage and auto-refreshed when stale.
 */
export function useOllamaRefresh() {
  const refreshModels = useOllamaStore((state) => state.refreshModels)
  const refreshIfNeeded = useOllamaStore((state) => state.refreshIfNeeded)
  const models = useOllamaStore((state) => state.models)
  const isLoading = useOllamaStore((state) => state.isLoading)

  return {
    models,
    refreshModels,
    refreshIfNeeded,
    isLoading,
    hasModels: models.length > 0,
  }
}
