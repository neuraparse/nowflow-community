import { describe, expect, it, vi } from 'vitest'
import { YouTubeBlock } from '../youtube'

vi.mock('@/components/icons', () => ({ YouTubeIcon: () => null }))

describe('YouTubeBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(YouTubeBlock).toBeDefined()
    expect(typeof YouTubeBlock.type).toBe('string')
    expect(typeof YouTubeBlock.name).toBe('string')
    expect(YouTubeBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(YouTubeBlock.subBlocks)).toBe(true)
    expect(YouTubeBlock.tools).toBeDefined()
  })

  it('has type matching filename (youtube)', () => {
    expect(YouTubeBlock.type).toBe('youtube')
  })

  it('exposes all four youtube tools in access list', () => {
    expect(YouTubeBlock.tools.access).toEqual(
      expect.arrayContaining([
        'youtube_search',
        'youtube_video_details',
        'youtube_transcript',
        'youtube_channel_info',
      ])
    )
  })

  it('tool selector dispatches based on operation', () => {
    const tool = YouTubeBlock.tools.config!.tool
    expect(tool({ operation: 'search' })).toBe('youtube_search')
    expect(tool({ operation: 'video_details' })).toBe('youtube_video_details')
    expect(tool({ operation: 'transcript' })).toBe('youtube_transcript')
    expect(tool({ operation: 'channel_info' })).toBe('youtube_channel_info')
  })

  it('tool selector defaults to youtube_search for unknown operation', () => {
    const tool = YouTubeBlock.tools.config!.tool
    expect(tool({ operation: 'unknown_op' })).toBe('youtube_search')
    expect(tool({})).toBe('youtube_search')
  })

  it('params transformer strips operation field but preserves the rest', () => {
    const paramsFn = YouTubeBlock.tools.config!.params!
    const result = paramsFn({ operation: 'search', query: 'cats', maxResults: 5 })
    expect(result).not.toHaveProperty('operation')
    expect(result.query).toBe('cats')
    expect(result.maxResults).toBe(5)
  })

  it('params transformer with empty input returns empty object', () => {
    const paramsFn = YouTubeBlock.tools.config!.params!
    expect(paramsFn({})).toEqual({})
    expect(paramsFn({ operation: 'transcript' })).toEqual({})
  })
})
