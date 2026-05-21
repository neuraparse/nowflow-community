import { describe, expect, it, vi } from 'vitest'
import { SharePointBlock } from '../sharepoint'

vi.mock('@/components/icons', () => ({ SharePointIcon: () => null }))

describe('SharePointBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SharePointBlock).toBeDefined()
    expect(typeof SharePointBlock.type).toBe('string')
    expect(typeof SharePointBlock.name).toBe('string')
    expect(SharePointBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(SharePointBlock.subBlocks)).toBe(true)
    expect(SharePointBlock.tools).toBeDefined()
  })

  it('has type matching filename (sharepoint)', () => {
    expect(SharePointBlock.type).toBe('sharepoint')
  })

  it('exposes sharepoint_lists in tools.access', () => {
    expect(SharePointBlock.tools.access).toContain('sharepoint_lists')
  })

  it('tool selector returns sharepoint_lists', () => {
    const tool = SharePointBlock.tools.config!.tool
    expect(tool({ operation: 'list_lists' })).toBe('sharepoint_lists')
    expect(tool({ operation: 'create_item' })).toBe('sharepoint_lists')
    expect(tool({})).toBe('sharepoint_lists')
  })

  it('params transformer remaps credential to accessToken', () => {
    const paramsFn = SharePointBlock.tools.config!.params!
    const out = paramsFn({
      credential: 'graph-token',
      operation: 'list_items',
      siteId: 'site-1',
      listId: 'list-1',
    })
    expect(out.accessToken).toBe('graph-token')
  })

  it('params transformer parses fields JSON string', () => {
    const paramsFn = SharePointBlock.tools.config!.params!
    const out = paramsFn({
      credential: 't',
      operation: 'create_item',
      siteId: 's',
      fields: '{"Title": "Hi"}',
    })
    expect(out.fields).toEqual({ Title: 'Hi' })
  })

  it('params transformer leaves invalid fields JSON as undefined', () => {
    const paramsFn = SharePointBlock.tools.config!.params!
    const out = paramsFn({
      credential: 't',
      operation: 'create_item',
      siteId: 's',
      fields: 'not json',
    })
    expect(out.fields).toBeUndefined()
  })

  it('params transformer passes object fields through', () => {
    const paramsFn = SharePointBlock.tools.config!.params!
    const fields = { Title: 'Hi' }
    const out = paramsFn({ credential: 't', operation: 'create_item', siteId: 's', fields })
    expect(out.fields).toEqual(fields)
  })
})
