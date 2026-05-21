import { describe, expect, it, vi } from 'vitest'
import { MailgunBlock } from '../mailgun'

vi.mock('@/components/icons', () => ({ MailgunIcon: () => null }))

describe('MailgunBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(MailgunBlock).toBeDefined()
    expect(typeof MailgunBlock.type).toBe('string')
    expect(typeof MailgunBlock.name).toBe('string')
    expect(MailgunBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(MailgunBlock.subBlocks)).toBe(true)
    expect(MailgunBlock.tools).toBeDefined()
  })

  it('has type matching filename (mailgun)', () => {
    expect(MailgunBlock.type).toBe('mailgun')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(MailgunBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of MailgunBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(typeof sub.type).toBe('string')
    }
  })

  it('exposes mailgun_api in tools.access', () => {
    expect(Array.isArray(MailgunBlock.tools.access)).toBe(true)
    expect(MailgunBlock.tools.access).toContain('mailgun_api')
  })

  it('tool selector returns mailgun_api for any operation', () => {
    const tool = MailgunBlock.tools.config!.tool
    expect(tool({ operation: 'send_email' })).toBe('mailgun_api')
    expect(tool({ operation: 'validate_email' })).toBe('mailgun_api')
    expect(tool({ operation: 'list_events' })).toBe('mailgun_api')
    expect(tool({})).toBe('mailgun_api')
  })

  it('declares credential as a password subBlock', () => {
    const credential = MailgunBlock.subBlocks.find((s) => s.id === 'credential')
    expect(credential).toBeDefined()
    expect((credential as any).password).toBe(true)
  })

  it('exposes region dropdown with US default', () => {
    const region = MailgunBlock.subBlocks.find((s) => s.id === 'region') as any
    expect(region).toBeDefined()
    expect(region.type).toBe('dropdown')
    expect(typeof region.value).toBe('function')
    expect(region.value()).toBe('US')
  })
})
