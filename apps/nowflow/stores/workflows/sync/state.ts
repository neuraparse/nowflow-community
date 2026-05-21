/**
 * Module-level mutable state for the workflow sync system.
 * These are singleton variables shared across the sync subsystem.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { LOADING_TIMEOUT, WORKSPACE_SWITCH_TIMEOUT } from './constants'

export const logger = createLogger('WorkflowsSync')

// ============================================
// AUTO-SAVE TRACKING STATE
// ============================================
export let lastAutoSaveTime = 0
export let lastAutoSaveState: Record<string, any> | null = null
export let autoSaveTimer: NodeJS.Timeout | null = null
export let autoSaveWorkflowId: string | null = null
export let autoSaveUserId: string | null = null

export function setLastAutoSaveTime(v: number) {
  lastAutoSaveTime = v
}
export function setLastAutoSaveState(v: Record<string, any> | null) {
  lastAutoSaveState = v
}
export function setAutoSaveTimer(v: NodeJS.Timeout | null) {
  autoSaveTimer = v
}
export function setAutoSaveWorkflowId(v: string | null) {
  autoSaveWorkflowId = v
}
export function setAutoSaveUserId(v: string | null) {
  autoSaveUserId = v
}

// ============================================
// SYNC TIMER STATE
// ============================================
export let userActionSyncTimer: NodeJS.Timeout | null = null
export let backgroundSyncTimer: NodeJS.Timeout | null = null
export let immediateSyncTimer: NodeJS.Timeout | null = null

export function setUserActionSyncTimer(v: NodeJS.Timeout | null) {
  userActionSyncTimer = v
}
export function setBackgroundSyncTimer(v: NodeJS.Timeout | null) {
  backgroundSyncTimer = v
}
export function setImmediateSyncTimer(v: NodeJS.Timeout | null) {
  immediateSyncTimer = v
}

// ============================================
// SYNC LOCK STATE
// ============================================
export let isSyncInProgress = false
export let pendingSyncAfterCurrent = false
export let hasLoggedPendingSync = false

export function setIsSyncInProgress(v: boolean) {
  isSyncInProgress = v
}
export function setPendingSyncAfterCurrent(v: boolean) {
  pendingSyncAfterCurrent = v
}
export function setHasLoggedPendingSync(v: boolean) {
  hasLoggedPendingSync = v
}

// ============================================
// LOADING STATE
// ============================================
export let isLoadingFromDB = false
export let loadingFromDBToken: string | null = null
export let loadingFromDBStartTime = 0

export function setIsLoadingFromDB(v: boolean) {
  isLoadingFromDB = v
}
export function setLoadingFromDBToken(v: string | null) {
  loadingFromDBToken = v
}
export function setLoadingFromDBStartTime(v: number) {
  loadingFromDBStartTime = v
}

// ============================================
// USER ACTION TRACKING
// ============================================
export let lastUserActionTime = 0

/**
 * Update last user action time - called by workflow store when durable changes occur
 * This is critical for conflict resolution to work correctly
 */
export function updateLastUserActionTime(): void {
  lastUserActionTime = Date.now()
}

/**
 * Get last user action time - for debugging and conflict resolution
 */
export function getLastUserActionTime(): number {
  return lastUserActionTime
}

// ============================================
// DB SYNC TRACKING
// ============================================
export let lastDBSyncTimestamp = 0
export let lastFetchTime = 0

export function setLastDBSyncTimestamp(v: number) {
  lastDBSyncTimestamp = v
}
export function setLastFetchTime(v: number) {
  lastFetchTime = v
}

// ============================================
// WORKSPACE SWITCHING
// ============================================
let _isWorkspaceSwitching = false
let workspaceSwitchingToken: string | null = null
let workspaceSwitchStartTime = 0

/**
 * Checks if the system is currently in the process of loading data from the database
 * Includes safety timeout to prevent permanent blocking of syncs
 */
