import { describe, expect, it, vi } from 'vitest'
import { FreshBooksBlock } from '../freshbooks'

vi.mock('@/components/icons', () => ({ FreshBooksIcon: () => null, FreshbooksIcon: () => null }))

describe('FreshBooksBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(FreshBooksBlock).toBeDefined()
    expect(typeof FreshBooksBlock).toBe('object')
    expect(typeof FreshBooksBlock.type).toBe('string')
    expect(typeof FreshBooksBlock.name).toBe('string')
    expect(typeof FreshBooksBlock.description).toBe('string')
    expect(typeof FreshBooksBlock.category).toBe('string')
    expect(typeof FreshBooksBlock.bgColor).toBe('string')
    expect(FreshBooksBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(FreshBooksBlock.icon).toBeDefined()
    expect(Array.isArray(FreshBooksBlock.subBlocks)).toBe(true)
    expect(FreshBooksBlock.tools).toBeDefined()
    expect(typeof FreshBooksBlock.inputs).toBe('object')
    expect(typeof FreshBooksBlock.outputs).toBe('object')
  })

  it('has type matching filename (freshbooks)', () => {
    expect(FreshBooksBlock.type).toBe('freshbooks')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(FreshBooksBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of FreshBooksBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(FreshBooksBlock.tools.access)).toBe(true)
    if (FreshBooksBlock.tools.config) {
      expect(typeof FreshBooksBlock.tools.config.tool).toBe('function')
    }
  })
})
