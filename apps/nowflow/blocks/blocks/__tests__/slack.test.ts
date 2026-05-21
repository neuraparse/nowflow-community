import { describe, expect, it } from 'vitest'
import { SlackBlock } from '../slack'

describe('SlackBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SlackBlock).toBeDefined()
    expect(typeof SlackBlock).toBe('object')
    expect(typeof SlackBlock.type).toBe('string')
    expect(typeof SlackBlock.name).toBe('string')
    expect(typeof SlackBlock.description).toBe('string')
    expect(typeof SlackBlock.category).toBe('string')
    expect(typeof SlackBlock.bgColor).toBe('string')
    expect(SlackBlock.icon).toBeDefined()
    expect(Array.isArray(SlackBlock.subBlocks)).toBe(true)
    expect(SlackBlock.tools).toBeDefined()
  })

  it('has type matching filename (slack)', () => {
    expect(SlackBlock.type).toBe('slack')
  })

  it('has subBlocks with at minimum id and type per item', () => {
    expect(SlackBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of SlackBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(SlackBlock.tools.access)).toBe(true)
    if (SlackBlock.tools.config) {
      expect(typeof SlackBlock.tools.config.tool).toBe('function')
    }
  })
})
