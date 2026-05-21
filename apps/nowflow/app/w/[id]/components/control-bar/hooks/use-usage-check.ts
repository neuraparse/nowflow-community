'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { USAGE_CACHE_DURATION, UsageCache, UsageData } from '../types'

const logger = createLogger('ControlBar')

/**
 * Check user usage data with caching to prevent excessive API calls.
 */
export function useUsageCheck(userId: string | undefined) {
  const [usageExceeded, setUsageExceeded] = useState(false)
  const [usageData, setUsageData] = useState<UsageData | null>(null)

  const usageCacheRef = useRef<UsageCache>({
    data: null,
    timestamp: 0,
  })

  const checkUserUsage = useCallback(
    async (
      _userId: string,
      forceRefresh = false,
      signal?: AbortSignal
    ): Promise<UsageData | null> => {
      const now = Date.now()
      const cacheAge = now - usageCacheRef.current.timestamp

      if (!forceRefresh && usageCacheRef.current.data && cacheAge < USAGE_CACHE_DURATION) {
        logger.info('Using cached usage data', { cacheAge: `${Math.round(cacheAge / 1000)}s` })
        return usageCacheRef.current.data
      }

      try {
        const response = await fetch('/api/user/usage', { signal })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const usage = await response.json()

        usageCacheRef.current = {
          data: usage,
          timestamp: now,
        }

        return usage
      } catch (error) {
        if (isAbortLikeError(error, signal)) {
          return null
        }

        logger.error('Error checking usage limits:', { error })
        return null
      }
    },
    []
  )

  useEffect(() => {
    const abortController = new AbortController()

    if (userId) {
      checkUserUsage(userId, false, abortController.signal).then((usage) => {
        if (abortController.signal.aborted) return

        if (usage) {
          setUsageExceeded(usage.isExceeded)
          setUsageData(usage)
        }
      })
    }

    return () => {
      abortController.abort()
    }
  }, [checkUserUsage, userId])

  return { usageExceeded, setUsageExceeded, usageData, setUsageData, checkUserUsage }
}
