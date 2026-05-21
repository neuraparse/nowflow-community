/**
 * Adaptive polling and SSE integration for cross-device sync.
 * Adjusts polling intervals based on SSE connection health.
 */
import {
  POLLING_INTERVAL_SSE_ACTIVE,
  POLLING_INTERVAL_SSE_INACTIVE,
  POLLING_PAUSE_AFTER_USER_ACTION,
  SSE_HEALTHY_THRESHOLD,
} from './constants'
import { fetchWorkflowsFromDB } from './fetch'
import {
  isActivelyLoadingFromDB,
  isActivelyWorkspaceSwitching,
  isPollingActive,
  isSSEConnected,
  lastSSEUpdateTime,
  lastUserActionTime,
  logger,
  pollingTimer,
  setIsPollingActive,
  setPollingTimer,
  setSkipInitialPoll,
  setSSEUpdateReceived,
  setWindowFocusHandler,
  skipInitialPoll,
  sseUpdateReceived,
  windowFocusHandler,
} from './state'

/**
 * Check if SSE is considered healthy (connected and receiving updates)
 */
export function isSSEHealthy(): boolean {
  if (!isSSEConnected) return false
  const timeSinceSSEUpdate = Date.now() - lastSSEUpdateTime
  return timeSinceSSEUpdate < SSE_HEALTHY_THRESHOLD
}

/**
 * Get current adaptive polling interval based on SSE health
 */
export function getAdaptivePollingInterval(): number {
  return isSSEHealthy() ? POLLING_INTERVAL_SSE_ACTIVE : POLLING_INTERVAL_SSE_INACTIVE
}

/**
 * Schedule next poll with adaptive interval
 */
function scheduleNextPoll(): void {
  if (!isPollingActive) return

  const interval = getAdaptivePollingInterval()

  setPollingTimer(
    setTimeout(() => {
      executePoll()
      scheduleNextPoll() // Schedule next poll after this one completes
    }, interval)
  )
}

/**
 * Execute a single poll cycle
 */
function executePoll(): void {
  // Skip polling if user is actively editing (within 2 seconds)
  const timeSinceLastUserAction = Date.now() - lastUserActionTime
  if (timeSinceLastUserAction < POLLING_PAUSE_AFTER_USER_ACTION) {
    logger.debug(
      `⏸️ Skipping poll - user is actively editing (${Math.round(timeSinceLastUserAction / 1000)}s ago)`
    )
    return
  }

  // Skip polling if actively loading or workspace switching
  if (isActivelyLoadingFromDB() || isActivelyWorkspaceSwitching()) {
    logger.debug('⏸️ Skipping poll - system busy')
    return
  }

  // If SSE update was received recently, fetch immediately and reset flag
  if (sseUpdateReceived) {
    setSSEUpdateReceived(false)
    logger.debug('🔄 SSE-triggered fetch - immediate cross-device sync')
    fetchWorkflowsFromDB()
    return
  }

  // Log polling with current mode
  const mode = isSSEHealthy() ? 'backup' : 'primary'
  const interval = getAdaptivePollingInterval()
  logger.debug(
    `🔄 Adaptive poll (${mode} mode, ${interval / 1000}s interval) - checking for cross-device changes`
  )
  fetchWorkflowsFromDB()
}

/**
 * Start automatic polling to fetch updates from other devices
 * Uses adaptive intervals based on SSE connection health
 */
export function startAutoPolling(): void {
  if (isPollingActive || typeof window === 'undefined') return

  const initialInterval = getAdaptivePollingInterval()
  logger.debug(
    `🔄 Starting ADAPTIVE collaboration polling (initial: ${initialInterval / 1000}s, adapts based on SSE health)`
  )
  setIsPollingActive(true)

  // REMOVED: Window focus event handler - adaptive polling handles this
  setWindowFocusHandler(null)

  // OPTIMIZATION: Skip initial poll if data was already fetched during initialization
  if (skipInitialPoll) {
    logger.debug('⏭️ Skipping initial poll - data already fetched during initialization')
    setSkipInitialPoll(false)
  } else {
    // Initial fetch after minimal delay for startup
    setTimeout(() => {
      if (!isActivelyLoadingFromDB() && !isActivelyWorkspaceSwitching()) {
        logger.debug('🔄 Initial background poll for cross-device sync')
        fetchWorkflowsFromDB()
      }
    }, 1000)
  }

  // Start adaptive polling cycle
  scheduleNextPoll()
}

/**
 * Pause polling temporarily (e.g., during drag operations)
 */
export function pausePolling(): void {
  // lastUserActionTime is updated via state module - polling will auto-pause
  logger.debug('⏸️ Polling paused - user interaction detected')
}

/**
 * Resume polling after user interaction completes
 */
export function resumePolling(): void {
  // Polling will automatically resume after POLLING_PAUSE_AFTER_USER_ACTION
  logger.debug('▶️ Polling will resume after pause period')
}

/**
 * Stop automatic polling
 */
export function stopAutoPolling(): void {
  if (pollingTimer) {
    clearTimeout(pollingTimer)
    setPollingTimer(null)
  }

  // Remove window focus event listener
  if (windowFocusHandler && typeof window !== 'undefined') {
    window.removeEventListener('focus', windowFocusHandler)
    setWindowFocusHandler(null)
  }

  setIsPollingActive(false)
  // Note: SSE connected status is reset by the caller via setSSEConnected
  logger.debug('⏸️ Adaptive polling stopped')
}
