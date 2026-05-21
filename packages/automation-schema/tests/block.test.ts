import { describe, expect, it } from 'vitest'
import {
  BlockCapabilitySchema,
  BlockCategorySchema,
  BlockOutputSchema,
  BlockSchema,
  BlockToolsBindingSchema,
  ComplianceWarningSchema,
  OutputSchema,
  ParamSchema,
  ParamTypeSchema,
  PrimitiveValueTypeSchema,
  SubBlockSchema,
  SubBlockTypeSchema,
} from '../src/block'

const validBlock = {
  type: 'http',
  name: 'HTTP Request',
  description: 'Make an HTTP request',
  category: 'tools' as const,
  inputs: {
    url: { type: 'string' as const, required: true },
    body: { type: 'json' as const, required: false },
  },
  outputs: {
    response: { type: 'json' as const },
  },
  tools: {
    access: ['http.request'],
  },
}

describe('BlockSchema', () => {
  it('parses a minimal valid block', () => {
    const parsed = BlockSchema.parse(validBlock)
    expect(parsed.type).toBe('http')
    expect(parsed.category).toBe('tools')
    expect(parsed.capabilities).toEqual([])
    expect(parsed.subBlocks).toEqual([])
  })

  it('fails when the required `type` field is missing', () => {
    const { type: _omit, ...missingType } = validBlock
    const result = BlockSchema.safeParse(missingType)
    expect(result.success).toBe(false)
  })

  it('fails when `name` is missing', () => {
    const { name: _omit, ...missingName } = validBlock
    expect(BlockSchema.safeParse(missingName).success).toBe(false)
  })

  it('fails when `description` is missing', () => {
    const { description: _omit, ...missing } = validBlock
    expect(BlockSchema.safeParse(missing).success).toBe(false)
  })

  it('rejects a bad category enum value', () => {
    const bad = { ...validBlock, category: 'not-a-category' }
    const result = BlockSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('accepts all valid BlockCategory enum values', () => {
    for (const c of ['blocks', 'tools', 'data', 'integrations', 'agents']) {
      expect(BlockCategorySchema.safeParse(c).success).toBe(true)
    }
  })

  it('applies default `capabilities` and `subBlocks`', () => {
    const parsed = BlockSchema.parse(validBlock)
    expect(parsed.capabilities).toEqual([])
    expect(parsed.subBlocks).toEqual([])
  })

  it('accepts declared capabilities', () => {
    const parsed = BlockSchema.parse({
      ...validBlock,
      capabilities: ['tool_use', 'network'],
    })
    expect(parsed.capabilities).toEqual(['tool_use', 'network'])
  })

  it('rejects an unknown capability', () => {
    const result = BlockSchema.safeParse({ ...validBlock, capabilities: ['bogus'] })
    expect(result.success).toBe(false)
  })

  it('accepts a compliance block', () => {
    const parsed = BlockSchema.parse({
      ...validBlock,
      compliance: {
        enabled: true,
        tags: ['financial_trading'],
        disclaimer: 'Not financial advice',
        riskLevel: 'high',
      },
    })
    expect(parsed.compliance?.enabled).toBe(true)
  })
})

describe('ParamSchema', () => {
  it('accepts a basic param', () => {
    const parsed = ParamSchema.parse({ type: 'string', required: true })
    expect(parsed.type).toBe('string')
  })

  it('rejects an invalid ParamType', () => {
    expect(ParamSchema.safeParse({ type: 'date', required: true }).success).toBe(false)
  })

  it('accepts all valid ParamType values', () => {
    for (const t of ['string', 'number', 'boolean', 'json']) {
      expect(ParamTypeSchema.safeParse(t).success).toBe(true)
    }
  })

  it('rejects `any` on ParamType (only PrimitiveValueType allows it)', () => {
    expect(ParamTypeSchema.safeParse('any').success).toBe(false)
    expect(PrimitiveValueTypeSchema.safeParse('any').success).toBe(true)
  })
})

describe('BlockOutputSchema union types', () => {
  it('accepts a primitive string kind', () => {
    expect(BlockOutputSchema.safeParse('string').success).toBe(true)
    expect(BlockOutputSchema.safeParse('json').success).toBe(true)
    expect(BlockOutputSchema.safeParse('any').success).toBe(true)
  })

  it('accepts a nested record of kinds', () => {
    expect(BlockOutputSchema.safeParse({ foo: 'string', bar: 'number' }).success).toBe(true)
  })

  it('rejects a non-enum primitive', () => {
    expect(BlockOutputSchema.safeParse('not-a-kind').success).toBe(false)
  })
})

describe('OutputSchema', () => {
  it('accepts a simple output contract', () => {
    const parsed = OutputSchema.parse({ type: 'json' })
    expect(parsed.type).toBe('json')
  })

  it('accepts dependsOn metadata', () => {
    const parsed = OutputSchema.parse({
      type: 'json',
      dependsOn: {
        subBlockId: 'foo',
        condition: { whenEmpty: 'string', whenFilled: 'json' },
      },
    })
    expect(parsed.dependsOn?.subBlockId).toBe('foo')
  })
})

describe('SubBlockSchema', () => {
  it('accepts a minimal sub-block', () => {
    const parsed = SubBlockSchema.parse({ id: 'url', type: 'short-input' })
    expect(parsed.id).toBe('url')
  })

  it('rejects an unknown SubBlockType', () => {
    expect(SubBlockSchema.safeParse({ id: 'x', type: 'not-real' }).success).toBe(false)
  })

  it('SubBlockTypeSchema accepts known integration types', () => {
    expect(SubBlockTypeSchema.safeParse('oauth-input').success).toBe(true)
    expect(SubBlockTypeSchema.safeParse('teams-selector').success).toBe(true)
  })
})

describe('BlockToolsBindingSchema', () => {
  it('requires an access array', () => {
    expect(BlockToolsBindingSchema.safeParse({}).success).toBe(false)
    expect(BlockToolsBindingSchema.safeParse({ access: [] }).success).toBe(true)
  })
})

describe('BlockCapabilitySchema', () => {
  it('accepts known capabilities', () => {
    for (const c of ['streaming', 'tool_use', 'memory', 'webhook', 'loop_body']) {
      expect(BlockCapabilitySchema.safeParse(c).success).toBe(true)
    }
  })
})

describe('ComplianceWarningSchema', () => {
  it('requires enabled + tags + disclaimer', () => {
    expect(ComplianceWarningSchema.safeParse({ enabled: true }).success).toBe(false)
    expect(
      ComplianceWarningSchema.safeParse({
        enabled: true,
        tags: ['high_risk'],
        disclaimer: 'x',
      }).success
    ).toBe(true)
  })
})
