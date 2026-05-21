import { describe, expect, it, vi } from 'vitest'
import { HubSpotBlock } from '../hubspot'

vi.mock('@/components/icons', () => ({ HubspotIcon: () => null, HubSpotIcon: () => null }))

describe('HubSpotBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(HubSpotBlock).toBeDefined()
    expect(typeof HubSpotBlock).toBe('object')
    expect(typeof HubSpotBlock.type).toBe('string')
    expect(typeof HubSpotBlock.name).toBe('string')
    expect(typeof HubSpotBlock.description).toBe('string')
    expect(typeof HubSpotBlock.category).toBe('string')
    expect(typeof HubSpotBlock.bgColor).toBe('string')
    expect(HubSpotBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(HubSpotBlock.icon).toBeDefined()
    expect(Array.isArray(HubSpotBlock.subBlocks)).toBe(true)
    expect(HubSpotBlock.tools).toBeDefined()
    expect(typeof HubSpotBlock.inputs).toBe('object')
    expect(typeof HubSpotBlock.outputs).toBe('object')
  })

  it('has type matching filename (hubspot)', () => {
    expect(HubSpotBlock.type).toBe('hubspot')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(HubSpotBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of HubSpotBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape', () => {
    expect(Array.isArray(HubSpotBlock.tools.access)).toBe(true)
    if (HubSpotBlock.tools.config) {
      expect(typeof HubSpotBlock.tools.config.tool).toBe('function')
    }
  })
})
