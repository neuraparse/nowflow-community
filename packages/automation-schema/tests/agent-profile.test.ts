import { describe, expect, it } from 'vitest'
import { AgentProfileSchema } from '../src/agent-profile'

const validProfile = {
  id: 'p1',
  name: 'Support Agent',
  systemPrompt: 'You are a helpful support agent.',
  model: 'claude-sonnet-4',
  tools: [],
  knowledgeSourceIds: [],
  memoryEnabled: false,
}

describe('AgentProfileSchema', () => {
  it('parses a minimal profile and applies defaults', () => {
    const parsed = AgentProfileSchema.parse(validProfile)
    expect(parsed.temperature).toBe(0.7)
    expect(parsed.memoryEnabled).toBe(false)
    expect(parsed.tools).toEqual([])
  })

  it('fails when required id is missing', () => {
    const { id: _omit, ...bad } = validProfile
    expect(AgentProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when required name is missing', () => {
    const { name: _omit, ...bad } = validProfile
    expect(AgentProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when systemPrompt is missing', () => {
    const { systemPrompt: _omit, ...bad } = validProfile
    expect(AgentProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when model is missing', () => {
    const { model: _omit, ...bad } = validProfile
    expect(AgentProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('fails when memoryEnabled is missing (no default)', () => {
    const { memoryEnabled: _omit, ...bad } = validProfile
    expect(AgentProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts temperature at the lower bound (0)', () => {
    const parsed = AgentProfileSchema.parse({ ...validProfile, temperature: 0 })
    expect(parsed.temperature).toBe(0)
  })

  it('accepts temperature at the upper bound (2)', () => {
    const parsed = AgentProfileSchema.parse({ ...validProfile, temperature: 2 })
    expect(parsed.temperature).toBe(2)
  })

  it('rejects temperature below 0', () => {
    expect(AgentProfileSchema.safeParse({ ...validProfile, temperature: -0.01 }).success).toBe(
      false
    )
  })

  it('rejects temperature above 2', () => {
    expect(AgentProfileSchema.safeParse({ ...validProfile, temperature: 2.01 }).success).toBe(false)
  })

  it('accepts a fully populated profile', () => {
    const parsed = AgentProfileSchema.parse({
      ...validProfile,
      description: 'Tier 1 support',
      temperature: 1.2,
      tools: ['http.request', 'search'],
      knowledgeSourceIds: ['ks1'],
      memoryEnabled: true,
      maxIterations: 10,
      metadata: { owner: 'team-x' },
    })
    expect(parsed.tools).toHaveLength(2)
    expect(parsed.maxIterations).toBe(10)
    expect(parsed.memoryEnabled).toBe(true)
  })

  it('rejects non-array tools', () => {
    expect(
      AgentProfileSchema.safeParse({ ...validProfile, tools: 'http.request' as unknown }).success
    ).toBe(false)
  })
})
