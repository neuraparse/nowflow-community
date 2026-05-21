import { describe, expect, it, vi } from 'vitest'
import { CohereBlock } from '../cohere'

vi.mock('@/components/icons', () => ({ CohereIcon: () => null }))

describe('CohereBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(CohereBlock).toBeDefined()
    expect(typeof CohereBlock).toBe('object')
    expect(typeof CohereBlock.type).toBe('string')
    expect(typeof CohereBlock.name).toBe('string')
    expect(typeof CohereBlock.description).toBe('string')
    expect(typeof CohereBlock.category).toBe('string')
    expect(typeof CohereBlock.bgColor).toBe('string')
    expect(CohereBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(CohereBlock.icon).toBeDefined()
    expect(Array.isArray(CohereBlock.subBlocks)).toBe(true)
    expect(CohereBlock.tools).toBeDefined()
    expect(typeof CohereBlock.inputs).toBe('object')
    expect(typeof CohereBlock.outputs).toBe('object')
  })

  it('has type matching filename (cohere)', () => {
    expect(CohereBlock.type).toBe('cohere')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(CohereBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of CohereBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(CohereBlock.tools.access)).toBe(true)
    if (CohereBlock.tools.config) {
      expect(typeof CohereBlock.tools.config.tool).toBe('function')
    }
  })
})
