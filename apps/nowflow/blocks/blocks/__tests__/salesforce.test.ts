import { describe, expect, it, vi } from 'vitest'
import { SalesforceBlock } from '../salesforce'

vi.mock('@/components/icons', () => ({ SalesforceIcon: () => null }))

describe('SalesforceBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(SalesforceBlock).toBeDefined()
    expect(typeof SalesforceBlock.type).toBe('string')
    expect(typeof SalesforceBlock.name).toBe('string')
    expect(SalesforceBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(SalesforceBlock.subBlocks)).toBe(true)
    expect(SalesforceBlock.tools).toBeDefined()
  })

  it('has type matching filename (salesforce)', () => {
    expect(SalesforceBlock.type).toBe('salesforce')
  })

  it('exposes salesforce_opportunities in tools.access', () => {
    expect(SalesforceBlock.tools.access).toContain('salesforce_opportunities')
  })

  it('tool selector returns salesforce_opportunities', () => {
    const tool = SalesforceBlock.tools.config!.tool
    expect(tool({ action: 'create' })).toBe('salesforce_opportunities')
    expect(tool({})).toBe('salesforce_opportunities')
  })

  it('params transformer coerces numeric fields', () => {
    const paramsFn = SalesforceBlock.tools.config!.params!
    const out = paramsFn({
      apiKey: 'k',
      action: 'create',
      amount: '1500',
      probability: '75',
      limit: '10',
      offset: '5',
    })
    expect(out.amount).toBe(1500)
    expect(out.probability).toBe(75)
    expect(out.limit).toBe(10)
    expect(out.offset).toBe(5)
  })

  it('params transformer parses properties JSON string', () => {
    const paramsFn = SalesforceBlock.tools.config!.params!
    const out = paramsFn({
      apiKey: 'k',
      action: 'create',
      properties: '{"CustomField__c": "value"}',
    })
    expect(out.properties).toEqual({ CustomField__c: 'value' })
    expect(out.data).toEqual({ CustomField__c: 'value' })
  })

  it('params transformer leaves invalid JSON properties as undefined', () => {
    const paramsFn = SalesforceBlock.tools.config!.params!
    const out = paramsFn({ apiKey: 'k', action: 'create', properties: '{not valid' })
    expect(out.properties).toBeUndefined()
    expect(out.data).toEqual({})
  })

  it('params transformer leaves empty numeric fields undefined', () => {
    const paramsFn = SalesforceBlock.tools.config!.params!
    const out = paramsFn({ apiKey: 'k', action: 'search', amount: '', limit: '   ' })
    expect(out.amount).toBeUndefined()
    expect(out.limit).toBeUndefined()
  })

  it('declares apiKey as a password subBlock', () => {
    const apiKey = SalesforceBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect((apiKey as any).password).toBe(true)
  })
})
