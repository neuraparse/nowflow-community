import { describe, expect, it, vi } from 'vitest'
import { SendGridBlock } from '../sendgrid'

vi.mock('@/components/icons', () => ({ SendGridIcon: () => null }))

describe('SendGridBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SendGridBlock).toBeDefined()
    expect(typeof SendGridBlock.type).toBe('string')
    expect(typeof SendGridBlock.name).toBe('string')
    expect(typeof SendGridBlock.description).toBe('string')
    expect(typeof SendGridBlock.category).toBe('string')
    expect(SendGridBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(SendGridBlock.icon).toBeDefined()
    expect(Array.isArray(SendGridBlock.subBlocks)).toBe(true)
    expect(SendGridBlock.tools).toBeDefined()
  })

  it('has type matching filename (sendgrid)', () => {
    expect(SendGridBlock.type).toBe('sendgrid')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(SendGridBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of SendGridBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(typeof sub.type).toBe('string')
    }
  })

  it('exposes sendgrid_send in tools.access', () => {
    expect(Array.isArray(SendGridBlock.tools.access)).toBe(true)
    expect(SendGridBlock.tools.access).toContain('sendgrid_send')
  })

  it('tool selector returns sendgrid_send regardless of operation', () => {
    const tool = SendGridBlock.tools.config!.tool
    expect(tool({ operation: 'send_email' })).toBe('sendgrid_send')
    expect(tool({ operation: 'send_template' })).toBe('sendgrid_send')
    expect(tool({ operation: 'list_contacts' })).toBe('sendgrid_send')
    expect(tool({})).toBe('sendgrid_send')
  })

  it('declares apiKey as a password subBlock', () => {
    const apiKey = SendGridBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
    expect((apiKey as any).password).toBe(true)
  })
})
