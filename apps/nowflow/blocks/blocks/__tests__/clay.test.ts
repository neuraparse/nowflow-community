import { describe, expect, it, vi } from 'vitest'
import { ClayBlock } from '../clay'

vi.mock('@/components/icons', () => ({ ClayIcon: () => null }))

describe('ClayBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ClayBlock).toBeDefined()
    expect(typeof ClayBlock.type).toBe('string')
    expect(ClayBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(ClayBlock.subBlocks)).toBe(true)
  })

  it('has type clay', () => {
    expect(ClayBlock.type).toBe('clay')
  })

  it('exposes clay_populate tool access', () => {
    expect(ClayBlock.tools.access).toContain('clay_populate')
    expect(ClayBlock.tools.config!.tool({})).toBe('clay_populate')
  })

  it('params transformer maps inputs to authToken/webhookURL/data', () => {
    const params = ClayBlock.tools.config!.params!
    const result = params({
      authToken: 'tok',
      webhookURL: 'https://hooks.clay.com/x',
      data: '{"a":1}',
    })
    expect(result.authToken).toBe('tok')
    expect(result.webhookURL).toBe('https://hooks.clay.com/x')
    expect(result.data).toBe('{"a":1}')
  })

  it('params transformer drops extra unmapped fields', () => {
    const params = ClayBlock.tools.config!.params!
    const result = params({
      authToken: 'tok',
      webhookURL: 'https://x',
      data: 'plain text',
      junk: 'should-not-appear',
    })
    expect(result.junk).toBeUndefined()
    expect(Object.keys(result).sort()).toEqual(['authToken', 'data', 'webhookURL'])
  })

  it('marks authToken as password and connectionDroppable=false', () => {
    const tok = ClayBlock.subBlocks.find((s) => s.id === 'authToken') as any
    expect(tok.password).toBe(true)
    expect(tok.connectionDroppable).toBe(false)
  })
})
