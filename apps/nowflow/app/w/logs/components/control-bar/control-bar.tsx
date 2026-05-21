'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  ModernLiveIcon,
  ModernRefreshIcon,
  ModernSearchIcon,
  ModernStopIcon,
} from '@/components/modern-logs-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { useDebounce } from '@/hooks/use-debounce'
import { useFilterStore } from '../../stores/store'
import { LogsResponse } from '../../stores/types'

const logger = createLogger('ControlBar')

/**
 * Control bar for logs page - includes search functionality and refresh/live controls
 */
export function ControlBar() {
  const [isLive, setIsLive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const {
    setSearchQuery: setStoreSearchQuery,
    setLogs,
    logs,
    setError,
    applyFilters,
  } = useFilterStore()

  // Update store when debounced search query changes
  useEffect(() => {
    setStoreSearchQuery(debouncedSearchQuery)
  }, [debouncedSearchQuery, setStoreSearchQuery])

  const fetchLogs = async () => {
    try {
      // Include workflow data in the response
      const response = await fetch('/api/logs?includeWorkflow=true')

      if (!response.ok) {
        throw new Error(`Error fetching logs: ${response.statusText}`)
      }

      const data: LogsResponse = await response.json()
      return data
    } catch (err) {
      logger.error('Failed to fetch logs:', { err })
      throw err
    }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)

    // Create a timer to ensure the spinner shows for at least 1 second
    const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 1000))

    try {
      // Fetch new logs
      const logsResponse = await fetchLogs()

      // Wait for minimum loading time
      await minLoadingTime

      // Merge new logs with existing logs (avoid duplicates by ID)
      const existingLogIds = new Set(logs.map((log) => log.id))
      const newLogs = logsResponse.data.filter((log) => !existingLogIds.has(log.id))

      // Update logs in the store with merged logs
      setLogs([...newLogs, ...logs])
      setError(null)
    } catch (err) {
      // Wait for minimum loading time
      await minLoadingTime

      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Setup or clear the live refresh interval when isLive changes
  useEffect(() => {
    // Clear any existing interval
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }

    // If live mode is active, set up the interval
    if (isLive) {
      // Initial refresh when live mode is activated
      handleRefresh()

      // Set up interval for subsequent refreshes (every 5 seconds)
      liveIntervalRef.current = setInterval(() => {
        handleRefresh()
      }, 5000)
    }

    // Cleanup function to clear interval when component unmounts or isLive changes
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
        liveIntervalRef.current = null
      }
    }
  }, [isLive])

  const toggleLive = () => {
    setIsLive(!isLive)
  }

  return (
    <div className="silver-glass-panel flex flex-col sm:flex-row h-auto sm:h-16 w-full items-center justify-between px-3 sm:px-6 py-3 sm:py-0 border-b border-black/[0.06] dark:border-white/[0.06] shadow-sm transition-all duration-300 sticky top-0 z-20 rounded-none bg-transparent">
      {/* Left Section - Search */}
      <div className="relative w-full sm:w-[300px] md:w-[400px] mb-3 sm:mb-0">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <ModernSearchIcon className="h-4 w-4 text-zinc-400 dark:text-white/40" />
        </div>
        <Input
          type="search"
          placeholder="Search logs..."
          className="pl-10 h-9 transition-all duration-200 focus:ring-0"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Middle Section - Reserved for future use */}
      <div className="flex-1 hidden sm:block" />

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="hover:text-zinc-800 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-all duration-200"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-zinc-800 dark:text-white" />
              ) : (
                <ModernRefreshIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="sr-only">Refresh</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="silver-glass-panel border-black/[0.06] dark:border-white/[0.06] shadow-md bg-transparent">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </TooltipContent>
        </Tooltip>

        <Button
          className={`gap-2 border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-zinc-800 dark:text-white transition-all duration-300 ${
            isLive
              ? 'border-[#802FFF] shadow-[0_0_8px_rgba(128,47,255,0.3)] hover:shadow-[0_0_12px_rgba(128,47,255,0.4)]'
              : 'border-input hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
          }`}
          onClick={toggleLive}
          size="sm"
        >
          {isLive ? (
            <ModernStopIcon className="!h-3.5 !w-3.5 sm:!h-4 sm:!w-4 text-[#802FFF]" />
          ) : (
            <ModernLiveIcon className="!h-3.5 !w-3.5 sm:!h-4 sm:!w-4" />
          )}
          <span
            className={`text-xs sm:text-sm ${isLive ? 'text-[#802FFF] font-medium' : 'text-zinc-800 dark:text-white'}`}
          >
            {isLive ? 'Live' : 'Go Live'}
          </span>
        </Button>
      </div>
    </div>
  )
}
