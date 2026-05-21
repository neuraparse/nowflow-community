import { describe, expect, it, vi } from 'vitest'
import { MongoDBBlock } from '../mongodb'

vi.mock('@/components/icons', () => ({ MongoDBIcon: () => null, DatabaseIcon: () => null }))

describe('MongoDBBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(MongoDBBlock).toBeDefined()
    expect(typeof MongoDBBlock).toBe('object')
    expect(typeof MongoDBBlock.type).toBe('string')
    expect(typeof MongoDBBlock.name).toBe('string')
    expect(typeof MongoDBBlock.description).toBe('string')
    expect(typeof MongoDBBlock.category).toBe('string')
    expect(typeof MongoDBBlock.bgColor).toBe('string')
    expect(MongoDBBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(MongoDBBlock.icon).toBeDefined()
    expect(Array.isArray(MongoDBBlock.subBlocks)).toBe(true)
    expect(MongoDBBlock.tools).toBeDefined()
    expect(typeof MongoDBBlock.inputs).toBe('object')
    expect(typeof MongoDBBlock.outputs).toBe('object')
  })

  it('has type matching filename (mongodb)', () => {
    expect(MongoDBBlock.type).toBe('mongodb')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(MongoDBBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of MongoDBBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(MongoDBBlock.tools.access)).toBe(true)
    if (MongoDBBlock.tools.config) {
      expect(typeof MongoDBBlock.tools.config.tool).toBe('function')
    }
  })
})
