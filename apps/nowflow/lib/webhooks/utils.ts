/**
 * Webhook Utilities
 *
 * Re-exports all webhook utility functions from focused modules:
 * - provider-verification: WhatsApp, Slack, and generic provider auth
 * - deduplication: Message and request dedup logic
 * - workflow-execution: Workflow execution and input formatting
 * - airtable-processing: Airtable payload fetching and consolidation
 */

// Provider verification
export {
  handleWhatsAppVerification,
  handleSlackChallenge,
  validateSlackSignature,
  verifyProviderWebhook,
} from './provider-verification'

// Deduplication
export {
  processWhatsAppDeduplication,
  processGenericDeduplication,
  generateRequestHash,
  normalizeBody,
} from './deduplication'

// Workflow execution
export {
  executeWorkflowFromPayload,
  formatWebhookInput,
  processWebhook,
} from './workflow-execution'

// Airtable processing
export { fetchAndProcessAirtablePayloads } from './airtable-processing'
export type { AirtableChange } from './airtable-processing'
