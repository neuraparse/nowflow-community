'use client'

import { useEffect, useState } from 'react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('useSubscription')

// Shared cache to prevent duplicate API calls across components
const subscriptionCache = {
  data: null as { isPro: boolean; plan: any } | null,
  timestamp: 0,
  loading: false,
  listeners: new Set<() => void>(),
}

const CACHE_TTL = 60000 // 60 seconds cache

/**
 * Shared hook for fetching subscription status
 * Uses in-memory cache to prevent duplicate API calls
 */
export function useSubscription() {
  const [data, setData] = useState(subscriptionCache.data)
  const [loading, setLoading] = useState(subscriptionCache.loading)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()
    const now = Date.now()
    const isCacheValid = subscriptionCache.data && now - subscriptionCache.timestamp < CACHE_TTL

    // If cache is valid, use it
    if (isCacheValid) {
      logger.debug('Using cached subscription data')
      setData(subscriptionCache.data)
      setLoading(false)
      return
    }

    // If already loading from another component, wait for it
    if (subscriptionCache.loading) {
      logger.debug('Subscription fetch already in progress, waiting...')
      const listener = () => {
        if (!isMounted) return
        setData(subscriptionCache.data)
        setLoading(false)
      }
      subscriptionCache.listeners.add(listener)
      setLoading(true)

      return () => {
        isMounted = false
        subscriptionCache.listeners.delete(listener)
      }
    }

    // Fetch subscription data
    const fetchSubscription = async () => {
      subscriptionCache.loading = true
      setLoading(true)

      try {
        logger.debug('Fetching subscription data from API')
        const response = await fetch('/api/user/subscription', {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch subscription: ${response.statusText}`)
        }

        const result = await response.json()

        // Update cache
        subscriptionCache.data = result
        subscriptionCache.timestamp = Date.now()
        subscriptionCache.loading = false

        // Notify all listeners
        subscriptionCache.listeners.forEach((listener) => listener())
        subscriptionCache.listeners.clear()

        if (isMounted) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        subscriptionCache.loading = false
        subscriptionCache.listeners.forEach((listener) => listener())
        subscriptionCache.listeners.clear()

        if (isAbortLikeError(error, abortController.signal) || !isMounted) {
          return
        }

        logger.error('Error fetching subscription:', error)
        setError(error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchSubscription()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  return {
    isPro: data?.isPro ?? false,
    plan: data?.plan ?? null,
    loading,
    error,
  }
}

/**
 * Invalidate the subscription cache (e.g., after subscription update)
 */
export function invalidateSubscriptionCache() {
  logger.debug('Invalidating subscription cache')
  subscriptionCache.data = null
  subscriptionCache.timestamp = 0
}
