import { describe, expect, it, vi } from 'vitest'
import { TelegramBlock } from '../telegram'

vi.mock('@/components/icons', () => ({ TelegramIcon: () => null }))

describe('TelegramBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(TelegramBlock.type).toBe('telegram')
    expect(TelegramBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(TelegramBlock.subBlocks)).toBe(true)
  })

  it('exposes telegram_message tool access', () => {
    expect(TelegramBlock.tools.access).toContain('telegram_message')
    expect(TelegramBlock.tools.config!.tool({})).toBe('telegram_message')
  })

  it('subBlocks include botToken, chatId, and text', () => {
    const ids = TelegramBlock.subBlocks.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['botToken', 'chatId', 'text']))
  })

  it('botToken subBlock is password-masked', () => {
    const tok = TelegramBlock.subBlocks.find((s) => s.id === 'botToken') as any
    expect(tok.password).toBe(true)
  })

  describe('params transformer', () => {
    const params = TelegramBlock.tools.config!.params!

    it('forwards botToken, chatId, text directly', () => {
      const result = params({ botToken: 'tok', chatId: 'cid', text: 'hello' })
      expect(result).toEqual({ botToken: 'tok', chatId: 'cid', text: 'hello' })
    })
  })
})
