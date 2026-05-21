import { describe, expect, it } from 'vitest'
import { CSVProcessorBlock } from '../csv_processor'

describe('CSVProcessorBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(CSVProcessorBlock).toBeDefined()
    expect(typeof CSVProcessorBlock).toBe('object')
    expect(typeof CSVProcessorBlock.type).toBe('string')
    expect(typeof CSVProcessorBlock.name).toBe('string')
    expect(typeof CSVProcessorBlock.description).toBe('string')
    expect(typeof CSVProcessorBlock.category).toBe('string')
    expect(typeof CSVProcessorBlock.bgColor).toBe('string')
    expect(CSVProcessorBlock.icon).toBeDefined()
    expect(Array.isArray(CSVProcessorBlock.subBlocks)).toBe(true)
    expect(CSVProcessorBlock.tools).toBeDefined()
  })

  it('has type matching filename (csv_processor)', () => {
    expect(CSVProcessorBlock.type).toBe('csv_processor')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(CSVProcessorBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of CSVProcessorBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(CSVProcessorBlock.tools.access)).toBe(true)
    if (CSVProcessorBlock.tools.config) {
      expect(typeof CSVProcessorBlock.tools.config.tool).toBe('function')
    }
  })
})