export function isActivelyLoadingFromDB(): boolean {
  if (!loadingFromDBToken) return false

  const elapsedTime = Date.now() - loadingFromDBStartTime
  if (elapsedTime > LOADING_TIMEOUT) {
    logger.warn('⚠️ Loading timeout expired - unblocking syncs')
    loadingFromDBToken = null
    return false
  }

  return true
}

/**
 * Checks if workspace is currently switching
 * This prevents race conditions where sync happens with empty registry during workspace transitions
 */
export function isActivelyWorkspaceSwitching(): boolean {
  if (!workspaceSwitchingToken) return false

  const elapsedTime = Date.now() - workspaceSwitchStartTime
  if (elapsedTime > WORKSPACE_SWITCH_TIMEOUT) {
    logger.warn('⚠️ Workspace switch timeout expired - unblocking syncs')
    workspaceSwitchingToken = null
    _isWorkspaceSwitching = false
    return false
  }

  return true
}

/**
 * Start workspace switching lock
 * Call this when beginning workspace transition
 */
export function startWorkspaceSwitch(): void {
  _isWorkspaceSwitching = true
  workspaceSwitchingToken = 'switching'
  workspaceSwitchStartTime = Date.now()
  logger.debug('🔒 Workspace switch lock ENABLED - blocking syncs during transition')
}

/**
 * End workspace switching lock
 * Call this when workspace transition is complete
 */
export function endWorkspaceSwitch(): void {
  _isWorkspaceSwitching = false
  workspaceSwitchingToken = null
  logger.debug('🔓 Workspace switch lock RELEASED - syncs enabled')
}

// ============================================
// ONLINE/OFFLINE STATE
// ============================================
export let isOnline = typeof window !== 'undefined' ? navigator.onLine : true
export let hasPendingSync = false

export function setIsOnline(v: boolean) {
  isOnline = v
}
export function setHasPendingSync(v: boolean) {
  hasPendingSync = v
}

// ============================================
// FETCH THROTTLE STATE
// ============================================
export let lastFetchTimestamp = 0
export let isFetchInProgress = false
export let pendingFetchTimer: NodeJS.Timeout | null = null

export function setLastFetchTimestamp(v: number) {
  lastFetchTimestamp = v
}
export function setIsFetchInProgress(v: boolean) {
  isFetchInProgress = v
}
export function setPendingFetchTimer(v: NodeJS.Timeout | null) {
  pendingFetchTimer = v
}

// ============================================
// FAILURE TRACKING
// ============================================
export let consecutiveFailures = 0

export function setConsecutiveFailures(v: number) {
  consecutiveFailures = v
}
export function incrementConsecutiveFailures() {
  consecutiveFailures++
}

// ============================================
// POLLING STATE
// ============================================
export let pollingTimer: NodeJS.Timeout | null = null
export let isPollingActive = false
export let windowFocusHandler: (() => void) | null = null
export let skipInitialPoll = false

export function setPollingTimer(v: NodeJS.Timeout | null) {
  pollingTimer = v
}
export function setIsPollingActive(v: boolean) {
  isPollingActive = v
}
export function setWindowFocusHandler(v: (() => void) | null) {
  windowFocusHandler = v
}
export function setSkipInitialPoll(v: boolean) {
  skipInitialPoll = v
}

// ============================================
// SSE STATE
// ============================================
export let sseUpdateReceived = false
export let lastSSEUpdateTime = 0
export let isSSEConnected = false
export let sseDebounceTimer: NodeJS.Timeout | null = null

export function setSSEUpdateReceived(v: boolean) {
  sseUpdateReceived = v
}
export function setLastSSEUpdateTime(v: number) {
  lastSSEUpdateTime = v
}
export function setIsSSEConnected(v: boolean) {
  isSSEConnected = v
}
export function setSSEDebounceTimer(v: NodeJS.Timeout | null) {
  sseDebounceTimer = v
}
