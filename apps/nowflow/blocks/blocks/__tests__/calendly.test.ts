import { describe, expect, it, vi } from 'vitest'
import { CalendlyBlock } from '../calendly'

vi.mock('@/components/icons', () => ({ CalendlyIcon: () => null }))

describe('CalendlyBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(CalendlyBlock).toBeDefined()
    expect(typeof CalendlyBlock.type).toBe('string')
    expect(CalendlyBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(CalendlyBlock.subBlocks)).toBe(true)
    expect(CalendlyBlock.tools).toBeDefined()
  })

  it('has type calendly', () => {
    expect(CalendlyBlock.type).toBe('calendly')
  })

  it('has subBlocks where every entry has id and type', () => {
    for (const sub of CalendlyBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(typeof sub.type).toBe('string')
    }
  })

  it('exposes calendly_events tool access', () => {
    expect(CalendlyBlock.tools.access).toContain('calendly_events')
    expect(CalendlyBlock.tools.config!.tool({})).toBe('calendly_events')
  })

  it('exposes operation dropdown with all 5 operations', () => {
    const op = CalendlyBlock.subBlocks.find((s) => s.id === 'operation') as any
    expect(op).toBeDefined()
    expect(op.type).toBe('dropdown')
    const ids = op.options.map((o: any) => o.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'get_user',
        'list_event_types',
        'list_scheduled_events',
        'get_event',
        'cancel_event',
      ])
    )
  })

  it('marks accessToken as password', () => {
    const tok = CalendlyBlock.subBlocks.find((s) => s.id === 'accessToken') as any
    expect(tok).toBeDefined()
    expect(tok.password).toBe(true)
  })
})
