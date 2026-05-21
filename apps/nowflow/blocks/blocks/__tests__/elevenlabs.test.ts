import { describe, expect, it, vi } from 'vitest'
import { ElevenLabsBlock } from '../elevenlabs'

vi.mock('@/components/icons', () => ({ ElevenLabsIcon: () => null }))

describe('ElevenLabsBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ElevenLabsBlock.type).toBe('elevenlabs')
    expect(ElevenLabsBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(ElevenLabsBlock.subBlocks)).toBe(true)
  })

  it('exposes elevenlabs_tts tool access', () => {
    expect(ElevenLabsBlock.tools.access).toContain('elevenlabs_tts')
    expect(ElevenLabsBlock.tools.config!.tool({})).toBe('elevenlabs_tts')
  })

  describe('params transformer', () => {
    const params = ElevenLabsBlock.tools.config!.params!

    it('forwards apiKey, text, voiceId and modelId', () => {
      const result = params({
        apiKey: 'k',
        text: 'hello',
        voiceId: 'v1',
        modelId: 'eleven_turbo_v2',
      })
      expect(result).toEqual({
        apiKey: 'k',
        text: 'hello',
        voiceId: 'v1',
        modelId: 'eleven_turbo_v2',
      })
    })

    it('omits modelId when missing (returns undefined)', () => {
      const result = params({ apiKey: 'k', text: 't', voiceId: 'v' })
      expect(result.modelId).toBeUndefined()
    })
  })
})
