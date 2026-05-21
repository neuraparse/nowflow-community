import { describe, expect, it, vi } from 'vitest'
import { PaddleBlock } from '../paddle'

vi.mock('@/components/icons', () => ({ PaddleIcon: () => null }))

describe('PaddleBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(PaddleBlock).toBeDefined()
    expect(typeof PaddleBlock.type).toBe('string')
    expect(typeof PaddleBlock.name).toBe('string')
    expect(PaddleBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(PaddleBlock.subBlocks)).toBe(true)
    expect(PaddleBlock.tools).toBeDefined()
  })

  it('has type matching filename (paddle)', () => {
    expect(PaddleBlock.type).toBe('paddle')
  })

  it('exposes paddle_api in tools.access', () => {
    expect(PaddleBlock.tools.access).toContain('paddle_api')
  })

  it('tool selector returns paddle_api regardless of operation', () => {
    const tool = PaddleBlock.tools.config!.tool
    expect(tool({ operation: 'list_products' })).toBe('paddle_api')
    expect(tool({ operation: 'cancel_subscription' })).toBe('paddle_api')
    expect(tool({})).toBe('paddle_api')
  })

  it('exposes operation dropdown with subscription operations', () => {
    const op = PaddleBlock.subBlocks.find((s) => s.id === 'operation') as any
    expect(op).toBeDefined()
    const ids = op.options.map((o: any) => o.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'list_products',
        'list_subscriptions',
        'update_subscription',
        'cancel_subscription',
        'list_transactions',
      ])
    )
  })
})
