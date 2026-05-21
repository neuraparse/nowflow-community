import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLogger } from '@/lib/logs/console-logger'
import { updateOllamaProviderModels } from '@/providers/utils'
import { OllamaStore } from './types'

const logger = createLogger('OllamaStore')

// Minimum interval between auto-refreshes (30 seconds)
const AUTO_REFRESH_INTERVAL = 30_000

export const useOllamaStore = create<OllamaStore>()(
  persist(
    (set, get) => ({
      models: [],
      isLoading: false,
      lastRefreshed: 0,

      setModels: (models) => {
        logger.debug('Updating Ollama models', { models })
        set({ models })
        // Update the providers when models change
        updateOllamaProviderModels(models)
      },

      refreshModels: async () => {
        try {
          set({ isLoading: true })
          logger.info('Ollama models refresh requested...')

          const response = await fetch('/api/ollama/refresh', {
            method: 'POST',
          })

          if (!response.ok) {
            logger.warn(`Ollama API returned ${response.status}, Ollama may not be available`)
            get().setModels([])
            set({ isLoading: false })
            return []
          }

          const data = await response.json()
          if (!data.success) {
            if (data.error?.includes('not available')) {
              logger.warn('Ollama service is not available during refresh')
              get().setModels([])
              set({ isLoading: false })
              return []
            }
            throw new Error(data.error || 'Failed to refresh models')
          }

          const models = data.models || []
          get().setModels(models)
          set({ isLoading: false, lastRefreshed: Date.now() })

          logger.info('Ollama models refreshed successfully', {
            modelCount: models.length,
            models,
          })

          return models
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          if (errorMessage.includes('not available') || errorMessage.includes('ECONNREFUSED')) {
            logger.warn('Ollama is not available during refresh')
          } else {
            logger.error('Failed to refresh Ollama models:', error)
          }
          get().setModels([])
          set({ isLoading: false })
          return []
        }
      },

      /**
       * Refresh only if models are empty or stale (older than AUTO_REFRESH_INTERVAL).
       * Called automatically when the model dropdown opens.
       */
      refreshIfNeeded: async () => {
        const { models, isLoading, lastRefreshed } = get()
        if (isLoading) return models

        const isStale = Date.now() - lastRefreshed > AUTO_REFRESH_INTERVAL
        if (models.length === 0 || isStale) {
          return get().refreshModels()
        }
        return models
      },
    }),
    {
      name: 'ollama-store',
      partialize: (state) => ({
        models: state.models,
        lastRefreshed: state.lastRefreshed,
      }),
      onRehydrateStorage: () => {
        // After rehydration from localStorage, sync models to providers
        return (state) => {
          if (state?.models?.length) {
            updateOllamaProviderModels(state.models)
            logger.debug('Rehydrated Ollama models from localStorage', {
              count: state.models.length,
            })
          }
        }
      },
    }
  )
)
