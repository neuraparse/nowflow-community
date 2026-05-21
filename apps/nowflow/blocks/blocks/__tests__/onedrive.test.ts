import { describe, expect, it, vi } from 'vitest'
import { OneDriveBlock } from '../onedrive'

vi.mock('@/components/icons', () => ({ OneDriveIcon: () => null }))

describe('OneDriveBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(OneDriveBlock).toBeDefined()
    expect(typeof OneDriveBlock.type).toBe('string')
    expect(typeof OneDriveBlock.name).toBe('string')
    expect(OneDriveBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(OneDriveBlock.subBlocks)).toBe(true)
    expect(OneDriveBlock.tools).toBeDefined()
  })

  it('has type matching filename (onedrive)', () => {
    expect(OneDriveBlock.type).toBe('onedrive')
  })

  it('exposes onedrive_files in tools.access', () => {
    expect(OneDriveBlock.tools.access).toContain('onedrive_files')
  })

  it('tool selector returns onedrive_files', () => {
    const tool = OneDriveBlock.tools.config!.tool
    expect(tool({ operation: 'list' })).toBe('onedrive_files')
    expect(tool({ operation: 'upload' })).toBe('onedrive_files')
    expect(tool({})).toBe('onedrive_files')
  })

  it('params transformer remaps credential to accessToken', () => {
    const paramsFn = OneDriveBlock.tools.config!.params!
    const out = paramsFn({
      credential: 'oauth-token-xyz',
      operation: 'list',
      driveId: 'd1',
    })
    expect(out.accessToken).toBe('oauth-token-xyz')
    expect((out as any).credential).toBeUndefined()
  })

  it('params transformer preserves operation/path/contents fields', () => {
    const paramsFn = OneDriveBlock.tools.config!.params!
    const out = paramsFn({
      credential: 't',
      operation: 'upload',
      path: '/Documents/x.txt',
      contents: 'hello',
      contentType: 'text/plain',
    })
    expect(out.operation).toBe('upload')
    expect(out.path).toBe('/Documents/x.txt')
    expect(out.contents).toBe('hello')
    expect(out.contentType).toBe('text/plain')
  })
})
