import { describe, expect, it, vi } from 'vitest'
import { SupabaseBlock } from '../supabase'

vi.mock('@/components/icons', () => ({ SupabaseIcon: () => null }))

describe('SupabaseBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SupabaseBlock).toBeDefined()
    expect(typeof SupabaseBlock).toBe('object')
    expect(typeof SupabaseBlock.type).toBe('string')
    expect(typeof SupabaseBlock.name).toBe('string')
    expect(typeof SupabaseBlock.description).toBe('string')
    expect(typeof SupabaseBlock.category).toBe('string')
    expect(typeof SupabaseBlock.bgColor).toBe('string')
    expect(SupabaseBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(SupabaseBlock.icon).toBeDefined()
    expect(Array.isArray(SupabaseBlock.subBlocks)).toBe(true)
    expect(SupabaseBlock.tools).toBeDefined()
    expect(typeof SupabaseBlock.inputs).toBe('object')
    expect(typeof SupabaseBlock.outputs).toBe('object')
  })

  it('has type matching filename (supabase)', () => {
    expect(SupabaseBlock.type).toBe('supabase')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(SupabaseBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of SupabaseBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(SupabaseBlock.tools.access)).toBe(true)
    if (SupabaseBlock.tools.config) {
      expect(typeof SupabaseBlock.tools.config.tool).toBe('function')
    }
  })
})
