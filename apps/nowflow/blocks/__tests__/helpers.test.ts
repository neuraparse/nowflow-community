import { describe, expect, it } from 'vitest'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  createSimpleToolConfig,
  defineBlock,
  parseJsonSafely,
  parseJsonStrict,
  parseNumericString,
} from '../helpers'

describe('parseJsonSafely', () => {
  it('parses valid JSON strings', () => {
    expect(parseJsonSafely('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonSafely('[1,2,3]')).toEqual([1, 2, 3])
    expect(parseJsonSafely('"hello"')).toBe('hello')
  })

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonSafely('{not json}')).toBeUndefined()
    expect(parseJsonSafely('[unclosed')).toBeUndefined()
  })

  it('returns undefined for empty / whitespace strings', () => {
    expect(parseJsonSafely('')).toBeUndefined()
    expect(parseJsonSafely('   ')).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(parseJsonSafely(null)).toBeUndefined()
    expect(parseJsonSafely(undefined)).toBeUndefined()
  })

  it('passes already-parsed values through', () => {
    expect(parseJsonSafely({ a: 1 })).toEqual({ a: 1 })
    expect(parseJsonSafely([1, 2])).toEqual([1, 2])
    expect(parseJsonSafely(42)).toBe(42)
  })
})

describe('parseNumericString', () => {
  it('parses integer and float strings', () => {
    expect(parseNumericString('42')).toBe(42)
    expect(parseNumericString('3.14')).toBeCloseTo(3.14)
    expect(parseNumericString('-7')).toBe(-7)
  })

  it('passes through finite numbers unchanged', () => {
    expect(parseNumericString(42)).toBe(42)
    expect(parseNumericString(0)).toBe(0)
  })

  it('returns undefined for empty / whitespace / non-numeric strings', () => {
    expect(parseNumericString('')).toBeUndefined()
    expect(parseNumericString('   ')).toBeUndefined()
    expect(parseNumericString('abc')).toBeUndefined()
    expect(parseNumericString('12abc')).toBeUndefined()
  })

  it('returns undefined for null/undefined/non-string-number', () => {
    expect(parseNumericString(null)).toBeUndefined()
    expect(parseNumericString(undefined)).toBeUndefined()
    expect(parseNumericString(true as any)).toBeUndefined()
    expect(parseNumericString({} as any)).toBeUndefined()
  })

  it('returns undefined for NaN / Infinity', () => {
    expect(parseNumericString(Number.NaN)).toBeUndefined()
    expect(parseNumericString(Infinity)).toBeUndefined()
    expect(parseNumericString('Infinity')).toBeUndefined()
  })
})

describe('createParamTransformer', () => {
  it('coerces declared keys, leaves others untouched', () => {
    const transform = createParamTransformer({
      max_tokens: 'number',
      data: 'json',
    })
    const result = transform({
      max_tokens: '42',
      data: '{"x":1}',
      apiKey: 'sk_xxx',
      model: 'gpt-4',
    })
    expect(result).toEqual({
      max_tokens: 42,
      data: { x: 1 },
      apiKey: 'sk_xxx',
      model: 'gpt-4',
    })
  })

  it('produces undefined for invalid coerced values without throwing', () => {
    const transform = createParamTransformer({
      n: 'number',
      j: 'json',
    })
    const result = transform({ n: 'not-a-number', j: '{not json}' })
    expect(result).toEqual({ n: undefined, j: undefined })
  })

  it('omits a coerced key entirely when input is empty (returns undefined)', () => {
    const transform = createParamTransformer({ temperature: 'number' })
    expect(transform({ temperature: '' }).temperature).toBeUndefined()
  })

  it('returns a new object (does not mutate input)', () => {
    const input = { x: '1' }
    const transform = createParamTransformer({ x: 'number' })
    const out = transform(input)
    expect(out.x).toBe(1)
    expect(input.x).toBe('1') // unchanged
  })
})

