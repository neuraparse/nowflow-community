import { createLogger } from '@/lib/logs/console-logger'
import { detectPII, type MaskingMode, maskPII, type PIIMatch, type PIIType } from './pii-detector'

const logger = createLogger('AIGuardrails')

export type GuardrailType =
  | 'content_filter'
  | 'pii_protection'
  | 'topic_restriction'
  | 'output_format'
  | 'cost_limit'
  | 'token_limit'
  | 'hallucination_check'
  | 'custom_regex'

export type Severity = 'block' | 'warn' | 'log'

export interface GuardrailRule {
  id: string
  type: GuardrailType
  enabled: boolean
  severity: Severity
  config: Record<string, any>
}

export interface GuardrailViolation {
  ruleId: string
  type: GuardrailType
  severity: Severity
  message: string
  detail?: string
}

export interface GuardrailResult {
  passed: boolean
  filteredText: string
  violations: GuardrailViolation[]
  warnings: GuardrailViolation[]
  metadata: {
    rulesEvaluated: number
    processingTimeMs: number
  }
}

// Common harmful content keywords (kept intentionally minimal; a production system would use a model)
const HARMFUL_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(kill|murder|attack)\s+(people|person|someone)\b/i, label: 'violence' },
  { pattern: /\bhow\s+to\s+(hack|exploit|breach)\b/i, label: 'hacking instructions' },
  {
    pattern: /\b(bomb|explosive)\s+(making|instructions|build)\b/i,
    label: 'dangerous instructions',
  },
]

// Sensitive data patterns beyond PII (API keys, passwords, etc.)
const DATA_LEAK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(sk|pk)[-_]live[-_][a-zA-Z0-9]{20,}\b/g, label: 'API secret key' },
  { pattern: /\bghp_[a-zA-Z0-9]{36,}\b/g, label: 'GitHub token' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key' },
  { pattern: /\bpassword\s*[:=]\s*\S+/gi, label: 'password in text' },
]

export class AIGuardrailsService {
  private rules: GuardrailRule[]

  constructor(rules: GuardrailRule[] = []) {
    this.rules = rules
  }

  /**
   * Main method: run all enabled guardrails against text.
   */
  applyGuardrails(text: string, direction: 'input' | 'output'): GuardrailResult {
    const start = Date.now()
    const violations: GuardrailViolation[] = []
    const warnings: GuardrailViolation[] = []
    let filteredText = text
    let rulesEvaluated = 0

    for (const rule of this.rules) {
      if (!rule.enabled) continue
      rulesEvaluated++

      const ruleViolations = this.evaluateRule(rule, filteredText, direction)

      for (const v of ruleViolations) {
        if (v.severity === 'warn' || v.severity === 'log') {
          warnings.push(v)
        } else {
          violations.push(v)
        }
      }

      // Apply PII masking inline if configured
      if (rule.type === 'pii_protection' && ruleViolations.length > 0) {
        const piiTypes = (rule.config.piiTypes as PIIType[]) || [
          'email',
          'phone',
          'credit_card',
          'ssn',
        ]
        const mode = (rule.config.maskingMode as MaskingMode) || 'redact'
        const detection = detectPII(filteredText, piiTypes)
        filteredText = maskPII(filteredText, detection.matches, mode)
      }
    }

    const passed = violations.length === 0

    if (!passed) {
      logger.warn(`Guardrails blocked ${direction}`, { violationCount: violations.length })
    }

    return {
      passed,
      filteredText,
      violations,
      warnings,
      metadata: { rulesEvaluated, processingTimeMs: Date.now() - start },
    }
  }

  /** Check input before sending to an AI model. */
  validateInput(text: string): GuardrailResult {
    return this.applyGuardrails(text, 'input')
  }

  /** Check AI output before returning to the user. */
  validateOutput(text: string): GuardrailResult {
    return this.applyGuardrails(text, 'output')
  }

  /** Detect harmful or inappropriate content. */
  checkContentSafety(text: string): GuardrailViolation[] {
    const violations: GuardrailViolation[] = []

    for (const { pattern, label } of HARMFUL_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags)
      if (regex.test(text)) {
        violations.push({
          ruleId: 'content_filter',
          type: 'content_filter',
          severity: 'block',
          message: `Content flagged for: ${label}`,
          detail: label,
        })
      }
    }

