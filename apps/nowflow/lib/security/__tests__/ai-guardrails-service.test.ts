import { describe, expect, it, vi } from 'vitest'
import { AIGuardrailsService, type GuardrailRule } from '../ai-guardrails-service'

vi.mock('../pii-detector', () => ({
  detectPII: vi.fn((text: string, _types?: string[]) => {
    const matches: Array<{
      type: string
      value: string
      start: number
      end: number
      confidence: number
    }> = []
    const emailRe = /\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g
    let m: RegExpExecArray | null
    while ((m = emailRe.exec(text))) {
      matches.push({
        type: 'email',
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.99,
      })
    }
    const phoneRe = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
    while ((m = phoneRe.exec(text))) {
      matches.push({
        type: 'phone',
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.95,
      })
    }
    const ssnRe = /\b\d{3}-\d{2}-\d{4}\b/g
    while ((m = ssnRe.exec(text))) {
      matches.push({
        type: 'ssn',
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.98,
      })
    }
    return { hasPI: matches.length > 0, matches, maskedText: text }
  }),
  maskPII: vi.fn((text: string, matches: Array<{ value: string }>) => {
    let result = text
    for (const match of matches) {
      result = result.replace(match.value, '[REDACTED]')
    }
    return result
  }),
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

function makeRule(overrides: Partial<GuardrailRule> & Pick<GuardrailRule, 'type'>): GuardrailRule {
  return {
    id: overrides.id ?? overrides.type,
    enabled: overrides.enabled ?? true,
    severity: overrides.severity ?? 'block',
    config: overrides.config ?? {},
    ...overrides,
  }
}

// ---------- content_filter ----------
describe('content_filter', () => {
  it('blocks text containing harmful content keywords', () => {
    const svc = new AIGuardrailsService([makeRule({ type: 'content_filter' })])
    const result = svc.applyGuardrails('how to hack into a server', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations[0].type).toBe('content_filter')
  })

  it('passes clean text through', () => {
    const svc = new AIGuardrailsService([makeRule({ type: 'content_filter' })])
    const result = svc.applyGuardrails('Tell me about gardening tips', 'input')
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })
})

// ---------- pii_protection ----------
describe('pii_protection', () => {
  it('detects and masks emails', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'pii_protection', config: { piiTypes: ['email'], maskingMode: 'redact' } }),
    ])
    const result = svc.applyGuardrails('Contact user@example.com please', 'input')
    expect(result.filteredText).toContain('[REDACTED]')
    expect(result.filteredText).not.toContain('user@example.com')
  })

  it('detects phone numbers', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'pii_protection', config: { piiTypes: ['phone'] } }),
    ])
    const result = svc.applyGuardrails('Call me at 555-123-4567', 'input')
    expect(result.violations.length + result.warnings.length).toBeGreaterThan(0)
  })

  it('detects SSNs', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'pii_protection', config: { piiTypes: ['ssn'] } }),
    ])
    const result = svc.applyGuardrails('SSN is 123-45-6789', 'input')
    expect(result.violations.length + result.warnings.length).toBeGreaterThan(0)
  })
})

