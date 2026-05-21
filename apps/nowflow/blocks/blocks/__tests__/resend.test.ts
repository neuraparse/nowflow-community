import { describe, expect, it, vi } from 'vitest'
import { ResendBlock } from '../resend'

vi.mock('@/components/icons', () => ({ ResendIcon: () => null }))

describe('ResendBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ResendBlock).toBeDefined()
    expect(typeof ResendBlock.type).toBe('string')
    expect(typeof ResendBlock.name).toBe('string')
    expect(ResendBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(ResendBlock.subBlocks)).toBe(true)
    expect(ResendBlock.tools).toBeDefined()
  })

  it('has type matching filename (resend)', () => {
    expect(ResendBlock.type).toBe('resend')
  })

  it('exposes resend_api in tools.access', () => {
    expect(ResendBlock.tools.access).toContain('resend_api')
  })

  it('tool selector returns resend_api regardless of operation', () => {
    const tool = ResendBlock.tools.config!.tool
    expect(tool({ operation: 'send_email' })).toBe('resend_api')
    expect(tool({ operation: 'list_domains' })).toBe('resend_api')
    expect(tool({ operation: 'create_api_key' })).toBe('resend_api')
    expect(tool({})).toBe('resend_api')
  })
})
