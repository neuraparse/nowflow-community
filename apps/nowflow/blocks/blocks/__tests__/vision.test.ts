import { describe, expect, it, vi } from 'vitest'
import { VisionBlock } from '../vision'

vi.mock('@/components/icons', () => ({ EyeIcon: () => null, VisionIcon: () => null }))

describe('VisionBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(VisionBlock).toBeDefined()
    expect(typeof VisionBlock).toBe('object')
    expect(typeof VisionBlock.type).toBe('string')
    expect(typeof VisionBlock.name).toBe('string')
    expect(typeof VisionBlock.description).toBe('string')
    expect(typeof VisionBlock.category).toBe('string')
    expect(typeof VisionBlock.bgColor).toBe('string')
    expect(VisionBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(VisionBlock.icon).toBeDefined()
    expect(Array.isArray(VisionBlock.subBlocks)).toBe(true)
    expect(VisionBlock.tools).toBeDefined()
    expect(typeof VisionBlock.inputs).toBe('object')
    expect(typeof VisionBlock.outputs).toBe('object')
  })

  it('has type matching filename (vision)', () => {
    expect(VisionBlock.type).toBe('vision')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(VisionBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of VisionBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(VisionBlock.tools.access)).toBe(true)
    if (VisionBlock.tools.config) {
      expect(typeof VisionBlock.tools.config.tool).toBe('function')
    }
  })

  it('has an apiKey subBlock', () => {
    const apiKey = VisionBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
  })
})
