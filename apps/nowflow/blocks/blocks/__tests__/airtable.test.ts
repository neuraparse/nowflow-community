import { describe, expect, it, vi } from 'vitest'
import { AirtableBlock } from '../airtable'

vi.mock('@/components/icons', () => ({ AirtableIcon: () => null }))

describe('AirtableBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(AirtableBlock).toBeDefined()
    expect(typeof AirtableBlock).toBe('object')
    expect(typeof AirtableBlock.type).toBe('string')
    expect(typeof AirtableBlock.name).toBe('string')
    expect(typeof AirtableBlock.description).toBe('string')
    expect(typeof AirtableBlock.category).toBe('string')
    expect(typeof AirtableBlock.bgColor).toBe('string')
    expect(AirtableBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(AirtableBlock.icon).toBeDefined()
    expect(Array.isArray(AirtableBlock.subBlocks)).toBe(true)
    expect(AirtableBlock.tools).toBeDefined()
    expect(typeof AirtableBlock.inputs).toBe('object')
    expect(typeof AirtableBlock.outputs).toBe('object')
  })

  it('has type matching filename (airtable)', () => {
    expect(AirtableBlock.type).toBe('airtable')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(AirtableBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of AirtableBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(AirtableBlock.tools.access)).toBe(true)
    if (AirtableBlock.tools.config) {
      expect(typeof AirtableBlock.tools.config.tool).toBe('function')
    }
  })
})
