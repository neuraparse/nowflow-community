'use client'

import { useEffect } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { SYNC_INTERVALS } from './constants'
import {
  DEFAULT_SYNC_CONFIG,
  isLocalStorageMode,
  performSync,
  SyncConfig,
  SyncOperations,
} from './sync-core'

const logger = createLogger('Sync')

// Client-side sync manager with lifecycle and registry management
export interface SyncManager extends SyncOperations {
  id: string
  config: SyncConfig
  dispose: () => void // Cleanup function
  isSyncing: () => boolean // Check if sync is in progress
}

// Registry of sync managers for system-wide operations
const syncManagerRegistry = new Map<string, SyncManager>()

// Global throttling to prevent excessive sync operations
const globalSyncThrottle = new Map<string, number>()
const GLOBAL_SYNC_THROTTLE_MS = 30000 // 30 seconds minimum between syncs for same endpoint

// Creates a sync manager with optimistic updates
export function createSyncManager(config: SyncConfig): SyncManager {
  const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  // Merge with defaults
  const fullConfig: SyncConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...config,
  }

  // Track sync state
  let isSyncInProgress = false

  // Optimistic sync - fire and forget with global throttling
  const sync = (): void => {
    const now = Date.now()
    const lastSync = globalSyncThrottle.get(fullConfig.endpoint) || 0

    // Check if enough time has passed since last sync for this endpoint
    if (now - lastSync < GLOBAL_SYNC_THROTTLE_MS) {
      logger.debug(`Sync throttled for endpoint: ${fullConfig.endpoint}`)
      return
    }

    // Update throttle timestamp
    globalSyncThrottle.set(fullConfig.endpoint, now)

    isSyncInProgress = true
    performSync(fullConfig)
      .catch((err) => {
        logger.error('Sync failed:', { err })
      })
      .finally(() => {
        isSyncInProgress = false
      })
  }

  // Interval management
  let intervalId: NodeJS.Timeout | null = null

  const startIntervalSync = () => {
    if (intervalId !== null || !fullConfig.syncInterval || !fullConfig.syncOnInterval) return

    intervalId = setInterval(() => {
      sync()
    }, fullConfig.syncInterval)
  }

  const stopIntervalSync = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Create the manager
  const manager: SyncManager = {
    id,
    config: fullConfig,
    sync,
    startIntervalSync,
    stopIntervalSync,
    isSyncing: () => isSyncInProgress,
    dispose: () => {
      stopIntervalSync()
      syncManagerRegistry.delete(id)
    },
  }

  // Register in global registry
  syncManagerRegistry.set(id, manager)

  // Start interval if configured
  if (fullConfig.syncOnInterval && fullConfig.syncInterval) {
    startIntervalSync()
  }

  return manager
}

// Initializes the sync system with exit handlers
export function initializeSyncSystem(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Check if we're on an authentication page and skip confirmation if we are
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      // Skip confirmation for auth-related pages
      if (
        path === '/login' ||
        path === '/signup' ||
        path === '/setup' ||
        path === '/reset-password' ||
        path === '/verify'
      ) {
        return
      }
    }

    // Find managers that need exit sync
    const exitSyncManagers = Array.from(syncManagerRegistry.values()).filter(
      (manager) => manager.config.syncOnExit
    )

    if (exitSyncManagers.length === 0) return

    // Trigger all exit syncs
    exitSyncManagers.forEach((manager) => {
      manager.sync()
    })

    // Standard beforeunload pattern
    event.preventDefault()
    event.returnValue = ''
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}

// React hook for using a sync manager in components
export function useSyncManager(config: SyncConfig): SyncManager {
  const manager = createSyncManager(config)

  useEffect(() => {
    return () => {
      manager.dispose()
    }
  }, [manager])

  return manager
}

// Creates a singleton sync manager for a specific store
export function createSingletonSyncManager(
  key: string,
  configFactory: () => SyncConfig
): SyncManager {
  if (typeof window === 'undefined') {
    // Return a no-op manager for server-side rendering
    return {
      id: key,
      config: configFactory(),
      sync: () => {},
      startIntervalSync: () => {},
      stopIntervalSync: () => {},
      isSyncing: () => false,
      dispose: () => {},
    }
  }

  // Use our centralized function to check for localStorage mode
  if (isLocalStorageMode()) {
    // Return a no-op manager for localStorage mode
    return {
      id: key,
      config: configFactory(),
      sync: () => logger.info(`[LocalStorage Mode] Skipping sync for ${key}`),
      startIntervalSync: () => {},
      stopIntervalSync: () => {},
      isSyncing: () => false,
      dispose: () => {},
    }
  }

  const existing = syncManagerRegistry.get(key)
  if (existing) {
    return existing
  }

  const config = {
    ...configFactory(),
    syncInterval: SYNC_INTERVALS.DEFAULT,
  }

  let isSyncInProgress = false

  type SingletonSyncManager = SyncManager & { intervalId: NodeJS.Timeout | null }

  const manager: SingletonSyncManager = {
    id: key,
    config,
    sync: () => {
      isSyncInProgress = true
      performSync(config)
        .catch((err) => {
          logger.error(`Sync failed for ${key}:`, { err })
        })
        .finally(() => {
          isSyncInProgress = false
        })
    },
    startIntervalSync: () => {
      if (!config.syncInterval || !config.syncOnInterval) return
      manager.intervalId = setInterval(manager.sync, config.syncInterval)
    },
    stopIntervalSync: () => {
      if (manager.intervalId) {
        clearInterval(manager.intervalId)
        manager.intervalId = null
      }
    },
    isSyncing: () => isSyncInProgress,
    dispose: () => {
      manager.stopIntervalSync()
      syncManagerRegistry.delete(key)
    },
    intervalId: null as NodeJS.Timeout | null,
  }

  syncManagerRegistry.set(key, manager)

  if (config.syncOnInterval && config.syncInterval) {
    manager.startIntervalSync()
  }

  return manager
}

// Creates a factory function for store-specific sync managers
export function createSyncManagerFactory(baseConfig: Partial<SyncConfig>) {
  return (config: Partial<SyncConfig>): SyncManager => {
    return createSyncManager({
      ...baseConfig,
      ...config,
    } as SyncConfig)
  }
}
