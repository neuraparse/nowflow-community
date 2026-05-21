import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  AIGuardrailsService,
  type GuardrailRule,
  type GuardrailType,
  type Severity,
} from '@/lib/security/ai-guardrails-service'

const logger = createLogger('GuardrailsAPI')

/**
 * POST /api/guardrails/validate - Validate content against AI guardrails
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { text, direction, rules, guardrailTypes, severity, config } = body

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Field "text" is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Build rules from either explicit rules array or shorthand params
    const guardrailRules: GuardrailRule[] = Array.isArray(rules)
      ? rules
      : buildRulesFromParams(guardrailTypes, severity, config)

    if (guardrailRules.length === 0) {
      return NextResponse.json(
        {
          error:
            'At least one guardrail rule is required. Provide "rules" array or "guardrailTypes".',
        },
        { status: 400 }
      )
    }

    const service = new AIGuardrailsService(guardrailRules)
    const dir = direction === 'output' ? 'output' : 'input'
    const result = service.applyGuardrails(text, dir)

    const suggestions: string[] = []
    for (const v of result.violations) {
      if (v.type === 'pii_protection') suggestions.push('Remove or mask PII before sending to AI')
      if (v.type === 'content_filter') suggestions.push('Revise content to remove harmful language')
      if (v.type === 'token_limit') suggestions.push('Shorten the text to fit within token limits')
      if (v.type === 'topic_restriction')
        suggestions.push('Ensure content stays within allowed topics')
    }

    return NextResponse.json({
      passed: result.passed,
      filteredText: result.filteredText,
      violations: result.violations,
      warnings: result.warnings,
      suggestions: Array.from(new Set(suggestions)),
      metadata: result.metadata,
    })
  } catch (error) {
    logger.error('Guardrails validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate content against guardrails' },
      { status: 500 }
    )
  }
}

function buildRulesFromParams(
  types?: GuardrailType[],
  severity?: Severity,
  config?: Record<string, any>
): GuardrailRule[] {
  if (!Array.isArray(types) || types.length === 0) return []
  const sev = severity || 'block'
  const cfg = config || {}

  return types.map((type) => ({
    id: `auto_${type}`,
    type,
    enabled: true,
    severity: sev,
    config: cfg[type] || {},
  }))
}
