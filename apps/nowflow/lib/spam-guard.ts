import { createLogger } from '@/lib/logs/console-logger'
import { redisRateLimit } from '@/lib/rate-limit/redis-store'

const logger = createLogger('SpamGuard')

/**
 * Spam-guard: distributed rate limiting for notifications, emails, and triggers.
 *
 * Delegates to `redisRateLimit.checkRateLimit(identifier, limit, windowMs)`
 * which is Redis-first with an in-memory fallback. This keeps quota state
 * consistent across multiple Node processes (no longer per-process Maps).
 *
 * Key prefixes are namespaced to avoid collisions across the three layers:
 *   spam:notification:* — workflow completion / failure notifications
 *   spam:email:*        — outbound system emails
 *   spam:trigger:*      — trigger execution rate limits
 */

// --- NOTIFICATION RATE LIMITING ---

const NOTIFICATION_COOLDOWN_MS = 10 * 1000 // 10 sec cooldown per workflow (prevents burst from duplicate webhooks)
const NOTIFICATION_MAX_PER_WORKFLOW = 3 // 3 notifications per cooldown window
const NOTIFICATION_MAX_PER_USER_HOUR = 120 // Max 120 notifications per user per hour

// Failure-specific limits: stricter to prevent spam loops from broken triggers
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000 // 5 min cooldown per workflow for failures
const FAILURE_MAX_PER_WORKFLOW = 2 // Max 2 failure emails per 5 min per workflow
const FAILURE_MAX_PER_USER_HOUR = 20 // Max 20 failure emails per user per hour (vs 120 for general)

// Circuit breaker: after N consecutive failures, suppress notifications for a longer window
const CIRCUIT_BREAKER_THRESHOLD = 5 // After 5 failures in an hour, open circuit
const CIRCUIT_BREAKER_WINDOW_MS = 60 * 60 * 1000 // 1 hour window for counting failures

const NOTIF_PREFIX = 'spam:notification:'

/**
 * Check if a workflow notification (completion/failure) should be sent.
 * Prevents the same workflow from spamming the same user.
 */
export async function canSendWorkflowNotification(
  userId: string,
  workflowId: string
): Promise<boolean> {
  // Check per-workflow cooldown
  const workflowKey = `${NOTIF_PREFIX}wf:${userId}:${workflowId}`
  const wf = await redisRateLimit.checkRateLimit(
    workflowKey,
    NOTIFICATION_MAX_PER_WORKFLOW,
    NOTIFICATION_COOLDOWN_MS
  )
  if (!wf.allowed) {
    logger.warn('Notification blocked: workflow cooldown', { userId, workflowId })
    return false
  }

  // Check per-user hourly limit
  const userKey = `${NOTIF_PREFIX}user-hour:${userId}`
  const userHour = await redisRateLimit.checkRateLimit(
    userKey,
    NOTIFICATION_MAX_PER_USER_HOUR,
    60 * 60 * 1000
  )
  if (!userHour.allowed) {
    logger.warn('Notification blocked: user hourly limit exceeded', { userId })
    return false
  }

  return true
}

/**
 * Stricter rate limiting for failure notifications.
 * Prevents spam loops when a trigger repeatedly fails (e.g. bad OAuth scope).
 * Uses a circuit breaker pattern: after CIRCUIT_BREAKER_THRESHOLD failures
 * for the same workflow in an hour, all failure notifications for that workflow
 * are suppressed until the window expires.
 */
export async function canSendFailureNotification(
  userId: string,
  workflowId: string
): Promise<boolean> {
  // Circuit breaker: each call consumes one slot from the hourly threshold counter.
  // When the limiter reports !allowed, the breaker is open.
  const circuitKey = `${NOTIF_PREFIX}failure-circuit:${userId}:${workflowId}`
  const circuit = await redisRateLimit.checkRateLimit(
    circuitKey,
    CIRCUIT_BREAKER_THRESHOLD,
    CIRCUIT_BREAKER_WINDOW_MS
  )
  if (!circuit.allowed) {
    logger.warn('Failure notification blocked: circuit breaker open', { userId, workflowId })
    return false
  }

  // Per-workflow failure cooldown (stricter than general)
  const workflowKey = `${NOTIF_PREFIX}failure-wf:${userId}:${workflowId}`
  const wf = await redisRateLimit.checkRateLimit(
    workflowKey,
    FAILURE_MAX_PER_WORKFLOW,
    FAILURE_COOLDOWN_MS
  )
  if (!wf.allowed) {
    logger.warn('Failure notification blocked: per-workflow cooldown', { userId, workflowId })
    return false
  }

  // Per-user hourly failure limit
  const userKey = `${NOTIF_PREFIX}failure-user-hour:${userId}`
  const userHour = await redisRateLimit.checkRateLimit(
    userKey,
    FAILURE_MAX_PER_USER_HOUR,
    60 * 60 * 1000
  )
  if (!userHour.allowed) {
    logger.warn('Failure notification blocked: user hourly failure limit', { userId })
    return false
  }

  return true
}

