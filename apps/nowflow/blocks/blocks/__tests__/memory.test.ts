import { describe, expect, it } from 'vitest'
import { MemoryBlock } from '../memory'

describe('MemoryBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(MemoryBlock).toBeDefined()
    expect(typeof MemoryBlock).toBe('object')
    expect(typeof MemoryBlock.type).toBe('string')
    expect(typeof MemoryBlock.name).toBe('string')
    expect(typeof MemoryBlock.description).toBe('string')
    expect(typeof MemoryBlock.category).toBe('string')
    expect(typeof MemoryBlock.bgColor).toBe('string')
    expect(MemoryBlock.icon).toBeDefined()
    expect(Array.isArray(MemoryBlock.subBlocks)).toBe(true)
    expect(MemoryBlock.tools).toBeDefined()
  })

  it('has type matching filename (memory)', () => {
    expect(MemoryBlock.type).toBe('memory')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(MemoryBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of MemoryBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(MemoryBlock.tools.access)).toBe(true)
    if (MemoryBlock.tools.config) {
      expect(typeof MemoryBlock.tools.config.tool).toBe('function')
    }
  })
})
