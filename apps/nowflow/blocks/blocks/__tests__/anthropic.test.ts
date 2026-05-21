import { describe, expect, it, vi } from 'vitest'
import { AnthropicBlock } from '../anthropic'

vi.mock('@/components/icons', () => ({ AnthropicIcon: () => null }))

describe('AnthropicBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(AnthropicBlock).toBeDefined()
    expect(typeof AnthropicBlock).toBe('object')
    expect(typeof AnthropicBlock.type).toBe('string')
    expect(typeof AnthropicBlock.name).toBe('string')
    expect(typeof AnthropicBlock.description).toBe('string')
    expect(typeof AnthropicBlock.category).toBe('string')
    expect(typeof AnthropicBlock.bgColor).toBe('string')
    expect(AnthropicBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(AnthropicBlock.icon).toBeDefined()
    expect(Array.isArray(AnthropicBlock.subBlocks)).toBe(true)
    expect(AnthropicBlock.tools).toBeDefined()
    expect(typeof AnthropicBlock.inputs).toBe('object')
    expect(typeof AnthropicBlock.outputs).toBe('object')
  })

  it('has type matching filename (anthropic)', () => {
    expect(AnthropicBlock.type).toBe('anthropic')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(AnthropicBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of AnthropicBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(AnthropicBlock.tools.access)).toBe(true)
    if (AnthropicBlock.tools.config) {
      expect(typeof AnthropicBlock.tools.config.tool).toBe('function')
    }
  })

  it('has an apiKey subBlock for credential configuration', () => {
    const apiKey = AnthropicBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
  })
})
