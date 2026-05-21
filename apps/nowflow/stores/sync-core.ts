import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SyncCore')

/**
 * Core sync types and utilities for optimistic state synchronization
 */

/**
 * Simple utility to check if we're in localStorage mode
 * This is the single source of truth for this check
 */
export function isLocalStorageMode(): boolean {
  if (typeof window === 'undefined') return false

  return (
    localStorage.getItem('USE_LOCAL_STORAGE') === 'true' ||
    process.env.USE_LOCAL_STORAGE === 'true' ||
    process.env.NEXT_PUBLIC_USE_LOCAL_STORAGE === 'true' ||
    process.env.DISABLE_DB_SYNC === 'true'
  )
}

// Configuration for a sync operation
export interface SyncConfig {
  // Required configuration
  endpoint: string
  preparePayload: () => Promise<any> | any
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT'

  // Sync triggers
  syncOnInterval?: boolean
  syncOnExit?: boolean

  // Optional configuration
  syncInterval?: number
  onSyncSuccess?: (response: any) => void
  onSyncError?: (error: any) => void
}

export const DEFAULT_SYNC_CONFIG: Partial<SyncConfig> = {
  syncOnInterval: true,
  syncOnExit: true,
  syncInterval: 900000, // 15 minutes - drastically reduced frequency to prevent system overload
}

// Core sync operations interface
export interface SyncOperations {
  sync: () => void
  startIntervalSync: () => void
  stopIntervalSync: () => void
}

// Performs sync operation with automatic retry
export async function performSync(config: SyncConfig): Promise<boolean> {
  try {
    // In localStorage mode, just return success immediately - no need to sync to server
    if (isLocalStorageMode()) {
      // Still call onSyncSuccess to maintain expected behavior
      if (config.onSyncSuccess) {
        config.onSyncSuccess({
          success: true,
          message: 'Skipped sync in localStorage mode',
        })
      }
      return true
    }

    // Get the payload to sync
    const payload = await Promise.resolve(config.preparePayload())

    // Skip sync if the payload indicates it should be skipped
    if (payload && payload.skipSync === true) {
      return true
    }

    // Normal API sync flow
    return await sendWithRetry(config.endpoint, payload, config)
  } catch (error) {
    if (config.onSyncError) {
      config.onSyncError(error)
    }
    logger.error(`Sync error: ${error}`)
    return false
  }
}

// Sends data to endpoint with intelligent retry logic
async function sendWithRetry(endpoint: string, payload: any, config: SyncConfig): Promise<boolean> {
  try {
    const result = await sendRequest(endpoint, payload, config)
    return result
  } catch {
    // Wait a bit before retry to avoid hitting compilation issues
    await new Promise((resolve) => setTimeout(resolve, 1000))

    try {
      const retryResult = await sendRequest(endpoint, payload, config)
      return retryResult
    } catch (retryError) {
      // Only log actual errors, not temporary 404s during compilation
      const message = retryError instanceof Error ? retryError.message : String(retryError)
      if (!message.includes('404')) {
        logger.error(`Sync failed after retry: ${message}`)
        if (config.onSyncError) {
          config.onSyncError(retryError)
        }
      }
      return false
    }
  }
}

// Sends a single request to the endpoint with timeout and better error handling
async function sendRequest(endpoint: string, payload: any, config: SyncConfig): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

  try {
    const response = await fetch(endpoint, {
      method: config.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: config.method !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle specific error cases more gracefully
    if (!response.ok) {
      if (response.status === 404) {
        // API route temporarily unavailable during compilation
        logger.debug(`API route temporarily unavailable (404): ${endpoint}`)
        return false // Don't throw, just return false to retry later
      }
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (config.onSyncSuccess) {
      config.onSyncSuccess(data)
    }

    return true
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug(`Sync request timeout for ${endpoint}`)
      return false // Don't throw on timeout, just return false
    }
    throw error
  }
}
