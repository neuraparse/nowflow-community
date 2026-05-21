import { describe, expect, it } from 'vitest'
import { VariableManager } from '@/lib/variables/variable-manager'

// A companion suite to the sibling `variable-manager.test.ts` — these tests
// focus on the public formatter APIs (editor / template / code contexts) and
// the display-quote helper that the sibling file does not cover in depth.

describe('VariableManager.parseInputForStorage edge cases', () => {
  it('returns empty string for null and undefined regardless of type', () => {
    expect(VariableManager.parseInputForStorage(null as any, 'string')).toBe('')
    expect(VariableManager.parseInputForStorage(undefined as any, 'number')).toBe('')
    expect(VariableManager.parseInputForStorage(undefined as any, 'boolean')).toBe('')
  })

  it('normalizes quoted number strings', () => {
    expect(VariableManager.parseInputForStorage('"42"', 'number')).toBe(42)
    expect(VariableManager.parseInputForStorage("'3.14'", 'number')).toBe(3.14)
  })

  it('handles special "invalid json" input for object and array', () => {
    expect(VariableManager.parseInputForStorage('invalid json', 'object')).toEqual({})
    expect(VariableManager.parseInputForStorage('invalid json', 'array')).toEqual([])
  })

  it('parses JSON objects and arrays', () => {
    expect(VariableManager.parseInputForStorage('{"a":1}', 'object')).toEqual({ a: 1 })
    expect(VariableManager.parseInputForStorage('[1,2,3]', 'array')).toEqual([1, 2, 3])
  })

  it('wraps non-JSON array input in a single-item array', () => {
    expect(VariableManager.parseInputForStorage('hello', 'array')).toEqual(['hello'])
  })

  it('coerces boolean strings case-insensitively', () => {
    expect(VariableManager.parseInputForStorage('TRUE', 'boolean')).toBe(true)
    expect(VariableManager.parseInputForStorage('False', 'boolean')).toBe(false)
    expect(VariableManager.parseInputForStorage('1', 'boolean')).toBe(true)
    expect(VariableManager.parseInputForStorage('0', 'boolean')).toBe(false)
  })
})

describe('VariableManager.formatForEditor', () => {
  it('pretty-prints objects with 2-space indentation', () => {
    const out = VariableManager.formatForEditor({ a: 1 }, 'object')
    expect(out).toBe('{\n  "a": 1\n}')
  })

  it('pretty-prints arrays', () => {
    const out = VariableManager.formatForEditor([1, 2], 'array')
    expect(out).toBe('[\n  1,\n  2\n]')
  })

  it('renders plain and string values as raw strings', () => {
    expect(VariableManager.formatForEditor('hello', 'string')).toBe('hello')
    expect(VariableManager.formatForEditor('hello', 'plain')).toBe('hello')
  })

  it('renders boolean/number as string without quotes', () => {
    expect(VariableManager.formatForEditor(true, 'boolean')).toBe('true')
    expect(VariableManager.formatForEditor(42, 'number')).toBe('42')
  })

  it('handles undefined / null to empty strings', () => {
    expect(VariableManager.formatForEditor(undefined, 'string')).toBe('')
    expect(VariableManager.formatForEditor(null, 'string')).toBe('')
  })

  it('provides special formatting for "invalid json"', () => {
    expect(VariableManager.formatForEditor('invalid json', 'object')).toBe(
      '{\n  "value": "invalid json"\n}'
    )
    expect(VariableManager.formatForEditor('invalid json', 'array')).toBe('[\n  "invalid json"\n]')
  })
})

describe('VariableManager.formatForTemplateInterpolation', () => {
  it('renders plain strings without quotes', () => {
    expect(VariableManager.formatForTemplateInterpolation('hello', 'string')).toBe('hello')
  })

  it('uses compact JSON for objects and arrays', () => {
    expect(VariableManager.formatForTemplateInterpolation({ a: 1 }, 'object')).toBe('{"a":1}')
    expect(VariableManager.formatForTemplateInterpolation([1, 2], 'array')).toBe('[1,2]')
  })

  it('renders undefined and null as empty strings', () => {
    expect(VariableManager.formatForTemplateInterpolation(undefined, 'string')).toBe('')
    expect(VariableManager.formatForTemplateInterpolation(null, 'number')).toBe('')
  })
})

describe('VariableManager.formatForCodeContext', () => {
  it('emits JSON-quoted strings', () => {
    expect(VariableManager.formatForCodeContext('hello', 'string')).toBe('"hello"')
  })

  it('emits JS literals for null and undefined', () => {
    expect(VariableManager.formatForCodeContext(undefined, 'string')).toBe('undefined')
    expect(VariableManager.formatForCodeContext(null, 'string')).toBe('null')
  })

  it('emits compact JSON for objects and arrays', () => {
    expect(VariableManager.formatForCodeContext({ a: 1 }, 'object')).toBe('{"a":1}')
    expect(VariableManager.formatForCodeContext([1, 2], 'array')).toBe('[1,2]')
  })
})

describe('VariableManager.resolveForExecution', () => {
  it('preserves null and undefined in execution context', () => {
    expect(VariableManager.resolveForExecution(null, 'string')).toBe(null)
    expect(VariableManager.resolveForExecution(undefined, 'number')).toBe(undefined)
  })

  it('coerces numeric strings', () => {
    expect(VariableManager.resolveForExecution('42', 'number')).toBe(42)
  })

  it('returns already-typed values unchanged', () => {
    const obj = { a: 1 }
    expect(VariableManager.resolveForExecution(obj, 'object')).toBe(obj)
    const arr = [1, 2]
    expect(VariableManager.resolveForExecution(arr, 'array')).toBe(arr)
  })
})

describe('VariableManager.shouldStripQuotesForDisplay', () => {
  it('detects matching double-quoted strings', () => {
    expect(VariableManager.shouldStripQuotesForDisplay('"hello"')).toBe(true)
  })

  it('detects matching single-quoted strings', () => {
    expect(VariableManager.shouldStripQuotesForDisplay("'hello'")).toBe(true)
  })

  it('returns false for unquoted strings', () => {
    expect(VariableManager.shouldStripQuotesForDisplay('hello')).toBe(false)
  })

  it('returns false for non-string inputs', () => {
    expect(VariableManager.shouldStripQuotesForDisplay(42 as any)).toBe(false)
    expect(VariableManager.shouldStripQuotesForDisplay('')).toBe(false)
  })

  it('returns false for too-short quoted strings', () => {
    expect(VariableManager.shouldStripQuotesForDisplay('""')).toBe(false)
    expect(VariableManager.shouldStripQuotesForDisplay("''")).toBe(false)
  })
})
