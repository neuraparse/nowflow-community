import { describe, expect, it } from 'vitest'
import { ApiBlock } from '../api'

describe('ApiBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ApiBlock).toBeDefined()
    expect(typeof ApiBlock).toBe('object')
    expect(typeof ApiBlock.type).toBe('string')
    expect(typeof ApiBlock.name).toBe('string')
    expect(typeof ApiBlock.description).toBe('string')
    expect(typeof ApiBlock.category).toBe('string')
    expect(typeof ApiBlock.bgColor).toBe('string')
    expect(ApiBlock.icon).toBeDefined()
    expect(Array.isArray(ApiBlock.subBlocks)).toBe(true)
    expect(ApiBlock.tools).toBeDefined()
  })

  it('has type matching filename (api)', () => {
    expect(ApiBlock.type).toBe('api')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(ApiBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of ApiBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(ApiBlock.tools.access)).toBe(true)
    if (ApiBlock.tools.config) {
      expect(typeof ApiBlock.tools.config.tool).toBe('function')
    }
  })
})
