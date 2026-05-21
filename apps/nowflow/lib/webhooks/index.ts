/**
 * Barrel export for the webhook namespace.
 *
 * Consolidates the entire `lib/webhooks/` surface into a single import site:
 *  - utils (composite barrel covering provider-verification + dedup + workflow execution + airtable)
 *  - monitoring (log + stats + health + activity timeline)
 *  - retry (queue + scheduler + cancel)
 *  - security (HMAC verify + IP allowlist + rate limit + payload sanitization + timestamp guard)
 *  - secret (AES-256-GCM encrypt/decrypt at rest)
 *
 * Existing nested-path imports (`from '@/lib/webhooks/security'`, `'@/lib/webhooks/utils'`,
 * etc.) keep working unchanged.
 */

// Composite utilities (provider-verification + dedup + workflow execution + airtable).
// `./utils` is itself a barrel — re-exporting it surfaces every helper without
// duplicating the export list.
export * from './utils'

// Monitoring (log entries, stats, health status, activity timeline).
export {
  cleanupOldWebhookLogs,
  getWebhookActivityTimeline,
  getWebhookLogs,
  getWebhookStats,
  logWebhookTrigger,
  updateWebhookHealthStatus,
  updateWebhookLog,
  updateWebhookStats,
} from './monitoring'
export type { WebhookLogEntry } from './monitoring'

// Retry (in-memory queue + scheduler + cancellation).
export {
  cancelRetry,
  clearRetryQueue,
  getRetryQueueStatus,
  processRetryQueue,
  scheduleWebhookRetry,
} from './retry'
export type { RetryConfig, RetryJob } from './retry'

// Security primitives (HMAC verify, IP allowlist, rate limit, payload
// sanitize, timestamp validity, generic incoming-request signature check).
export {
  calculateHealthStatus,
  checkRateLimit,
  cleanupRateLimitStore,
  generateWebhookSecret,
  getClientIp,
  isIpAllowed,
  isTimestampValid,
  sanitizePayload,
  verifyWebhookSignature,
  verifyWebhookSignatureWithPrefix,
} from './security'

// At-rest secret encryption (AES-256-GCM).
export { decryptWebhookSecret, encryptWebhookSecret, isEncryptedSecret } from './secret'
