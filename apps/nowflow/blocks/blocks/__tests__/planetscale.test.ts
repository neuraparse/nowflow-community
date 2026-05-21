import { describe, expect, it, vi } from 'vitest'
import { PlanetScaleBlock } from '../planetscale'

vi.mock('@/components/icons', () => ({ PlanetScaleIcon: () => null }))

describe('PlanetScaleBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(PlanetScaleBlock).toBeDefined()
    expect(typeof PlanetScaleBlock.type).toBe('string')
    expect(typeof PlanetScaleBlock.name).toBe('string')
    expect(PlanetScaleBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(PlanetScaleBlock.subBlocks)).toBe(true)
    expect(PlanetScaleBlock.tools).toBeDefined()
  })

  it('has type matching filename (planetscale)', () => {
    expect(PlanetScaleBlock.type).toBe('planetscale')
  })

  it('exposes planetscale_api in tools.access', () => {
    expect(Array.isArray(PlanetScaleBlock.tools.access)).toBe(true)
    expect(PlanetScaleBlock.tools.access).toContain('planetscale_api')
  })

  it('tool selector returns planetscale_api regardless of operation', () => {
    const tool = PlanetScaleBlock.tools.config!.tool
    expect(tool({ operation: 'list_databases' })).toBe('planetscale_api')
    expect(tool({ operation: 'create_branch' })).toBe('planetscale_api')
    expect(tool({})).toBe('planetscale_api')
  })

  it('passes params through unchanged via params transformer', () => {
    const params = PlanetScaleBlock.tools.config!.params!
    const input = { operation: 'create_branch', database: 'db1', branchName: 'feat-x' }
    expect(params(input)).toEqual(input)
  })

  it('uses oauth-input for credential subBlock', () => {
    const credential = PlanetScaleBlock.subBlocks.find((s) => s.id === 'credential') as any
    expect(credential).toBeDefined()
    expect(credential.type).toBe('oauth-input')
    expect(credential.provider).toBe('planetscale')
  })
})