    return violations
  }

  /** Prevent sensitive data from leaking in AI responses. */
  checkDataLeakage(text: string): GuardrailViolation[] {
    const violations: GuardrailViolation[] = []

    for (const { pattern, label } of DATA_LEAK_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags)
      if (regex.test(text)) {
        violations.push({
          ruleId: 'data_leakage',
          type: 'pii_protection',
          severity: 'block',
          message: `Sensitive data detected: ${label}`,
          detail: label,
        })
      }
    }

    // Also check for PII
    const piiResult = detectPII(text)
    if (piiResult.hasPI) {
      for (const match of piiResult.matches) {
        violations.push({
          ruleId: 'data_leakage_pii',
          type: 'pii_protection',
          severity: 'warn',
          message: `PII detected: ${match.type} (confidence ${match.confidence})`,
          detail: match.type,
        })
      }
    }

    return violations
  }

  /** Ensure AI output matches an expected JSON schema shape. */
  enforceOutputFormat(text: string, expectedKeys: string[]): GuardrailViolation[] {
    const violations: GuardrailViolation[] = []

    try {
      const parsed = JSON.parse(text)
      for (const key of expectedKeys) {
        if (!(key in parsed)) {
          violations.push({
            ruleId: 'output_format',
            type: 'output_format',
            severity: 'block',
            message: `Missing required key "${key}" in output`,
          })
        }
      }
    } catch {
      if (expectedKeys.length > 0) {
        violations.push({
          ruleId: 'output_format',
          type: 'output_format',
          severity: 'block',
          message: 'Output is not valid JSON but structured output was expected',
        })
      }
    }

    return violations
  }

  // --- private helpers ---

  private evaluateRule(
    rule: GuardrailRule,
    text: string,
    direction: 'input' | 'output'
  ): GuardrailViolation[] {
    switch (rule.type) {
      case 'content_filter':
        return this.checkContentSafety(text).map((v) => ({
          ...v,
          ruleId: rule.id,
          severity: rule.severity,
        }))

      case 'pii_protection': {
        const piiTypes = (rule.config.piiTypes as PIIType[]) || [
          'email',
          'phone',
          'credit_card',
          'ssn',
        ]
        const result = detectPII(text, piiTypes)
        return result.matches.map((m) => ({
          ruleId: rule.id,
          type: 'pii_protection' as GuardrailType,
          severity: rule.severity,
          message: `PII detected: ${m.type}`,
          detail: m.type,
        }))
      }

      case 'topic_restriction': {
        const allowed: string[] = rule.config.allowedTopics || []
        const blocked: string[] = rule.config.blockedTopics || []
        return this.checkTopicRestrictions(text, allowed, blocked, rule)
      }

      case 'output_format': {
        if (direction !== 'output') return []
        const keys: string[] = rule.config.expectedKeys || []
        return this.enforceOutputFormat(text, keys).map((v) => ({
          ...v,
          ruleId: rule.id,
          severity: rule.severity,
        }))
      }

      case 'cost_limit': {
        const maxCost = rule.config.maxCost as number
        const estimatedCost = rule.config.estimatedCost as number
        if (estimatedCost != null && maxCost != null && estimatedCost > maxCost) {
          return [
            {
              ruleId: rule.id,
              type: 'cost_limit',
              severity: rule.severity,
              message: `Estimated cost $${estimatedCost.toFixed(2)} exceeds limit $${maxCost.toFixed(2)}`,
            },
          ]
        }
        return []
      }

      case 'token_limit': {
        const maxTokens = rule.config.maxTokens as number
        if (maxTokens != null) {
          // Rough estimate: 1 token ~ 4 characters
          const estimatedTokens = Math.ceil(text.length / 4)
          if (estimatedTokens > maxTokens) {
            return [
              {
                ruleId: rule.id,
                type: 'token_limit',
                severity: rule.severity,
                message: `Estimated ${estimatedTokens} tokens exceeds limit of ${maxTokens}`,
              },
            ]
          }
        }
        return []
      }

      case 'hallucination_check': {
        if (direction !== 'output') return []
        const groundingFacts: string[] = rule.config.groundingFacts || []
        return this.checkHallucination(text, groundingFacts, rule)
      }

      case 'custom_regex': {
        const patterns: string[] = rule.config.patterns || []
        return this.checkCustomRegex(text, patterns, rule)
      }

      default:
        return []
    }
  }

  private checkTopicRestrictions(
    text: string,
    allowed: string[],
    blocked: string[],
    rule: GuardrailRule
  ): GuardrailViolation[] {
    const violations: GuardrailViolation[] = []
    const lower = text.toLowerCase()

    for (const topic of blocked) {
      if (lower.includes(topic.toLowerCase())) {
        violations.push({
          ruleId: rule.id,
          type: 'topic_restriction',
          severity: rule.severity,
          message: `Blocked topic detected: "${topic}"`,
          detail: topic,
        })
      }
    }

    if (allowed.length > 0) {
      const hasAllowed = allowed.some((t) => lower.includes(t.toLowerCase()))
      if (!hasAllowed) {
        violations.push({
          ruleId: rule.id,
          type: 'topic_restriction',
          severity: rule.severity,
          message: 'Content does not match any allowed topics',
        })
      }
    }

    return violations
  }

  private checkHallucination(
    text: string,
    groundingFacts: string[],
    rule: GuardrailRule
  ): GuardrailViolation[] {
    if (groundingFacts.length === 0) return []

    const lower = text.toLowerCase()
    const matched = groundingFacts.filter((f) => lower.includes(f.toLowerCase()))
    const ratio = matched.length / groundingFacts.length

    if (ratio < 0.3) {
      return [
        {
          ruleId: rule.id,
          type: 'hallucination_check',
          severity: rule.severity,
          message: `Low grounding score (${Math.round(ratio * 100)}%): output may not be factually grounded`,
        },
      ]
    }

    return []
  }

  private checkCustomRegex(
    text: string,
    patterns: string[],
    rule: GuardrailRule
  ): GuardrailViolation[] {
    const violations: GuardrailViolation[] = []

    for (const p of patterns) {
      try {
        const regex = new RegExp(p, 'gi')
        if (regex.test(text)) {
          violations.push({
            ruleId: rule.id,
            type: 'custom_regex',
            severity: rule.severity,
            message: `Custom pattern matched: ${p}`,
            detail: p,
          })
        }
      } catch {
        logger.warn(`Invalid custom regex pattern: ${p}`)
      }
    }

    return violations
  }
}
