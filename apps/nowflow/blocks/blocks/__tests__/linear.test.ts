import { describe, expect, it, vi } from 'vitest'
import { LinearBlock } from '../linear'

vi.mock('@/components/icons', () => ({ LinearIcon: () => null }))

describe('LinearBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(LinearBlock).toBeDefined()
    expect(typeof LinearBlock).toBe('object')
    expect(typeof LinearBlock.type).toBe('string')
    expect(typeof LinearBlock.name).toBe('string')
    expect(typeof LinearBlock.description).toBe('string')
    expect(typeof LinearBlock.category).toBe('string')
    expect(typeof LinearBlock.bgColor).toBe('string')
    expect(LinearBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(LinearBlock.icon).toBeDefined()
    expect(Array.isArray(LinearBlock.subBlocks)).toBe(true)
    expect(LinearBlock.tools).toBeDefined()
    expect(typeof LinearBlock.inputs).toBe('object')
    expect(typeof LinearBlock.outputs).toBe('object')
  })

  it('has type matching filename (linear)', () => {
    expect(LinearBlock.type).toBe('linear')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(LinearBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of LinearBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(LinearBlock.tools.access)).toBe(true)
    if (LinearBlock.tools.config) {
      expect(typeof LinearBlock.tools.config.tool).toBe('function')
    }
  })
})
