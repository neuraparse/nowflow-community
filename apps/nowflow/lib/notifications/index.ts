/**
 * Barrel export for notification primitives.
 *
 * Consolidates the community notification surface so callers can
 * `import {...} from '@/lib/notifications'` for email and in-app delivery.
 */

// Email + in-app + workflow event notifications.
export {
  createDefaultPreferences,
  getUserNotificationPreferences,
  sendWorkflowCompletionNotification,
  sendWorkflowFailureNotification,
  updatePreferences,
} from './notification-service'
export type {
  NotificationEventType,
  UserNotificationPreferences,
  WorkflowCompletionOptions,
  WorkflowFailureOptions,
} from './notification-service'

// Multi-channel hub (email/in_app/telegram/slack/discord/whatsapp/webhook).
export { NotificationHub, getNotificationHub } from './notification-hub'
export type {
  ChannelDeliveryConfig,
  NotificationChannel,
  NotificationPayload,
  NotificationPriority,
  NotificationRequest,
  NotificationResult,
} from './notification-hub'

// Digest scheduler (daily / weekly).
export {
  initializeDigestSchedulers,
  sendDailyDigests,
  sendWeeklyDigests,
  stopDigestSchedulers,
} from './digest-scheduler'
