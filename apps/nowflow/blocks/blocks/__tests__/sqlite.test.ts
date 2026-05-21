import { describe, expect, it, vi } from 'vitest'
import { SQLiteBlock } from '../sqlite'

vi.mock('@/components/icons', () => ({ SQLiteIcon: () => null, DatabaseIcon: () => null }))

describe('SQLiteBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SQLiteBlock).toBeDefined()
    expect(typeof SQLiteBlock).toBe('object')
    expect(typeof SQLiteBlock.type).toBe('string')
    expect(typeof SQLiteBlock.name).toBe('string')
    expect(typeof SQLiteBlock.description).toBe('string')
    expect(typeof SQLiteBlock.category).toBe('string')
    expect(typeof SQLiteBlock.bgColor).toBe('string')
    expect(SQLiteBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(SQLiteBlock.icon).toBeDefined()
    expect(Array.isArray(SQLiteBlock.subBlocks)).toBe(true)
    expect(SQLiteBlock.tools).toBeDefined()
    expect(typeof SQLiteBlock.inputs).toBe('object')
    expect(typeof SQLiteBlock.outputs).toBe('object')
  })

  it('has type matching filename (sqlite)', () => {
    expect(SQLiteBlock.type).toBe('sqlite')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(SQLiteBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of SQLiteBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(SQLiteBlock.tools.access)).toBe(true)
    if (SQLiteBlock.tools.config) {
      expect(typeof SQLiteBlock.tools.config.tool).toBe('function')
    }
  })
})
