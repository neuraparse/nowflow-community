'use client'

import { useCallback, useEffect, useState } from 'react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('useWorkspaces')

export interface Workspace {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

// Shared cache to prevent duplicate API calls across components
const workspacesCache = {
  data: null as Workspace[] | null,
  timestamp: 0,
  loading: false,
  listeners: new Set<() => void>(),
}

const CACHE_TTL = 60000 // 60 seconds cache

/**
 * Shared hook for fetching workspaces
 * Uses in-memory cache to prevent duplicate API calls
 */
export function useWorkspaces() {
  const [data, setData] = useState<Workspace[]>(workspacesCache.data ?? [])
  const [loading, setLoading] = useState(workspacesCache.loading)
  const [error, setError] = useState<Error | null>(null)

  const fetchWorkspaces = useCallback(async (force = false, signal?: AbortSignal) => {
    const now = Date.now()
    const isCacheValid = workspacesCache.data && now - workspacesCache.timestamp < CACHE_TTL

    // If cache is valid and not forcing refresh, use it
    if (isCacheValid && !force) {
      logger.debug('Using cached workspaces data')
      setData(workspacesCache.data!)
      setLoading(false)
      return
    }

    // If already loading from another component, wait for it
    if (workspacesCache.loading && !force) {
      logger.debug('Workspaces fetch already in progress, waiting...')
      const listener = () => {
        setData(workspacesCache.data ?? [])
        setLoading(false)
      }
      workspacesCache.listeners.add(listener)
      setLoading(true)
      return
    }

    // Fetch workspaces data
    workspacesCache.loading = true
    setLoading(true)

    try {
      logger.debug('Fetching workspaces from API')
      const response = await fetch('/api/workspaces', { signal })

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`)
      }

      const result = await response.json()
      const workspaces = result.workspaces as Workspace[]

      // Update cache
      workspacesCache.data = workspaces
      workspacesCache.timestamp = Date.now()
      workspacesCache.loading = false

      // Notify all listeners
      workspacesCache.listeners.forEach((listener) => listener())
      workspacesCache.listeners.clear()

      setData(workspaces)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      workspacesCache.loading = false

      if (isAbortLikeError(error, signal)) {
        workspacesCache.listeners.forEach((listener) => listener())
        workspacesCache.listeners.clear()
        return
      }

      logger.error('Error fetching workspaces:', error)
      setError(error)

      // Notify all listeners even on error
      workspacesCache.listeners.forEach((listener) => listener())
      workspacesCache.listeners.clear()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    fetchWorkspaces(false, abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [fetchWorkspaces])

  return {
    workspaces: data,
    loading,
    error,
    refetch: () => fetchWorkspaces(true),
  }
}

/**
 * Invalidate the workspaces cache (e.g., after workspace creation/deletion)
 */
export function invalidateWorkspacesCache() {
  logger.debug('Invalidating workspaces cache')
  workspacesCache.data = null
  workspacesCache.timestamp = 0
}
