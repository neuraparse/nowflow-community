import { create } from 'zustand'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { API_ENDPOINTS } from '../../constants'
import { EnvironmentStore, EnvironmentVariable } from './types'

const logger = createLogger('EnvironmentStore')

export const useEnvironmentStore = create<EnvironmentStore>()((set, get) => ({
  variables: {},
  isLoading: false,
  error: null,

  // Load environment variables from DB
  loadEnvironmentVariables: async () => {
    try {
      set({ isLoading: true, error: null })

      const response = await fetch(API_ENDPOINTS.ENVIRONMENT)

      // Handle unauthorized gracefully (user not logged in)
      if (response.status === 401) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('User not authenticated, skipping environment variables load')
        }
        set({
          variables: {},
          isLoading: false,
          error: null,
        })
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to load environment variables: ${response.statusText}`)
      }

      const result = await response.json()
      const data = result?.data

      if (data && typeof data === 'object') {
        set({
          variables: data,
          isLoading: false,
        })
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Environment variables loaded successfully', {
            count: Object.keys(data).length,
          })
        }
      } else {
        set({
          variables: {},
          isLoading: false,
        })
        if (process.env.NODE_ENV === 'development') {
          logger.debug('No environment variables found, initialized with empty state')
        }
      }
    } catch (error) {
      if (isAbortLikeError(error)) {
        set({
          isLoading: false,
          error: null,
        })
        return
      }

      logger.error('Error loading environment variables:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
        variables: {}, // Ensure we have a valid state even on error
      })
    }
  },

  // Save environment variables to DB
  saveEnvironmentVariables: async (variables: Record<string, string>) => {
    try {
      set({ isLoading: true, error: null })

      // Transform variables to the format expected by the store
      const transformedVariables = Object.entries(variables).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: { key, value },
        }),
        {}
      )

      // Update local state immediately (optimistic update)
      set({ variables: transformedVariables })

      // Send to DB
      const response = await fetch(API_ENDPOINTS.ENVIRONMENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables: Object.entries(transformedVariables).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: (value as EnvironmentVariable).value,
            }),
            {}
          ),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save environment variables: ${response.statusText}`)
      }

      set({ isLoading: false })
    } catch (error) {
      logger.error('Error saving environment variables:', { error })
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      })

      // Reload from DB to ensure consistency
      get().loadEnvironmentVariables()
    }
  },

  // Legacy method updated to use the new saveEnvironmentVariables
  setVariables: (variables: Record<string, string>) => {
    get().saveEnvironmentVariables(variables)
  },

  getVariable: (key: string): string | undefined => {
    return get().variables[key]?.value
  },

  getAllVariables: (): Record<string, EnvironmentVariable> => {
    return get().variables
  },
}))
