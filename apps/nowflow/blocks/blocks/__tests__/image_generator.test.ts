import { describe, expect, it, vi } from 'vitest'
import { ImageGeneratorBlock } from '../image_generator'

vi.mock('@/components/icons', () => ({
  ImageIcon: () => null,
  ImageGeneratorIcon: () => null,
  OpenAIIcon: () => null,
}))

describe('ImageGeneratorBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ImageGeneratorBlock).toBeDefined()
    expect(typeof ImageGeneratorBlock).toBe('object')
    expect(typeof ImageGeneratorBlock.type).toBe('string')
    expect(typeof ImageGeneratorBlock.name).toBe('string')
    expect(typeof ImageGeneratorBlock.description).toBe('string')
    expect(typeof ImageGeneratorBlock.category).toBe('string')
    expect(typeof ImageGeneratorBlock.bgColor).toBe('string')
    expect(ImageGeneratorBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(ImageGeneratorBlock.icon).toBeDefined()
    expect(Array.isArray(ImageGeneratorBlock.subBlocks)).toBe(true)
    expect(ImageGeneratorBlock.tools).toBeDefined()
    expect(typeof ImageGeneratorBlock.inputs).toBe('object')
    expect(typeof ImageGeneratorBlock.outputs).toBe('object')
  })

  it('has type matching filename (image_generator)', () => {
    expect(ImageGeneratorBlock.type).toBe('image_generator')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(ImageGeneratorBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of ImageGeneratorBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(ImageGeneratorBlock.tools.access)).toBe(true)
    if (ImageGeneratorBlock.tools.config) {
      expect(typeof ImageGeneratorBlock.tools.config.tool).toBe('function')
    }
  })

  it('has an apiKey subBlock', () => {
    const apiKey = ImageGeneratorBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
  })
})
