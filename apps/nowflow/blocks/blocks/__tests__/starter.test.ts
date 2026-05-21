import { describe, expect, it } from 'vitest'
import { StarterBlock } from '../starter'

describe('StarterBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(StarterBlock).toBeDefined()
    expect(typeof StarterBlock).toBe('object')
    expect(typeof StarterBlock.type).toBe('string')
    expect(typeof StarterBlock.name).toBe('string')
    expect(typeof StarterBlock.description).toBe('string')
    expect(typeof StarterBlock.category).toBe('string')
    expect(typeof StarterBlock.bgColor).toBe('string')
    expect(StarterBlock.icon).toBeDefined()
    expect(Array.isArray(StarterBlock.subBlocks)).toBe(true)
    expect(StarterBlock.tools).toBeDefined()
  })

  it('has type matching filename (starter)', () => {
    expect(StarterBlock.type).toBe('starter')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(StarterBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of StarterBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(StarterBlock.tools.access)).toBe(true)
    if (StarterBlock.tools.config) {
      expect(typeof StarterBlock.tools.config.tool).toBe('function')
    }
  })
})
