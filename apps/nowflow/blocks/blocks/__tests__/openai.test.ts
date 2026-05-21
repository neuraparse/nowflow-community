import { describe, expect, it, vi } from 'vitest'
import { OpenAIBlock } from '../openai'

vi.mock('@/components/icons', () => ({ OpenAIIcon: () => null }))

describe('OpenAIBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(OpenAIBlock).toBeDefined()
    expect(typeof OpenAIBlock).toBe('object')
    expect(typeof OpenAIBlock.type).toBe('string')
    expect(typeof OpenAIBlock.name).toBe('string')
    expect(typeof OpenAIBlock.description).toBe('string')
    expect(typeof OpenAIBlock.category).toBe('string')
    expect(typeof OpenAIBlock.bgColor).toBe('string')
    expect(OpenAIBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(OpenAIBlock.icon).toBeDefined()
    expect(Array.isArray(OpenAIBlock.subBlocks)).toBe(true)
    expect(OpenAIBlock.tools).toBeDefined()
    expect(typeof OpenAIBlock.inputs).toBe('object')
    expect(typeof OpenAIBlock.outputs).toBe('object')
  })

  it('has type matching filename (openai)', () => {
    expect(OpenAIBlock.type).toBe('openai')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(OpenAIBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of OpenAIBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape with callable config.tool', () => {
    expect(Array.isArray(OpenAIBlock.tools.access)).toBe(true)
    expect(OpenAIBlock.tools.access.length).toBeGreaterThan(0)
    if (OpenAIBlock.tools.config) {
      expect(typeof OpenAIBlock.tools.config.tool).toBe('function')
    }
  })

  it('has an apiKey subBlock', () => {
    const apiKey = OpenAIBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
  })
})
