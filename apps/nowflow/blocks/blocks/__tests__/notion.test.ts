import { describe, expect, it, vi } from 'vitest'
import { NotionBlock } from '../notion'

vi.mock('@/components/icons', () => ({ NotionIcon: () => null }))

describe('NotionBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(NotionBlock).toBeDefined()
    expect(typeof NotionBlock).toBe('object')
    expect(typeof NotionBlock.type).toBe('string')
    expect(typeof NotionBlock.name).toBe('string')
    expect(typeof NotionBlock.description).toBe('string')
    expect(typeof NotionBlock.category).toBe('string')
    expect(typeof NotionBlock.bgColor).toBe('string')
    expect(NotionBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(NotionBlock.icon).toBeDefined()
    expect(Array.isArray(NotionBlock.subBlocks)).toBe(true)
    expect(NotionBlock.tools).toBeDefined()
    expect(typeof NotionBlock.inputs).toBe('object')
    expect(typeof NotionBlock.outputs).toBe('object')
  })

  it('has type matching filename (notion)', () => {
    expect(NotionBlock.type).toBe('notion')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(NotionBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of NotionBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(NotionBlock.tools.access)).toBe(true)
    if (NotionBlock.tools.config) {
      expect(typeof NotionBlock.tools.config.tool).toBe('function')
    }
  })
})
