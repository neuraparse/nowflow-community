import { describe, expect, it, vi } from 'vitest'
import {
  containsProperEnvVarReference,
  formatValueForCodeContext,
  isApiKeyField,
  needsCodeStringLiteral,
  normalizeBlockName,
  stringifyForCondition,
} from '@/executor/resolver-helpers'
import type { SerializedBlock } from '@/serializer/types'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const makeBlock = (
  id: string,
  params: Record<string, any> = {},
  name = 'Block'
): SerializedBlock => ({
  id: 'block-1',
  position: { x: 0, y: 0 },
  config: { tool: id, params },
  inputs: {},
  outputs: {},
  metadata: { id, name },
  enabled: true,
})

describe('normalizeBlockName', () => {
  it('lowercases and strips whitespace', () => {
    expect(normalizeBlockName('Hello World')).toBe('helloworld')
  })

  it('collapses multiple whitespace characters and tabs/newlines', () => {
    expect(normalizeBlockName('  Hello \t  World\n ')).toBe('helloworld')
  })

  it('preserves dashes, underscores, and digits', () => {
    expect(normalizeBlockName('json-processor1')).toBe('json-processor1')
    expect(normalizeBlockName('json_processor1')).toBe('json_processor1')
    expect(normalizeBlockName('JSON-Processor1')).not.toBe(normalizeBlockName('JSON_Processor1'))
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeBlockName('    ')).toBe('')
  })

  it('handles already-normalized names', () => {
    expect(normalizeBlockName('start')).toBe('start')
  })
})