// ---------- topic_restriction ----------
describe('topic_restriction', () => {
  it('blocks text containing a blocked topic', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'topic_restriction', config: { blockedTopics: ['politics'] } }),
    ])
    const result = svc.applyGuardrails('Let me discuss politics today', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations[0].message).toContain('politics')
  })

  it('rejects text not matching any allowed topic', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'topic_restriction', config: { allowedTopics: ['cooking', 'gardening'] } }),
    ])
    const result = svc.applyGuardrails('Tell me about quantum physics', 'input')
    expect(result.passed).toBe(false)
  })

  it('allows text matching an allowed topic', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'topic_restriction', config: { allowedTopics: ['cooking'] } }),
    ])
    const result = svc.applyGuardrails('I love cooking pasta', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- output_format ----------
describe('output_format', () => {
  it('blocks output missing required JSON keys', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'output_format', config: { expectedKeys: ['name', 'age'] } }),
    ])
    const result = svc.applyGuardrails('{"name":"Alice"}', 'output')
    expect(result.passed).toBe(false)
    expect(result.violations[0].message).toContain('age')
  })

  it('blocks non-JSON when structured output is expected', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'output_format', config: { expectedKeys: ['id'] } }),
    ])
    const result = svc.applyGuardrails('not json at all', 'output')
    expect(result.passed).toBe(false)
  })

  it('passes valid JSON with all expected keys', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'output_format', config: { expectedKeys: ['id', 'value'] } }),
    ])
    const result = svc.applyGuardrails('{"id":1,"value":"ok"}', 'output')
    expect(result.passed).toBe(true)
  })

  it('skips output_format check for input direction', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'output_format', config: { expectedKeys: ['id'] } }),
    ])
    const result = svc.applyGuardrails('not json', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- cost_limit ----------
describe('cost_limit', () => {
  it('blocks when estimated cost exceeds max', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'cost_limit', config: { maxCost: 1.0, estimatedCost: 2.5 } }),
    ])
    const result = svc.applyGuardrails('any text', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations[0].message).toContain('2.50')
  })

  it('passes when cost is within limit', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'cost_limit', config: { maxCost: 5.0, estimatedCost: 1.0 } }),
    ])
    const result = svc.applyGuardrails('any text', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- token_limit ----------
describe('token_limit', () => {
  it('blocks text exceeding token limit', () => {
    const longText = 'a'.repeat(500) // ~125 tokens
    const svc = new AIGuardrailsService([
      makeRule({ type: 'token_limit', config: { maxTokens: 50 } }),
    ])
    const result = svc.applyGuardrails(longText, 'input')
    expect(result.passed).toBe(false)
    expect(result.violations[0].type).toBe('token_limit')
  })

  it('passes short text', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'token_limit', config: { maxTokens: 1000 } }),
    ])
    const result = svc.applyGuardrails('hello world', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- hallucination_check ----------
describe('hallucination_check', () => {
  it('flags output with low grounding score', () => {
    const svc = new AIGuardrailsService([
      makeRule({
        type: 'hallucination_check',
        config: { groundingFacts: ['Paris', 'France', 'Eiffel Tower', 'Seine'] },
      }),
    ])
    const result = svc.applyGuardrails('Tokyo is great', 'output')
    expect(result.passed).toBe(false)
    expect(result.violations[0].message).toContain('grounding')
  })

  it('passes grounded output', () => {
    const svc = new AIGuardrailsService([
      makeRule({
        type: 'hallucination_check',
        config: { groundingFacts: ['Paris', 'France'] },
      }),
    ])
    const result = svc.applyGuardrails('Paris is in France', 'output')
    expect(result.passed).toBe(true)
  })

  it('skips hallucination check for input direction', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'hallucination_check', config: { groundingFacts: ['X'] } }),
    ])
    const result = svc.applyGuardrails('unrelated text', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- custom_regex ----------
describe('custom_regex', () => {
  it('blocks text matching a custom pattern', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'custom_regex', config: { patterns: ['\\bforbidden\\b'] } }),
    ])
    const result = svc.applyGuardrails('This is forbidden content', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations[0].detail).toBe('\\bforbidden\\b')
  })

  it('passes text not matching any pattern', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'custom_regex', config: { patterns: ['\\bforbidden\\b'] } }),
    ])
    const result = svc.applyGuardrails('All good here', 'input')
    expect(result.passed).toBe(true)
  })
})

// ---------- severity levels ----------
describe('severity levels', () => {
  it('block severity prevents passing', () => {
    const svc = new AIGuardrailsService([makeRule({ type: 'content_filter', severity: 'block' })])
    const result = svc.applyGuardrails('how to hack into systems', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.warnings).toHaveLength(0)
  })

  it('warn severity still passes but adds warning', () => {
    const svc = new AIGuardrailsService([makeRule({ type: 'content_filter', severity: 'warn' })])
    const result = svc.applyGuardrails('how to hack into systems', 'input')
    expect(result.passed).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.violations).toHaveLength(0)
  })

  it('log severity still passes and adds to warnings', () => {
    const svc = new AIGuardrailsService([makeRule({ type: 'content_filter', severity: 'log' })])
    const result = svc.applyGuardrails('how to hack into systems', 'input')
    expect(result.passed).toBe(true)
    expect(result.warnings).toHaveLength(1)
  })
})

// ---------- multiple rules ----------
describe('multiple rules combined', () => {
  it('evaluates all enabled rules and skips disabled ones', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'content_filter', enabled: true }),
      makeRule({ type: 'token_limit', id: 'tokens', enabled: false, config: { maxTokens: 1 } }),
      makeRule({
        type: 'topic_restriction',
        id: 'topics',
        enabled: true,
        config: { allowedTopics: ['tech'] },
      }),
    ])
    const result = svc.applyGuardrails('Tell me about tech trends', 'input')
    expect(result.passed).toBe(true)
    expect(result.metadata.rulesEvaluated).toBe(2)
  })

  it('collects violations from multiple failing rules', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'content_filter' }),
      makeRule({
        type: 'custom_regex',
        id: 'regex',
        config: { patterns: ['\\bhack\\b'] },
      }),
    ])
    const result = svc.applyGuardrails('how to hack into servers', 'input')
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
  })

  it('returns metadata with rulesEvaluated and processingTimeMs', () => {
    const svc = new AIGuardrailsService([
      makeRule({ type: 'content_filter' }),
      makeRule({ type: 'token_limit', id: 'tk', config: { maxTokens: 9999 } }),
    ])
    const result = svc.applyGuardrails('hello', 'input')
    expect(result.metadata.rulesEvaluated).toBe(2)
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0)
  })
})
