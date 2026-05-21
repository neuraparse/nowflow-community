import { describe, expect, it, vi } from 'vitest'
import { ShopifyBlock } from '../shopify'

vi.mock('@/components/icons', () => ({ ShopifyIcon: () => null }))

describe('ShopifyBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(ShopifyBlock).toBeDefined()
    expect(typeof ShopifyBlock.type).toBe('string')
    expect(typeof ShopifyBlock.name).toBe('string')
    expect(ShopifyBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(ShopifyBlock.subBlocks)).toBe(true)
    expect(ShopifyBlock.tools).toBeDefined()
  })

  it('has type matching filename (shopify)', () => {
    expect(ShopifyBlock.type).toBe('shopify')
  })

  it('exposes shopify_orders in tools.access', () => {
    expect(ShopifyBlock.tools.access).toContain('shopify_orders')
  })

  it('tool selector returns shopify_orders', () => {
    const tool = ShopifyBlock.tools.config!.tool
    expect(tool({ operation: 'list' })).toBe('shopify_orders')
    expect(tool({ operation: 'create' })).toBe('shopify_orders')
    expect(tool({})).toBe('shopify_orders')
  })

  it('params transformer coerces limit to number', () => {
    const paramsFn = ShopifyBlock.tools.config!.params!
    const out = paramsFn({
      shopDomain: 's.myshopify.com',
      accessToken: 't',
      operation: 'list',
      limit: '50',
    })
    expect(out.limit).toBe(50)
  })

  it('params transformer parses JSON data', () => {
    const paramsFn = ShopifyBlock.tools.config!.params!
    const out = paramsFn({
      shopDomain: 's.myshopify.com',
      accessToken: 't',
      operation: 'create',
      data: '{"email": "x@y.com"}',
    })
    expect(out.data).toEqual({ email: 'x@y.com' })
  })

  it('params transformer leaves invalid JSON data as undefined', () => {
    const paramsFn = ShopifyBlock.tools.config!.params!
    const out = paramsFn({
      shopDomain: 's.myshopify.com',
      accessToken: 't',
      operation: 'create',
      data: '{bad',
    })
    expect(out.data).toBeUndefined()
  })

  it('declares accessToken as a password subBlock', () => {
    const accessToken = ShopifyBlock.subBlocks.find((s) => s.id === 'accessToken')
    expect((accessToken as any).password).toBe(true)
  })
})
