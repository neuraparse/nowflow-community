import { describe, expect, it } from 'vitest'
import { FunctionBlock } from '../function'

describe('FunctionBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(FunctionBlock).toBeDefined()
    expect(typeof FunctionBlock).toBe('object')
    expect(typeof FunctionBlock.type).toBe('string')
    expect(typeof FunctionBlock.name).toBe('string')
    expect(typeof FunctionBlock.description).toBe('string')
    expect(typeof FunctionBlock.category).toBe('string')
    expect(typeof FunctionBlock.bgColor).toBe('string')
    expect(FunctionBlock.icon).toBeDefined()
    expect(Array.isArray(FunctionBlock.subBlocks)).toBe(true)
    expect(FunctionBlock.tools).toBeDefined()
  })

  it('has type matching filename (function)', () => {
    expect(FunctionBlock.type).toBe('function')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(FunctionBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of FunctionBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(FunctionBlock.tools.access)).toBe(true)
    if (FunctionBlock.tools.config) {
      expect(typeof FunctionBlock.tools.config.tool).toBe('function')
    }
  })
})
