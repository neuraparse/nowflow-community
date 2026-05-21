/**
 * Barrel export for the trigger namespace.
 *
 * Consolidates polling implementations (email / form / database / file / calendar),
 * outlook webhook subscriptions, the unified executor entry point, and shared
 * utilities (stats, identifier extraction, schedule, syncing) into a single
 * import site. Existing nested-path imports keep working unchanged.
 */

// Common utilities (stats update, identifier hashing, polling schedule, sync).
export {
  calculateNextPollTime,
  extractIdentifier,
  hasSeenData,
  syncTriggerFromWorkflowState,
  updateLastSeenIdentifiers,
  updateTriggerStats,
} from './utils'

// Email polling (Gmail / Outlook unified entry).
export { executeEmailPolling, executeGmailPolling, executeOutlookPolling } from './email-polling'
export type { EmailMessage, EmailTriggerConfig } from './email-polling'

// Form polling.
export { executeFormPolling } from './form-polling'
export type { FormResponse, FormTriggerConfig } from './form-polling'

// Database change polling.
export { executeDatabasePolling } from './database-polling'
export type { DatabaseChange, DatabaseTriggerConfig } from './database-polling'

// File-system / storage change polling.
export { executeFilePolling } from './file-polling'
export type { FileChange, FileTriggerConfig } from './file-polling'

// Calendar event polling.
export { executeCalendarPolling } from './calendar-polling'
export type { CalendarEvent, CalendarTriggerConfig } from './calendar-polling'

// Outlook webhook subscription lifecycle.
export {
  cleanupOrphanSubscriptions,
  createOutlookSubscription,
  deleteOutlookSubscription,
  renewOutlookSubscription,
} from './outlook-subscription'
export type { OutlookSubscriptionInfo } from './outlook-subscription'

// Unified executor entry — invoked by every trigger after detecting changes.
export { executeTriggeredWorkflow } from './execute-triggered-workflow'
