import { describe, expect, it, vi } from 'vitest'
import { MondayBlock } from '../monday'

vi.mock('@/components/icons', () => ({ MondayIcon: () => null }))

describe('MondayBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(MondayBlock).toBeDefined()
    expect(typeof MondayBlock.type).toBe('string')
    expect(typeof MondayBlock.name).toBe('string')
    expect(MondayBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(MondayBlock.subBlocks)).toBe(true)
    expect(MondayBlock.tools).toBeDefined()
  })

  it('has type matching filename (monday)', () => {
    expect(MondayBlock.type).toBe('monday')
  })

  it('exposes monday_items in tools.access', () => {
    expect(MondayBlock.tools.access).toContain('monday_items')
  })

  it('tool selector returns monday_items', () => {
    const tool = MondayBlock.tools.config!.tool
    expect(tool({ operation: 'list' })).toBe('monday_items')
    expect(tool({})).toBe('monday_items')
  })

  it('params transformer parses JSON data string', () => {
    const paramsFn = MondayBlock.tools.config!.params!
    const out = paramsFn({
      token: 't',
      operation: 'create',
      boardId: 'b',
      data: '{"name": "Item 1"}',
    })
    expect(out.data).toEqual({ name: 'Item 1' })
  })

  it('params transformer leaves invalid JSON data as undefined', () => {
    const paramsFn = MondayBlock.tools.config!.params!
    const out = paramsFn({ token: 't', operation: 'create', data: 'not json' })
    expect(out.data).toBeUndefined()
  })

  it('params transformer passes object data through unchanged', () => {
    const paramsFn = MondayBlock.tools.config!.params!
    const data = { name: 'Hi' }
    const out = paramsFn({ token: 't', operation: 'create', data })
    expect(out.data).toEqual(data)
  })

  it('declares token as a password subBlock', () => {
    const token = MondayBlock.subBlocks.find((s) => s.id === 'token')
    expect((token as any).password).toBe(true)
  })
})
