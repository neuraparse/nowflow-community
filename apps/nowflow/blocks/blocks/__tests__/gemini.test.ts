import { describe, expect, it, vi } from 'vitest'
import { GeminiBlock } from '../gemini'

vi.mock('@/components/icons', () => ({ GoogleIcon: () => null, GeminiIcon: () => null }))

describe('GeminiBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(GeminiBlock).toBeDefined()
    expect(typeof GeminiBlock).toBe('object')
    expect(typeof GeminiBlock.type).toBe('string')
    expect(typeof GeminiBlock.name).toBe('string')
    expect(typeof GeminiBlock.description).toBe('string')
    expect(typeof GeminiBlock.category).toBe('string')
    expect(typeof GeminiBlock.bgColor).toBe('string')
    expect(GeminiBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(GeminiBlock.icon).toBeDefined()
    expect(Array.isArray(GeminiBlock.subBlocks)).toBe(true)
    expect(GeminiBlock.tools).toBeDefined()
    expect(typeof GeminiBlock.inputs).toBe('object')
    expect(typeof GeminiBlock.outputs).toBe('object')
  })

  it('has type matching filename (gemini)', () => {
    expect(GeminiBlock.type).toBe('gemini')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(GeminiBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of GeminiBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(GeminiBlock.tools.access)).toBe(true)
    if (GeminiBlock.tools.config) {
      expect(typeof GeminiBlock.tools.config.tool).toBe('function')
    }
  })
})
