import { describe, expect, it, vi } from 'vitest'
import { NeonBlock } from '../neon'

vi.mock('@/components/icons', () => ({ NeonIcon: () => null }))

describe('NeonBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(NeonBlock).toBeDefined()
    expect(typeof NeonBlock.type).toBe('string')
    expect(typeof NeonBlock.name).toBe('string')
    expect(NeonBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(NeonBlock.subBlocks)).toBe(true)
    expect(NeonBlock.tools).toBeDefined()
  })

  it('has type matching filename (neon)', () => {
    expect(NeonBlock.type).toBe('neon')
  })

  it('exposes neon_api in tools.access', () => {
    expect(NeonBlock.tools.access).toContain('neon_api')
  })

  it('tool selector returns neon_api regardless of operation', () => {
    const tool = NeonBlock.tools.config!.tool
    expect(tool({ operation: 'list_projects' })).toBe('neon_api')
    expect(tool({ operation: 'create_branch' })).toBe('neon_api')
    expect(tool({})).toBe('neon_api')
  })

  it('exposes operation dropdown with branching operations', () => {
    const op = NeonBlock.subBlocks.find((s) => s.id === 'operation') as any
    expect(op).toBeDefined()
    const ids = op.options.map((o: any) => o.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'list_projects',
        'create_project',
        'list_branches',
        'create_branch',
        'get_connection_string',
      ])
    )
  })
})
