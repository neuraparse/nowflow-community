import { describe, expect, it, vi } from 'vitest'
import { TwilioSMSBlock } from '../twilio'

vi.mock('@/components/icons', () => ({ TwilioIcon: () => null }))

describe('TwilioSMSBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(TwilioSMSBlock).toBeDefined()
    expect(typeof TwilioSMSBlock.type).toBe('string')
    expect(typeof TwilioSMSBlock.name).toBe('string')
    expect(TwilioSMSBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(TwilioSMSBlock.subBlocks)).toBe(true)
    expect(TwilioSMSBlock.tools).toBeDefined()
  })

  it('has type twilio_sms', () => {
    expect(TwilioSMSBlock.type).toBe('twilio_sms')
  })

  it('has subBlocks where every entry has id and type', () => {
    for (const sub of TwilioSMSBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(typeof sub.type).toBe('string')
    }
  })

  it('exposes twilio_send_sms tool access', () => {
    expect(TwilioSMSBlock.tools.access).toContain('twilio_send_sms')
    expect(TwilioSMSBlock.tools.config!.tool({})).toBe('twilio_send_sms')
  })

  it('marks authToken subBlock as password', () => {
    const auth = TwilioSMSBlock.subBlocks.find((s) => s.id === 'authToken')
    expect(auth).toBeDefined()
    expect((auth as any).password).toBe(true)
  })

  it('declares phoneNumbers, message, accountSid, fromNumber as required inputs', () => {
    expect(TwilioSMSBlock.inputs!.phoneNumbers.required).toBe(true)
    expect(TwilioSMSBlock.inputs!.message.required).toBe(true)
    expect(TwilioSMSBlock.inputs!.accountSid.required).toBe(true)
    expect(TwilioSMSBlock.inputs!.fromNumber.required).toBe(true)
  })
})
