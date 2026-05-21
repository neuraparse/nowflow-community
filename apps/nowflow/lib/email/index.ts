/**
 * Barrel export for email primitives.
 *
 * Shared import surface for email helpers used by the Community app.
 *
 * Existing nested-path imports (`from '@/lib/email/unsubscribe-token'`,
 * `from '@/lib/email-templates/render'`, etc.) keep working unchanged.
 */

// Unsubscribe token + RFC 8058 list-unsubscribe headers.
export {
  buildUnsubscribeHeaders,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token'
export type { UnsubscribeCategory } from './unsubscribe-token'

// Template rendering primitives (escaping, branded shell, token substitution).
export {
  escapeHtml,
  renderBodyToHtml,
  renderTemplateString,
  sanitizeEmailHeaderValue,
  sanitizeHtmlForEmail,
  templateContainsToken,
  wrapBrandedEmail,
} from '@/lib/email-templates/render'
export type { EmailShellOptions } from '@/lib/email-templates/render'

// Builder block model used by template overrides.
export {
  blocksToHtml,
  blocksToTemplateSource,
  blocksToText,
  normalizeBlocks,
  sanitizeUrl,
} from '@/lib/email-templates/blocks'
export type { EmailBlock } from '@/lib/email-templates/blocks'

// Template registry (canonical templates + their metadata).
export { EMAIL_TEMPLATES, getEmailTemplateDefinition } from '@/lib/email-templates/registry'
export type {
  EmailTemplateDefinition,
  EmailTemplateEditor,
  EmailTemplateFormat,
  EmailTemplateId,
} from '@/lib/email-templates/registry'

// Template service (DB-backed overrides + render orchestration).
export {
  getEffectiveEmailTemplate,
  getEmailTemplateOverride,
  listEmailTemplateOverrides,
  renderEmail,
  upsertEmailTemplateOverride,
} from '@/lib/email-templates/service'
export type { EmailTemplateEffective, EmailTemplateRecord } from '@/lib/email-templates/service'