describe('createOAuthSubBlock', () => {
  it('builds an oauth-input with sensible defaults', () => {
    const block = createOAuthSubBlock({
      provider: 'google',
      serviceId: 'gmail',
      requiredScopes: ['scope-a', 'scope-b'],
    })
    expect(block.id).toBe('credential')
    expect(block.type).toBe('oauth-input')
    expect(block.layout).toBe('full')
    expect(block.title).toBe('Gmail Account')
    expect(block.placeholder).toBe('Select gmail account')
    expect((block as any).provider).toBe('google')
    expect((block as any).requiredScopes).toEqual(['scope-a', 'scope-b'])
  })

  it('respects custom id / title / layout / placeholder overrides', () => {
    const block = createOAuthSubBlock({
      id: 'custom-id',
      provider: 'github',
      serviceId: 'github-repo',
      requiredScopes: ['repo'],
      title: 'GitHub Connection',
      layout: 'half',
      placeholder: 'Pick a connection',
    })
    expect(block.id).toBe('custom-id')
    expect(block.title).toBe('GitHub Connection')
    expect(block.layout).toBe('half')
    expect(block.placeholder).toBe('Pick a connection')
  })
})

describe('createOperationDropdown', () => {
  it('builds a dropdown with operation options', () => {
    const sub = createOperationDropdown({
      operations: [
        { id: 'a', label: 'Op A' },
        { id: 'b', label: 'Op B', description: 'second op' },
      ],
    })
    expect(sub.id).toBe('operation')
    expect(sub.title).toBe('Operation')
    expect(sub.type).toBe('dropdown')
    expect(sub.options).toEqual([
      { id: 'a', label: 'Op A' },
      { id: 'b', label: 'Op B', description: 'second op' },
    ])
    expect(sub.value).toBeUndefined()
  })

  it('attaches a default value resolver when provided', () => {
    const sub = createOperationDropdown({
      operations: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      defaultValue: 'b',
    })
    expect(typeof sub.value).toBe('function')
    if (typeof sub.value === 'function') {
      expect(sub.value({} as any)).toBe('b')
    }
  })
})

describe('defineBlock', () => {
  it('returns the config unchanged (identity function)', () => {
    const cfg = { type: 't', name: 'n' } as any
    expect(defineBlock(cfg)).toBe(cfg)
  })
})

describe('createSimpleToolConfig', () => {
  it('returns a tool config that resolves to the given id and passes params through', () => {
    const cfg = createSimpleToolConfig('my_tool')
    expect(cfg.tool()).toBe('my_tool')
    const inputs = { a: 1, b: 2 }
    expect(cfg.params(inputs)).toEqual(inputs)
  })
})

describe('parseJsonStrict', () => {
  it('parses valid JSON', () => {
    expect(parseJsonStrict('{"a":1}', 'data')).toEqual({ a: 1 })
    expect(parseJsonStrict('[1,2,3]', 'data')).toEqual([1, 2, 3])
  })

  it('returns undefined for null / undefined / empty / whitespace', () => {
    expect(parseJsonStrict(null, 'x')).toBeUndefined()
    expect(parseJsonStrict(undefined, 'x')).toBeUndefined()
    expect(parseJsonStrict('', 'x')).toBeUndefined()
    expect(parseJsonStrict('   ', 'x')).toBeUndefined()
  })

  it('passes already-parsed values through unchanged', () => {
    expect(parseJsonStrict({ a: 1 }, 'x')).toEqual({ a: 1 })
    expect(parseJsonStrict([1, 2], 'x')).toEqual([1, 2])
  })

  it('throws with the field name in the message on malformed JSON', () => {
    expect(() => parseJsonStrict('{not json}', 'properties')).toThrow(/Invalid JSON for properties/)
    expect(() => parseJsonStrict('[unclosed', 'data')).toThrow(/Invalid JSON for data/)
  })
})
