import { describe, expect, it, vi } from 'vitest'
import { TypeformBlock } from '../typeform'

vi.mock('@/components/icons', () => ({ TypeformIcon: () => null }))

describe('TypeformBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(TypeformBlock.type).toBe('typeform')
    expect(TypeformBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it('access list contains responses, files, insights tools', () => {
    expect(TypeformBlock.tools.access).toEqual(
      expect.arrayContaining(['typeform_responses', 'typeform_files', 'typeform_insights'])
    )
  })

  describe('tool dispatcher', () => {
    const tool = TypeformBlock.tools.config!.tool

    it('routes typeform_responses', () => {
      expect(tool({ operation: 'typeform_responses' })).toBe('typeform_responses')
    })
    it('routes typeform_files', () => {
      expect(tool({ operation: 'typeform_files' })).toBe('typeform_files')
    })
    it('routes typeform_insights', () => {
      expect(tool({ operation: 'typeform_insights' })).toBe('typeform_insights')
    })
    it('defaults to responses', () => {
      expect(tool({ operation: 'something_else' })).toBe('typeform_responses')
    })
  })

  it('subBlocks include formId and apiKey', () => {
    const ids = TypeformBlock.subBlocks.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['formId', 'apiKey']))
  })
})
