import { describe, expect, it } from 'vitest'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createSimpleToolConfig,
  defineBlock,
} from './helpers'

describe('createOAuthSubBlock', () => {
  it('returns a fully populated oauth-input SubBlock with defaults', () => {
    const result = createOAuthSubBlock({
      provider: 'stripe',
      serviceId: 'stripe',
      requiredScopes: ['read_write'],
    })

    expect(result).toEqual({
      id: 'credential',
      title: 'Stripe Account',
      type: 'oauth-input',
      layout: 'full',
      provider: 'stripe',
      serviceId: 'stripe',
      requiredScopes: ['read_write'],
      placeholder: 'Select stripe account',
    })
  })

  it('honors id, title, layout, and placeholder overrides', () => {
    const result = createOAuthSubBlock({
      id: 'auth',
      provider: 'google-email',
      serviceId: 'gmail',
      requiredScopes: ['scope.a', 'scope.b'],
      title: 'Gmail Account',
      layout: 'half',
      placeholder: 'Pick one',
    })

    expect(result.id).toBe('auth')
    expect(result.title).toBe('Gmail Account')
    expect(result.layout).toBe('half')
    expect(result.placeholder).toBe('Pick one')
    expect(result.requiredScopes).toEqual(['scope.a', 'scope.b'])
  })
})

describe('createOperationDropdown', () => {
  it('returns a dropdown SubBlock preserving option order', () => {
    const result = createOperationDropdown({
      operations: [
        { id: 'list', label: 'List' },
        { id: 'get', label: 'Get', description: 'Fetch one' },
        { id: 'create', label: 'Create' },
      ],
    })

    expect(result.id).toBe('operation')
    expect(result.title).toBe('Operation')
    expect(result.type).toBe('dropdown')
    expect(result.layout).toBe('full')
    expect(result.options).toEqual([
      { id: 'list', label: 'List' },
      { id: 'get', label: 'Get', description: 'Fetch one' },
      { id: 'create', label: 'Create' },
    ])
  })

  it('applies id, title, and layout overrides', () => {
    const result = createOperationDropdown({
      id: 'op',
      title: 'Action',
      layout: 'half',
      operations: [{ id: 'a', label: 'A' }],
    })

    expect(result.id).toBe('op')
    expect(result.title).toBe('Action')
    expect(result.layout).toBe('half')
  })

  it('sets a value() default when defaultValue is provided', () => {
    const result = createOperationDropdown({
      operations: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      defaultValue: 'b',
    })

    expect(typeof result.value).toBe('function')
    expect(result.value!({})).toBe('b')
  })

  it('omits value() when no defaultValue is provided', () => {
    const result = createOperationDropdown({
      operations: [{ id: 'a', label: 'A' }],
    })

    expect(result.value).toBeUndefined()
  })
})

describe('defineBlock', () => {
  it('returns the same object reference it was given', () => {
    const block = {
      type: 'x',
      name: 'X',
      description: 'x',
      category: 'tools' as const,
      bgColor: '#000',
      icon: (() => null) as any,
      subBlocks: [],
      tools: { access: ['x'] },
      inputs: {},
      outputs: { response: { type: 'json' as const } },
    }
    expect(defineBlock(block)).toBe(block)
  })
})

describe('createSimpleToolConfig', () => {
  it('returns a config whose tool() yields the id and params() is identity', () => {
    const cfg = createSimpleToolConfig('foo_bar')
    expect(cfg.tool()).toBe('foo_bar')
    const sample = { a: 1, b: 'two' }
    expect(cfg.params(sample)).toBe(sample)
  })
})
