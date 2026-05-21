import { describe, expect, it, vi } from 'vitest'
import { SegmentBlock } from '../segment'

vi.mock('@/components/icons', () => ({ SegmentIcon: () => null }))

describe('SegmentBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SegmentBlock).toBeDefined()
    expect(typeof SegmentBlock.type).toBe('string')
    expect(typeof SegmentBlock.name).toBe('string')
    expect(SegmentBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(SegmentBlock.subBlocks)).toBe(true)
    expect(SegmentBlock.tools).toBeDefined()
  })

  it('has type matching filename (segment)', () => {
    expect(SegmentBlock.type).toBe('segment')
  })

  it('exposes segment_api in tools.access', () => {
    expect(SegmentBlock.tools.access).toContain('segment_api')
  })

  it('tool selector returns segment_api', () => {
    const tool = SegmentBlock.tools.config!.tool
    expect(tool({ operation: 'track_event' })).toBe('segment_api')
    expect(tool({ operation: 'identify_user' })).toBe('segment_api')
    expect(tool({})).toBe('segment_api')
  })

  it('exposes operation dropdown with cdp operations', () => {
    const op = SegmentBlock.subBlocks.find((s) => s.id === 'operation') as any
    expect(op).toBeDefined()
    const ids = op.options.map((o: any) => o.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'list_sources',
        'create_source',
        'track_event',
        'identify_user',
        'list_destinations',
      ])
    )
  })
})
