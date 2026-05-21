import { describe, expect, it } from 'vitest'
import { getModelPricing } from '../pricing'

describe('getModelPricing', () => {
  it('returns exact pricing for known models', () => {
    const p = getModelPricing('gpt-4o')
    expect(p).toBeDefined()
    expect(p.input).toBeGreaterThan(0)
    expect(p.output).toBeGreaterThan(0)
    expect(p.updatedAt).toBeTypeOf('string')
  })

  it('normalizes case when looking up', () => {
    const lower = getModelPricing('gpt-4o')
    const upper = getModelPricing('GPT-4O')
    expect(upper).toEqual(lower)
  })

  it('matches Anthropic Claude model pricing', () => {
    const p = getModelPricing('claude-opus-4-6')
    expect(p).toBeDefined()
    expect(p.input).toBe(5.0)
    expect(p.output).toBe(25.0)
  })

  it('matches DeepSeek reasoning model pricing', () => {
    const p = getModelPricing('deepseek-reasoner')
    expect(p.input).toBe(0.55)
    expect(p.output).toBe(2.19)
  })

  it('uses partial match for versioned variants', () => {
    // e.g. an unknown suffix on a base gpt-4o should still find pricing
    const p = getModelPricing('gpt-4o-some-new-variant')
    expect(p).toBeDefined()
    expect(p.input).toBeGreaterThan(0)
  })

  it('falls back to default pricing for completely unknown models', () => {
    const p = getModelPricing('totally-unknown-model-xyz')
    expect(p).toEqual({
      input: 1.0,
      cachedInput: 0.5,
      output: 5.0,
      updatedAt: '2025-03-21',
    })
  })

  it('includes cachedInput for most priced models', () => {
    const p = getModelPricing('gpt-4o')
    expect(p.cachedInput).toBeGreaterThan(0)
    expect(p.cachedInput).toBeLessThanOrEqual(p.input)
  })
})
