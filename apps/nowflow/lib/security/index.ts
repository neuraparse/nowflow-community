/**
 * Barrel export for the security namespace.
 *
 * Consolidates the public surface of `lib/security/` so callers can import
 * PII detection, deep sanitization, content isolation, and AI guardrails from
 * a single entry point. Existing nested-path imports keep working unchanged.
 */

// PII detection + masking (asterisk / hash / remove / redact, with object walk).
export { detectAndMaskPII, detectPII, maskPII, processObjectForPII } from './pii-detector'
export type { MaskingMode, PIIDetectionResult, PIIMatch, PIIType } from './pii-detector'

// Deep sanitization helpers — used to strip secrets from logs and workflow state
// before persistence / serialization.
export { SENSITIVE_FIELD_PATTERNS, deepSanitize, sanitizeWorkflowState } from './sanitize'
export type { DeepSanitizeOptions, SanitizeOptions } from './sanitize'

// Content isolation (wraps untrusted user-supplied text with delimiters so it
// cannot escape into the surrounding LLM prompt context).
export { isolateUserContent } from './content-isolation'

// AI guardrails service (rule-based output filtering for prompt-injection,
// PII, profanity, and policy enforcement).
export { AIGuardrailsService } from './ai-guardrails-service'
export type {
  GuardrailResult,
  GuardrailRule,
  GuardrailType,
  GuardrailViolation,
  Severity,
} from './ai-guardrails-service'
