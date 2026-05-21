/**
 * Constants for the workflow sync system.
 * Includes timing intervals, debounce values, and TTLs.
 */

// Auto-save constants
export const AUTO_SAVE_CHECK_INTERVAL = 60000 // Check every 60 seconds
export const AUTO_SAVE_MIN_INTERVAL = 300000 // Minimum 5 minutes between auto-saves

// Sync debounce values
export const USER_ACTION_DEBOUNCE = 100 // 100ms - Near-instant sync for user actions
export const IMMEDIATE_SYNC_DEBOUNCE = 50 // 50ms - Minimal debounce for batching only
export const BACKGROUND_SYNC_DEBOUNCE = 30000 // 30 seconds - balanced background sync

// Polling intervals - adaptive based on SSE health
export const POLLING_INTERVAL_SSE_ACTIVE = 30000 // 30 seconds - SSE is primary, polling is just backup
export const POLLING_INTERVAL_SSE_INACTIVE = 5000 // 5 seconds - SSE failed, polling becomes primary
export const POLLING_PAUSE_AFTER_USER_ACTION = 3000 // 3 seconds - Short pause during active editing
export const FETCH_THROTTLE_MS = 3000 // 3 seconds - Throttle to prevent excessive fetches
export const ACTIVE_CLIENT_WINDOW = 10000 // 10 seconds - If user did ANY action in last 10s, this client is ACTIVE
export const SSE_HEALTHY_THRESHOLD = 15000 // 15 seconds - SSE considered healthy if update received within this time

// Pending operation TTLs
export const PENDING_DELETE_TTL_MS = 15000 // 15 seconds - suppress re-add while delete propagates
export const PENDING_CREATE_TTL_MS = 15000 // 15 seconds - preserve local creates until DB confirms

// Loading and workspace switch timeouts
export const LOADING_TIMEOUT = 10000 // 10 seconds
export const WORKSPACE_SWITCH_TIMEOUT = 5000 // 5 seconds maximum workspace switch time

// Fetch debounce
export const FETCH_DEBOUNCE_MS = 1000 // Wait 1 second before actually fetching

// Failure tracking
export const MAX_CONSECUTIVE_FAILURES = 3
