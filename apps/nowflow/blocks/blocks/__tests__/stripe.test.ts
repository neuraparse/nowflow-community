import { describe, expect, it, vi } from 'vitest'
import { StripeBlock } from '../stripe'

vi.mock('@/components/icons', () => ({ StripeIcon: () => null }))

describe('StripeBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(StripeBlock).toBeDefined()
    expect(typeof StripeBlock).toBe('object')
    expect(typeof StripeBlock.type).toBe('string')
    expect(typeof StripeBlock.name).toBe('string')
    expect(typeof StripeBlock.description).toBe('string')
    expect(typeof StripeBlock.category).toBe('string')
    expect(typeof StripeBlock.bgColor).toBe('string')
    expect(StripeBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(StripeBlock.icon).toBeDefined()
    expect(Array.isArray(StripeBlock.subBlocks)).toBe(true)
    expect(StripeBlock.tools).toBeDefined()
  })

  it('has type matching filename (stripe)', () => {
    expect(StripeBlock.type).toBe('stripe')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(StripeBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of StripeBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(sub.id.length).toBeGreaterThan(0)
      expect(typeof sub.type).toBe('string')
      expect(sub.type.length).toBeGreaterThan(0)
    }
  })

  it('has a valid tools shape with stripe_payments access', () => {
    expect(Array.isArray(StripeBlock.tools.access)).toBe(true)
    expect(StripeBlock.tools.access).toContain('stripe_payments')
    expect(typeof StripeBlock.tools.config?.tool).toBe('function')
  })

  it('tool selector returns stripe_payments regardless of operation', () => {
    const tool = StripeBlock.tools.config!.tool
    expect(tool({ operation: 'create_payment_intent' })).toBe('stripe_payments')
    expect(tool({ operation: 'list_customers' })).toBe('stripe_payments')
    expect(tool({})).toBe('stripe_payments')
  })

  it('exposes operation-conditional subBlocks for payment_intent fields', () => {
    const ids = StripeBlock.subBlocks.map((s) => s.id)
    expect(ids).toContain('amount')
    expect(ids).toContain('currency')
    expect(ids).toContain('paymentIntentId')
    expect(ids).toContain('customerId')
    expect(ids).toContain('subscriptionId')
  })
})
