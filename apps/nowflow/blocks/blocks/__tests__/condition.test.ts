import { describe, expect, it } from 'vitest'
import { ConditionBlock } from '../condition'

describe('ConditionBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ConditionBlock).toBeDefined()
    expect(typeof ConditionBlock).toBe('object')
    expect(typeof ConditionBlock.type).toBe('string')
    expect(typeof ConditionBlock.name).toBe('string')
    expect(typeof ConditionBlock.description).toBe('string')
    expect(typeof ConditionBlock.category).toBe('string')
    expect(typeof ConditionBlock.bgColor).toBe('string')
    expect(ConditionBlock.icon).toBeDefined()
    expect(Array.isArray(ConditionBlock.subBlocks)).toBe(true)
    expect(ConditionBlock.tools).toBeDefined()
  })

  it('has type matching filename (condition)', () => {
    expect(ConditionBlock.type).toBe('condition')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(ConditionBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of ConditionBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(ConditionBlock.tools.access)).toBe(true)
    if (ConditionBlock.tools.config) {
      expect(typeof ConditionBlock.tools.config.tool).toBe('function')
    }
  })
})
