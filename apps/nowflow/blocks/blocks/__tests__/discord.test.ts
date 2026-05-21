import { describe, expect, it, vi } from 'vitest'
import { DiscordBlock } from '../discord'

vi.mock('@/components/icons', () => ({ DiscordIcon: () => null }))

describe('DiscordBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(DiscordBlock.type).toBe('discord')
    expect(DiscordBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(DiscordBlock.subBlocks)).toBe(true)
  })

  it('exposes discord_messages tool access', () => {
    expect(DiscordBlock.tools.access).toContain('discord_messages')
    expect(DiscordBlock.tools.config!.tool({})).toBe('discord_messages')
  })

  describe('params transformer', () => {
    const params = DiscordBlock.tools.config!.params!

    it('coerces tts string boolean and limit string number', () => {
      const result = params({
        botToken: 'tok',
        channelId: 'c',
        operation: 'send',
        content: 'hi',
        tts: 'true',
        limit: '50',
      })
      expect(result.tts).toBe(true)
      expect(result.limit).toBe(50)
    })

    it('returns undefined limit on empty string', () => {
      const result = params({ botToken: 't', channelId: 'c', operation: 'list', limit: '' })
      expect(result.limit).toBeUndefined()
    })

    it('forwards before/after IDs unchanged', () => {
      const result = params({
        botToken: 't',
        channelId: 'c',
        operation: 'list',
        before: 'b1',
        after: 'a1',
      })
      expect(result.before).toBe('b1')
      expect(result.after).toBe('a1')
    })
  })
})
