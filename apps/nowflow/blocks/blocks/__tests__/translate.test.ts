import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/icons', () => ({ TranslateIcon: () => null }))
vi.mock('@/lib/ai/provider-config', () => ({
  getDefaultModel: () => 'gpt-4o',
}))
vi.mock('@/providers/utils', () => ({
  getAllModelProviders: () => ({
    'gpt-4o': 'openai_chat',
    'claude-sonnet-4-6': 'anthropic_chat',
  }),
  getBaseModelProviders: () => ({ openai: {}, anthropic: {} }),
}))
vi.mock('../agent-model-helpers', () => ({
  getModelOptions: () => [{ label: 'GPT-4o', id: 'gpt-4o' }],
  getModelSubBlocks: () => [],
}))

const { TranslateBlock } = await import('../translate')

describe('TranslateBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(TranslateBlock).toBeDefined()
    expect(typeof TranslateBlock.type).toBe('string')
    expect(TranslateBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(TranslateBlock.subBlocks)).toBe(true)
  })

  it('has type translate and is utility', () => {
    expect(TranslateBlock.type).toBe('translate')
    expect(TranslateBlock.isUtility).toBe(true)
  })

  it('declares model providers in tools.access', () => {
    expect(TranslateBlock.tools.access).toEqual(
      expect.arrayContaining(['openai_chat', 'anthropic_chat', 'google_chat'])
    )
  })

  it('tool selector returns the provider for the chosen model', () => {
    const tool = TranslateBlock.tools.config!.tool
    expect(tool({ model: 'gpt-4o' })).toBe('openai_chat')
    expect(tool({ model: 'claude-sonnet-4-6' })).toBe('anthropic_chat')
  })

  it('tool selector falls back to default openai model when none chosen', () => {
    const tool = TranslateBlock.tools.config!.tool
    expect(tool({})).toBe('openai_chat')
  })

  it('tool selector throws on unknown model', () => {
    const tool = TranslateBlock.tools.config!.tool
    expect(() => tool({ model: 'nonexistent-model' })).toThrow(/Invalid model/)
  })

  it('systemPrompt subBlock is hidden and produces a translation prompt', () => {
    const sp = TranslateBlock.subBlocks.find((s) => s.id === 'systemPrompt') as any
    expect(sp).toBeDefined()
    expect(sp.hidden).toBe(true)
    const prompt = sp.value({ targetLanguage: 'Spanish' })
    expect(prompt).toContain('Spanish')
    expect(prompt).toContain('translate')
  })

  it('systemPrompt falls back to English when targetLanguage missing', () => {
    const sp = TranslateBlock.subBlocks.find((s) => s.id === 'systemPrompt') as any
    const prompt = sp.value({})
    expect(prompt).toContain('English')
  })
})
