import { describe, expect, it, vi } from 'vitest'
import { AgentBlock } from '../agent'

vi.mock('@/components/icons', () => ({ AgentIcon: () => null }))

describe('AgentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(AgentBlock).toBeDefined()
    expect(typeof AgentBlock).toBe('object')
    expect(typeof AgentBlock.type).toBe('string')
    expect(typeof AgentBlock.name).toBe('string')
    expect(typeof AgentBlock.description).toBe('string')
    expect(typeof AgentBlock.category).toBe('string')
    expect(typeof AgentBlock.bgColor).toBe('string')
    expect(AgentBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(AgentBlock.icon).toBeDefined()
    expect(Array.isArray(AgentBlock.subBlocks)).toBe(true)
    expect(AgentBlock.tools).toBeDefined()
    expect(typeof AgentBlock.inputs).toBe('object')
    expect(typeof AgentBlock.outputs).toBe('object')
  })

  it('has type matching filename (agent)', () => {
    expect(AgentBlock.type).toBe('agent')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(AgentBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of AgentBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(AgentBlock.tools.access)).toBe(true)
    if (AgentBlock.tools.config) {
      expect(typeof AgentBlock.tools.config.tool).toBe('function')
    }
  })

  it('exposes a system-prompt-like subBlock for agent configuration', () => {
    const ids = AgentBlock.subBlocks.map((s) => s.id)
    const hasAgentConfig = ids.some((id) =>
      ['systemPrompt', 'system_prompt', 'instructions', 'prompt', 'model'].includes(id)
    )
    expect(hasAgentConfig).toBe(true)
  })
})
