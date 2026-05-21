import { describe, expect, it, vi } from 'vitest'
import { ZoomBlock } from '../zoom'

vi.mock('@/components/icons', () => ({ ZoomIcon: () => null }))

describe('ZoomBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ZoomBlock).toBeDefined()
    expect(typeof ZoomBlock).toBe('object')
    expect(typeof ZoomBlock.type).toBe('string')
    expect(typeof ZoomBlock.name).toBe('string')
    expect(typeof ZoomBlock.description).toBe('string')
    expect(typeof ZoomBlock.category).toBe('string')
    expect(typeof ZoomBlock.bgColor).toBe('string')
    expect(ZoomBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(ZoomBlock.icon).toBeDefined()
    expect(Array.isArray(ZoomBlock.subBlocks)).toBe(true)
    expect(ZoomBlock.tools).toBeDefined()
    expect(typeof ZoomBlock.inputs).toBe('object')
    expect(typeof ZoomBlock.outputs).toBe('object')
  })

  it('has type matching filename (zoom)', () => {
    expect(ZoomBlock.type).toBe('zoom')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(ZoomBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of ZoomBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(ZoomBlock.tools.access)).toBe(true)
    if (ZoomBlock.tools.config) {
      expect(typeof ZoomBlock.tools.config.tool).toBe('function')
    }
  })
})
