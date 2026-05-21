// Constants
export const USAGE_CACHE_DURATION = 60 * 1000 // 1 minute
export const DEBOUNCE_DELAY = 10000 // 10 seconds
export const THROTTLE_INTERVAL = 30000 // 30 seconds
export const TIME_UPDATE_INTERVAL = 60000 // 1 minute

// Types
export interface UsageData {
  percentUsed: number
  isWarning: boolean
  isExceeded: boolean
  currentUsage: number
  limit: number
}

export interface UsageCache {
  data: UsageData | null
  timestamp: number
}
