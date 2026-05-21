import { describe, expect, it } from 'vitest'
import { LoopBlock } from '../loop'

describe('LoopBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(LoopBlock).toBeDefined()
    expect(typeof LoopBlock).toBe('object')
    expect(typeof LoopBlock.type).toBe('string')
    expect(typeof LoopBlock.name).toBe('string')
    expect(typeof LoopBlock.description).toBe('string')
    expect(typeof LoopBlock.category).toBe('string')
    expect(typeof LoopBlock.bgColor).toBe('string')
    expect(LoopBlock.icon).toBeDefined()
    expect(Array.isArray(LoopBlock.subBlocks)).toBe(true)
    expect(LoopBlock.tools).toBeDefined()
  })

  it('has type matching filename (loop)', () => {
    expect(LoopBlock.type).toBe('loop')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(LoopBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of LoopBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(LoopBlock.tools.access)).toBe(true)
    if (LoopBlock.tools.config) {
      expect(typeof LoopBlock.tools.config.tool).toBe('function')
    }
  })
})
