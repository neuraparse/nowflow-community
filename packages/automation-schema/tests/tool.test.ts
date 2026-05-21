import { describe, expect, it } from 'vitest'
import { ToolProviderSchema, ToolRateLimitSchema, ToolSchema } from '../src/tool'

const baseTool = {
  id: 'tool-1',
  name: 'search',
  description: 'Search the web',
  parameters: { query: { type: 'string' } },
  provider: 'internal' as const,
  requiresAuth: false,
}

describe('ToolProviderSchema enum', () => {
  it('accepts internal/http/custom', () => {
    for (const p of ['internal', 'http', 'custom']) {
      expect(ToolProviderSchema.safeParse(p).success).toBe(true)
    }
  })

  it('rejects an unknown provider', () => {
    expect(ToolProviderSchema.safeParse('grpc').success).toBe(false)
  })
})

describe('ToolSchema', () => {
  it('parses a minimal tool', () => {
    const parsed = ToolSchema.parse(baseTool)
    expect(parsed.provider).toBe('internal')
    expect(parsed.requiresAuth).toBe(false)
  })

  it('fails when requiresAuth is missing', () => {
    const { requiresAuth: _omit, ...bad } = baseTool
    expect(ToolSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when requiresAuth is non-boolean', () => {
    expect(ToolSchema.safeParse({ ...baseTool, requiresAuth: 'no' }).success).toBe(false)
  })

  it('accepts the requiresAuth boolean in both states', () => {
    expect(ToolSchema.parse({ ...baseTool, requiresAuth: true }).requiresAuth).toBe(true)
    expect(ToolSchema.parse({ ...baseTool, requiresAuth: false }).requiresAuth).toBe(false)
  })

  it('accepts an optional endpoint', () => {
    const parsed = ToolSchema.parse({
      ...baseTool,
      provider: 'http',
      endpoint: 'https://api.example.com/search',
    })
    expect(parsed.endpoint).toBe('https://api.example.com/search')
  })

  it('accepts an optional returns schema', () => {
    const parsed = ToolSchema.parse({
      ...baseTool,
      returns: { result: { type: 'array' } },
    })
    expect(parsed.returns).toBeDefined()
  })

  it('accepts an optional nested rateLimit', () => {
    const parsed = ToolSchema.parse({
      ...baseTool,
      rateLimit: { perMinute: 30 },
    })
    expect(parsed.rateLimit?.perMinute).toBe(30)
  })

  it('leaves rateLimit undefined when omitted', () => {
    const parsed = ToolSchema.parse(baseTool)
    expect(parsed.rateLimit).toBeUndefined()
  })

  it('rejects a malformed rateLimit (missing perMinute)', () => {
    const result = ToolSchema.safeParse({ ...baseTool, rateLimit: {} })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid provider', () => {
    expect(ToolSchema.safeParse({ ...baseTool, provider: 'rest' }).success).toBe(false)
  })
})

describe('ToolRateLimitSchema', () => {
  it('requires perMinute', () => {
    expect(ToolRateLimitSchema.safeParse({ perMinute: 10 }).success).toBe(true)
    expect(ToolRateLimitSchema.safeParse({}).success).toBe(false)
  })
})