// --- EMAIL RATE LIMITING ---

const EMAIL_MAX_PER_RECIPIENT_HOUR = 50 // Max 50 system emails per recipient per hour
const EMAIL_MAX_PER_RECIPIENT_MINUTE = 10 // Max 10 system emails per recipient per minute

const EMAIL_PREFIX = 'spam:email:'

/**
 * Check if an email can be sent to a specific recipient.
 * Prevents flooding any single email address.
 */
export async function canSendEmailTo(recipientEmail: string): Promise<boolean> {
  const normalizedEmail = recipientEmail.toLowerCase().trim()

  // Per-minute burst protection
  const minuteKey = `${EMAIL_PREFIX}min:${normalizedEmail}`
  const minute = await redisRateLimit.checkRateLimit(
    minuteKey,
    EMAIL_MAX_PER_RECIPIENT_MINUTE,
    60 * 1000
  )
  if (!minute.allowed) {
    logger.warn('Email blocked: per-minute limit exceeded', { to: normalizedEmail })
    return false
  }

  // Per-hour sustained protection
  const hourKey = `${EMAIL_PREFIX}hour:${normalizedEmail}`
  const hour = await redisRateLimit.checkRateLimit(
    hourKey,
    EMAIL_MAX_PER_RECIPIENT_HOUR,
    60 * 60 * 1000
  )
  if (!hour.allowed) {
    logger.warn('Email blocked: per-hour limit exceeded', { to: normalizedEmail })
    return false
  }

  return true
}

// --- TRIGGER EXECUTION RATE LIMITING ---

const TRIGGER_MAX_EXECUTIONS_PER_MINUTE = 30 // Max 30 trigger executions per minute (safety net, not primary protection)
const TRIGGER_MAX_EXECUTIONS_PER_HOUR = 500 // Max 500 trigger executions per hour

const TRIGGER_PREFIX = 'spam:trigger:'

/**
 * Check if a trigger can execute a workflow.
 * Prevents runaway trigger loops.
 */
export async function canExecuteTrigger(triggerId: string): Promise<boolean> {
  // Per-minute burst protection
  const minuteKey = `${TRIGGER_PREFIX}min:${triggerId}`
  const minute = await redisRateLimit.checkRateLimit(
    minuteKey,
    TRIGGER_MAX_EXECUTIONS_PER_MINUTE,
    60 * 1000
  )
  if (!minute.allowed) {
    logger.warn('Trigger execution blocked: per-minute limit exceeded', { triggerId })
    return false
  }

  // Per-hour sustained protection
  const hourKey = `${TRIGGER_PREFIX}hour:${triggerId}`
  const hour = await redisRateLimit.checkRateLimit(
    hourKey,
    TRIGGER_MAX_EXECUTIONS_PER_HOUR,
    60 * 60 * 1000
  )
  if (!hour.allowed) {
    logger.warn('Trigger execution blocked: per-hour limit exceeded', { triggerId })
    return false
  }

  return true
}

/**
 * Get remaining trigger executions for monitoring/debugging.
 *
 * NOTE: the underlying redis-store has no read-only `peek` op, so this
 * call consumes one slot per bucket (same behaviour as the legacy
 * in-memory implementation when callers also incremented). Treat the
 * returned numbers as a near-accurate snapshot, not an exact reading.
 */
export async function getTriggerRemainingExecutions(
  triggerId: string
): Promise<{ perMinute: number; perHour: number }> {
  const minute = await redisRateLimit.checkRateLimit(
    `${TRIGGER_PREFIX}min:${triggerId}`,
    TRIGGER_MAX_EXECUTIONS_PER_MINUTE,
    60 * 1000
  )
  const hour = await redisRateLimit.checkRateLimit(
    `${TRIGGER_PREFIX}hour:${triggerId}`,
    TRIGGER_MAX_EXECUTIONS_PER_HOUR,
    60 * 60 * 1000
  )
  return {
    perMinute: minute.remaining,
    perHour: hour.remaining,
  }
}
