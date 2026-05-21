import { describe, expect, it, vi } from 'vitest'
import { TextProcessorBlock } from '../text_processor'

vi.mock('@/components/icons', () => ({ FileTextIcon: () => null }))

describe('TextProcessorBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(TextProcessorBlock.type).toBe('text_processor')
    expect(TextProcessorBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(TextProcessorBlock.isUtility).toBe(true)
    expect(TextProcessorBlock.category).toBe('blocks')
  })

  it('exposes text_processor tool access (passthrough)', () => {
    expect(TextProcessorBlock.tools.access).toContain('text_processor')
    expect(TextProcessorBlock.tools.config!.tool({})).toBe('text_processor')
  })

  it('operation dropdown includes regex and extract options', () => {
    const op = TextProcessorBlock.subBlocks.find((s) => s.id === 'operation') as any
    const ids = op.options.map((o: any) => o.id)
    expect(ids).toEqual(expect.arrayContaining(['regex_match', 'regex_replace', 'extract_emails']))
  })

  it('caseTransform dropdown includes camel/snake/kebab', () => {
    const ct = TextProcessorBlock.subBlocks.find((s) => s.id === 'caseTransform') as any
    const ids = ct.options.map((o: any) => o.id)
    expect(ids).toEqual(expect.arrayContaining(['camel', 'snake', 'kebab']))
  })

  it('params transformer is identity', () => {
    const params = TextProcessorBlock.tools.config!.params!
    const input = { inputText: 'a', operation: 'clean' }
    expect(params(input)).toBe(input)
  })
})
