import { describe, expect, it } from 'vitest'
import { RouterBlock } from '../router'

describe('RouterBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(RouterBlock).toBeDefined()
    expect(typeof RouterBlock).toBe('object')
    expect(typeof RouterBlock.type).toBe('string')
    expect(typeof RouterBlock.name).toBe('string')
    expect(typeof RouterBlock.description).toBe('string')
    expect(typeof RouterBlock.category).toBe('string')
    expect(typeof RouterBlock.bgColor).toBe('string')
    expect(RouterBlock.icon).toBeDefined()
    expect(Array.isArray(RouterBlock.subBlocks)).toBe(true)
    expect(RouterBlock.tools).toBeDefined()
  })

  it('has type matching filename (router)', () => {
    expect(RouterBlock.type).toBe('router')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(RouterBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of RouterBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(RouterBlock.tools.access)).toBe(true)
    if (RouterBlock.tools.config) {
      expect(typeof RouterBlock.tools.config.tool).toBe('function')
    }
  })
})
