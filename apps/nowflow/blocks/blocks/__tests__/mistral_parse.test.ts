import { describe, expect, it, vi } from 'vitest'
import { MistralParseBlock } from '../mistral_parse'

vi.mock('@/components/icons', () => ({ MistralIcon: () => null }))

describe('MistralParseBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(MistralParseBlock).toBeDefined()
    expect(MistralParseBlock.type).toBe('mistral_parse')
    expect(MistralParseBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(MistralParseBlock.subBlocks)).toBe(true)
  })

  it('exposes mistral_parser tool access', () => {
    expect(MistralParseBlock.tools.access).toContain('mistral_parser')
    expect(MistralParseBlock.tools.config!.tool({})).toBe('mistral_parser')
  })

  describe('params transformer', () => {
    const params = MistralParseBlock.tools.config!.params!

    it('throws when apiKey is missing or empty', () => {
      expect(() => params({})).toThrow(/Mistral API key/)
      expect(() => params({ apiKey: '   ' })).toThrow(/Mistral API key/)
    })

    it('throws when filePath URL is missing', () => {
      expect(() => params({ apiKey: 'k' })).toThrow(/PDF Document URL/)
    })

    it('returns parameters with trimmed apiKey and default resultType', () => {
      const result = params({ apiKey: '  abc  ', filePath: 'https://example.com/f.pdf' })
      expect(result.apiKey).toBe('abc')
      expect(result.resultType).toBe('markdown')
      expect(result.filePath).toBe('https://example.com/f.pdf')
    })

    it('parses pages CSV string into array of numbers', () => {
      const result = params({
        apiKey: 'k',
        filePath: 'https://example.com/f.pdf',
        pages: '0, 1, 2',
      })
      expect(result.pages).toEqual([0, 1, 2])
    })

    it('throws on invalid page numbers', () => {
      expect(() =>
        params({ apiKey: 'k', filePath: 'https://example.com/f.pdf', pages: 'abc' })
      ).toThrow(/Page number format/)
    })
  })
})
