import { describe, expect, it } from 'vitest'
import {
  extractReferences,
  parseReference,
  VARIABLE_PREFIX,
  VariableReferenceStringSchema,
} from '../src/variable-reference'

describe('parseReference — block references', () => {
  it('parses a simple block reference', () => {
    const parsed = parseReference('<api.response.data>')
    expect(parsed).toEqual({
      kind: 'block',
      path: ['api', 'response', 'data'],
      raw: '<api.response.data>',
    })
  })

  it('parses a single-segment block reference', () => {
    const parsed = parseReference('<api>')
    expect(parsed).toEqual({ kind: 'block', path: ['api'], raw: '<api>' })
  })

  it('parses a reference with dashes in the head segment', () => {
    const parsed = parseReference('<my-api.response>')
    expect(parsed?.kind).toBe('block')
    expect(parsed?.path[0]).toBe('my-api')
  })
})

describe('parseReference — variable references', () => {
  it('parses a variable reference and strips the `variable` prefix', () => {
    const parsed = parseReference('<variable.myVar>')
    expect(parsed).toEqual({
      kind: 'variable',
      path: ['myVar'],
      raw: '<variable.myVar>',
    })
  })

  it('parses a dotted variable path', () => {
    const parsed = parseReference('<variable.nested.field>')
    expect(parsed).toEqual({
      kind: 'variable',
      path: ['nested', 'field'],
      raw: '<variable.nested.field>',
    })
  })

  it('VARIABLE_PREFIX exposes the expected prefix', () => {
    expect(VARIABLE_PREFIX).toBe('variable')
  })
})

describe('parseReference — env references', () => {
  it('parses an env reference', () => {
    const parsed = parseReference('{{HOME}}')
    expect(parsed).toEqual({ kind: 'env', path: ['HOME'], raw: '{{HOME}}' })
  })

  it('allows whitespace inside the braces', () => {
    const parsed = parseReference('{{  API_KEY  }}')
    expect(parsed?.kind).toBe('env')
    expect(parsed?.path).toEqual(['API_KEY'])
  })

  it('rejects lowercase env names', () => {
    expect(parseReference('{{home}}')).toBeNull()
  })
})

describe('parseReference — malformed input', () => {
  it('returns null for an empty string', () => {
    expect(parseReference('')).toBeNull()
  })

  it('returns null for a plain string', () => {
    expect(parseReference('not a reference')).toBeNull()
  })

  it('returns null for unclosed angle brackets', () => {
    expect(parseReference('<api.response')).toBeNull()
  })

  it('returns null for mismatched braces', () => {
    expect(parseReference('{HOME}}')).toBeNull()
    expect(parseReference('{{HOME}')).toBeNull()
  })

  it('returns null for an identifier starting with a digit', () => {
    expect(parseReference('<1api>')).toBeNull()
  })

  it('returns null when extra content follows the reference', () => {
    expect(parseReference('<api.x> trailing text')).toBeNull()
  })
})

describe('extractReferences', () => {
  it('returns an empty array when no references exist', () => {
    expect(extractReferences('plain string')).toEqual([])
  })

  it('extracts env and block references from a template', () => {
    const refs = extractReferences('Use {{HOME}} then call <api.response.data>.')
    expect(refs).toHaveLength(2)
    expect(refs.some((r) => r.kind === 'env' && r.path[0] === 'HOME')).toBe(true)
    expect(refs.some((r) => r.kind === 'block' && r.path[0] === 'api')).toBe(true)
  })

  it('distinguishes variables from blocks in the scanner', () => {
    const refs = extractReferences('<variable.x> and <block.y>')
    const kinds = refs.map((r) => r.kind)
    expect(kinds).toContain('variable')
    expect(kinds).toContain('block')
  })
})

describe('VariableReferenceStringSchema', () => {
  it('accepts a pure block reference', () => {
    expect(VariableReferenceStringSchema.safeParse('<api.response>').success).toBe(true)
  })

  it('accepts a pure variable reference', () => {
    expect(VariableReferenceStringSchema.safeParse('<variable.myVar>').success).toBe(true)
  })

  it('accepts a pure env reference', () => {
    expect(VariableReferenceStringSchema.safeParse('{{API_KEY}}').success).toBe(true)
  })

  it('rejects a malformed string', () => {
    expect(VariableReferenceStringSchema.safeParse('not a reference').success).toBe(false)
  })

  it('rejects a string with extra content around a reference', () => {
    expect(VariableReferenceStringSchema.safeParse('prefix {{API_KEY}}').success).toBe(false)
  })
})