describe('stringifyForCondition', () => {
  it('quotes and escapes string values', () => {
    expect(stringifyForCondition('hello')).toBe('"hello"')
  })

  it('escapes embedded quotes', () => {
    expect(stringifyForCondition('she said "hi"')).toBe('"she said \\"hi\\""')
  })

  it('escapes newlines in strings', () => {
    expect(stringifyForCondition('line1\nline2')).toBe('"line1\\nline2"')
  })

  it('returns the literal null for null values', () => {
    expect(stringifyForCondition(null)).toBe('null')
  })

  it('returns the literal undefined for undefined values', () => {
    expect(stringifyForCondition(undefined)).toBe('undefined')
  })

  it('JSON-stringifies objects', () => {
    expect(stringifyForCondition({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}')
  })

  it('JSON-stringifies arrays (objects are handled first)', () => {
    expect(stringifyForCondition([1, 2, 3])).toBe('[1,2,3]')
  })

  it('coerces numbers and booleans via String()', () => {
    expect(stringifyForCondition(42)).toBe('42')
    expect(stringifyForCondition(0)).toBe('0')
    expect(stringifyForCondition(true)).toBe('true')
    expect(stringifyForCondition(false)).toBe('false')
  })
})

describe('containsProperEnvVarReference', () => {
  it('returns false for falsy or non-string values', () => {
    expect(containsProperEnvVarReference('')).toBe(false)
    expect(containsProperEnvVarReference(null)).toBe(false)
    expect(containsProperEnvVarReference(undefined)).toBe(false)
    // @ts-expect-error testing runtime guard
    expect(containsProperEnvVarReference(123)).toBe(false)
  })

  it('detects standalone env var references', () => {
    expect(containsProperEnvVarReference('{{API_KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('  {{BASE_URL}}  ')).toBe(true)
  })

  it('rejects strings where env var is only a fragment of text', () => {
    expect(containsProperEnvVarReference('Value {{API_KEY}} embedded')).toBe(false)
    expect(containsProperEnvVarReference('prefix {{X}} suffix')).toBe(false)
  })

  it('detects Bearer auth header patterns', () => {
    expect(containsProperEnvVarReference('Bearer {{TOKEN}}')).toBe(true)
    expect(containsProperEnvVarReference('Authorization: Bearer {{TOKEN}}')).toBe(true)
    expect(containsProperEnvVarReference('Authorization: {{TOKEN}}')).toBe(true)
  })

  it('detects API key query params in URLs', () => {
    expect(containsProperEnvVarReference('https://x.com?api_key={{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('https://x.com?api-key={{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('https://x.com?apikey={{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('https://x.com?key={{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('https://x.com?token={{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('https://x.com?foo=1&api_key={{KEY}}')).toBe(true)
  })

  it('detects API key header patterns', () => {
    expect(containsProperEnvVarReference('X-API-Key: {{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('api_key: {{KEY}}')).toBe(true)
    expect(containsProperEnvVarReference('api-key: {{KEY}}')).toBe(true)
  })

  it('returns false for malformed braces', () => {
    expect(containsProperEnvVarReference('{API_KEY}')).toBe(false)
    expect(containsProperEnvVarReference('{{}}')).toBe(false)
    expect(containsProperEnvVarReference('{{nested{x}}}')).toBe(false)
  })
})

describe('isApiKeyField', () => {
  it('returns false when block is not api or agent', () => {
    const block = makeBlock('generic', { apiKey: 'secret' })
    expect(isApiKeyField(block, 'secret')).toBe(false)
  })

  it('returns true for api block with param key named apiKey', () => {
    const block = makeBlock('api', { apiKey: 'secret' })
    expect(isApiKeyField(block, 'secret')).toBe(true)
  })

  it('returns true for agent block with underscored api_key', () => {
    const block = makeBlock('agent', { api_key: 'secret' })
    expect(isApiKeyField(block, 'secret')).toBe(true)
  })

  it('returns true for params with secretKey or accessKey', () => {
    const blockA = makeBlock('api', { mySecretKey: 'x' })
    const blockB = makeBlock('api', { accessKey: 'y' })
    expect(isApiKeyField(blockA, 'x')).toBe(true)
    expect(isApiKeyField(blockB, 'y')).toBe(true)
  })

  it('returns true for params containing token in name', () => {
    const block = makeBlock('api', { authToken: 'abc' })
    expect(isApiKeyField(block, 'abc')).toBe(true)
  })

  it('returns false when matching value is under a non-key param name', () => {
    const block = makeBlock('api', { url: 'secret' })
    expect(isApiKeyField(block, 'secret')).toBe(false)
  })

  it('returns false when value does not match any param', () => {
    const block = makeBlock('api', { apiKey: 'secret' })
    expect(isApiKeyField(block, 'other')).toBe(false)
  })

  it('returns false when metadata is missing', () => {
    const block: SerializedBlock = {
      id: 'b',
      position: { x: 0, y: 0 },
      config: { tool: 'api', params: { apiKey: 'secret' } },
      inputs: {},
      outputs: {},
      enabled: true,
    }
    expect(isApiKeyField(block, 'secret')).toBe(false)
  })
})

describe('formatValueForCodeContext', () => {
  const functionBlock = makeBlock('function')
  const apiBlock = makeBlock('api')

  describe('function blocks (non-template literal)', () => {
    it('JSON-stringifies string values so they become quoted JS literals', () => {
      expect(formatValueForCodeContext('hello', functionBlock)).toBe('"hello"')
    })

    it('escapes quotes in strings', () => {
      expect(formatValueForCodeContext('he said "hi"', functionBlock)).toBe('"he said \\"hi\\""')
    })

    it('JSON-stringifies objects and arrays', () => {
      expect(formatValueForCodeContext({ a: 1 }, functionBlock)).toBe('{"a":1}')
      expect(formatValueForCodeContext([1, 2], functionBlock)).toBe('[1,2]')
    })

    it('returns literal undefined for undefined values', () => {
      expect(formatValueForCodeContext(undefined, functionBlock)).toBe('undefined')
    })

    it('returns literal null for null values', () => {
      expect(formatValueForCodeContext(null, functionBlock)).toBe('null')
    })

    it('passes numbers and booleans through as strings', () => {
      expect(formatValueForCodeContext(42, functionBlock)).toBe('42')
      expect(formatValueForCodeContext(true, functionBlock)).toBe('true')
      expect(formatValueForCodeContext(false, functionBlock)).toBe('false')
    })
  })

  describe('function blocks (template literal)', () => {
    it('does not quote strings inside template literals', () => {
      expect(formatValueForCodeContext('hello', functionBlock, true)).toBe('hello')
    })

    it('JSON-stringifies objects even in template literals', () => {
      expect(formatValueForCodeContext({ a: 1 }, functionBlock, true)).toBe('{"a":1}')
    })

    it('falls through to String() for non-string non-object values', () => {
      expect(formatValueForCodeContext(42, functionBlock, true)).toBe('42')
      expect(formatValueForCodeContext(null, functionBlock, true)).toBe('null')
      expect(formatValueForCodeContext(undefined, functionBlock, true)).toBe('undefined')
      expect(formatValueForCodeContext(true, functionBlock, true)).toBe('true')
    })
  })

  describe('non-code blocks', () => {
    it('JSON-stringifies objects', () => {
      expect(formatValueForCodeContext({ a: 1 }, apiBlock)).toBe('{"a":1}')
    })

    it('converts primitives via String()', () => {
      expect(formatValueForCodeContext('hello', apiBlock)).toBe('hello')
      expect(formatValueForCodeContext(42, apiBlock)).toBe('42')
      expect(formatValueForCodeContext(true, apiBlock)).toBe('true')
    })

    it('handles null as the string "null" (String(null))', () => {
      expect(formatValueForCodeContext(null, apiBlock)).toBe('null')
    })
  })
})

describe('needsCodeStringLiteral', () => {
  it('returns false when block is undefined', () => {
    expect(needsCodeStringLiteral(undefined, 'anything')).toBe(false)
  })

  it('returns true for function blocks regardless of expression', () => {
    expect(needsCodeStringLiteral(makeBlock('function'))).toBe(true)
    expect(needsCodeStringLiteral(makeBlock('function'), 'return x')).toBe(true)
  })

  it('returns false for condition blocks without an expression', () => {
    expect(needsCodeStringLiteral(makeBlock('condition'))).toBe(false)
  })

  it('returns true for condition blocks with an expression', () => {
    expect(needsCodeStringLiteral(makeBlock('condition'), '<x> === 1')).toBe(true)
  })

  it('returns false for non-code blocks without a suspicious expression', () => {
    expect(needsCodeStringLiteral(makeBlock('generic'))).toBe(false)
    expect(needsCodeStringLiteral(makeBlock('generic'), 'just text')).toBe(false)
  })

  it('detects code-like expressions in non-code blocks', () => {
    const block = makeBlock('generic')
    expect(needsCodeStringLiteral(block, 'foo.bar(')).toBe(true)
    expect(needsCodeStringLiteral(block, 'a === b')).toBe(true)
    expect(needsCodeStringLiteral(block, 'if (x) { return 1 }')).toBe(true)
    expect(needsCodeStringLiteral(block, 'def my_func():')).toBe(true)
    expect(needsCodeStringLiteral(block, 'console.log(1)')).toBe(true)
    expect(needsCodeStringLiteral(block, 'print(1)')).toBe(true)
    expect(needsCodeStringLiteral(block, '`hello ${name}`')).toBe(true)
  })
})
