import { describe, expect, it, vi } from 'vitest'
import { AsanaBlock } from '../asana'

vi.mock('@/components/icons', () => ({ AsanaIcon: () => null }))

describe('AsanaBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(AsanaBlock).toBeDefined()
    expect(typeof AsanaBlock).toBe('object')
    expect(typeof AsanaBlock.type).toBe('string')
    expect(typeof AsanaBlock.name).toBe('string')
    expect(typeof AsanaBlock.description).toBe('string')
    expect(typeof AsanaBlock.category).toBe('string')
    expect(typeof AsanaBlock.bgColor).toBe('string')
    expect(AsanaBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(AsanaBlock.icon).toBeDefined()
    expect(Array.isArray(AsanaBlock.subBlocks)).toBe(true)
    expect(AsanaBlock.tools).toBeDefined()
    expect(typeof AsanaBlock.inputs).toBe('object')
    expect(typeof AsanaBlock.outputs).toBe('object')
  })

  it('has type matching filename (asana)', () => {
    expect(AsanaBlock.type).toBe('asana')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(AsanaBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of AsanaBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(AsanaBlock.tools.access)).toBe(true)
    if (AsanaBlock.tools.config) {
      expect(typeof AsanaBlock.tools.config.tool).toBe('function')
    }
  })
})
