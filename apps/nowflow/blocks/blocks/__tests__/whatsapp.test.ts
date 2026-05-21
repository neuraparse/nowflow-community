import { describe, expect, it, vi } from 'vitest'
import { WhatsAppBlock } from '../whatsapp'

vi.mock('@/components/icons', () => ({ WhatsAppIcon: () => null }))

describe('WhatsAppBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(WhatsAppBlock.type).toBe('whatsapp')
    expect(WhatsAppBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it('access list contains both whatsapp tools', () => {
    expect(WhatsAppBlock.tools.access).toEqual(
      expect.arrayContaining(['whatsapp_send_message', 'whatsapp_list_phone_numbers'])
    )
  })

  describe('tool dispatcher', () => {
    const tool = WhatsAppBlock.tools.config!.tool

    it('returns list tool for list_phone_numbers action', () => {
      expect(tool({ action: 'list_phone_numbers' })).toBe('whatsapp_list_phone_numbers')
    })

    it('returns send tool for send_message action', () => {
      expect(tool({ action: 'send_message' })).toBe('whatsapp_send_message')
    })

    it('falls back to send for unknown action', () => {
      expect(tool({ action: 'unknown' })).toBe('whatsapp_send_message')
    })
  })

  describe('params transformer', () => {
    const params = WhatsAppBlock.tools.config!.params!

    it('extracts accessToken from credential for list', () => {
      const result = params({
        action: 'list_phone_numbers',
        credential: { accessToken: 'tok123' },
        businessAccountId: ' wa-id ',
      })
      expect(result.accessToken).toBe('tok123')
      expect(result.businessAccountId).toBe('wa-id')
    })

    it('builds send payload with phone, message, phoneNumberId, accessToken', () => {
      const result = params({
        action: 'send_message',
        credential: { accessToken: 'tok' },
        phoneNumber: '+1234',
        message: 'hi',
        phoneNumberId: 'pid',
      })
      expect(result).toEqual({
        phoneNumber: '+1234',
        message: 'hi',
        phoneNumberId: 'pid',
        accessToken: 'tok',
      })
    })
  })
})
