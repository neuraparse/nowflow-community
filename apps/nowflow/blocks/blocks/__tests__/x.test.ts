import { describe, expect, it, vi } from 'vitest'
import { XBlock } from '../x'

vi.mock('@/components/icons', () => ({ xIcon: () => null }))

describe('XBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(XBlock.type).toBe('x')
    expect(XBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it('access list contains all four x_* tools', () => {
    expect(XBlock.tools.access).toEqual(
      expect.arrayContaining(['x_write', 'x_read', 'x_search', 'x_user'])
    )
  })

  describe('tool dispatcher', () => {
    const tool = XBlock.tools.config!.tool

    it('returns x_write for x_write op', () => {
      expect(tool({ operation: 'x_write' })).toBe('x_write')
    })
    it('returns x_search for x_search op', () => {
      expect(tool({ operation: 'x_search' })).toBe('x_search')
    })
    it('returns x_user for x_user op', () => {
      expect(tool({ operation: 'x_user' })).toBe('x_user')
    })
    it('falls back to x_write on unknown op', () => {
      expect(tool({ operation: 'huh' })).toBe('x_write')
    })
  })

  describe('params transformer', () => {
    const params = XBlock.tools.config!.params!

    it('parses string boolean values', () => {
      const result = params({ credential: 'c', operation: 'x_read', includeReplies: 'true' })
      expect(result.includeReplies).toBe(true)
    })

    it('parses maxResults number', () => {
      const result = params({ credential: 'c', operation: 'x_search', maxResults: '20' })
      expect(result.maxResults).toBe(20)
    })

    it('splits comma-separated mediaIds into array', () => {
      const result = params({
        credential: 'c',
        operation: 'x_write',
        mediaIds: 'm1, m2 ,m3',
      })
      expect(result.mediaIds).toEqual(['m1', 'm2', 'm3'])
    })
  })
})
