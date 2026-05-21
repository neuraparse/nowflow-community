import { describe, expect, it } from 'vitest'
import type { NextRequest } from 'next/server'
import {
  createValidationError,
  extractFilterParams,
  extractPaginationParams,
  extractSearchQuery,
  extractSortParams,
  isValidEmail,
  isValidUUID,
  sanitizeString,
} from '@/lib/api-validation'

const makeRequest = (url: string): NextRequest => ({ url }) as unknown as NextRequest

describe('extractPaginationParams', () => {
  it('returns defaults when no params provided', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api'))
    expect(result).toEqual({ limit: 50, offset: 0 })
  })

  it('parses valid limit and offset', () => {
    const result = extractPaginationParams(
      makeRequest('https://example.com/api?limit=25&offset=10')
    )
    expect(result).toEqual({ limit: 25, offset: 10 })
  })

  it('caps limit at maxLimit (default 100)', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?limit=500'))
    expect(result.limit).toBe(100)
  })

  it('caps limit at provided maxLimit', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?limit=1000'), 200)
    expect(result.limit).toBe(200)
  })

  it('falls back to default limit for non-numeric input', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?limit=abc'))
    expect(result.limit).toBe(50)
  })

  it('falls back to default limit for zero or negative', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?limit=0&offset=-5'))
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('accepts offset of 0 explicitly', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?offset=0'))
    expect(result.offset).toBe(0)
  })

  it('ignores non-numeric offset', () => {
    const result = extractPaginationParams(makeRequest('https://example.com/api?offset=xyz'))
    expect(result.offset).toBe(0)
  })
})

describe('extractSortParams', () => {
  it('returns defaults when no params provided', () => {
    const result = extractSortParams(makeRequest('https://example.com/api'), ['name', 'createdAt'])
    expect(result).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' })
  })

  it('uses the supplied default field', () => {
    const result = extractSortParams(
      makeRequest('https://example.com/api'),
      ['name', 'email'],
      'name'
    )
    expect(result.sortBy).toBe('name')
  })

  it('uses sortBy when it is in the allowed list', () => {
    const result = extractSortParams(
      makeRequest('https://example.com/api?sortBy=name&sortOrder=asc'),
      ['name', 'createdAt']
    )
    expect(result).toEqual({ sortBy: 'name', sortOrder: 'asc' })
  })

  it('ignores sortBy when it is NOT in the allowed list', () => {
    const result = extractSortParams(makeRequest('https://example.com/api?sortBy=password'), [
      'name',
      'createdAt',
    ])
    expect(result.sortBy).toBe('createdAt')
  })

  it('defaults sortOrder to desc for any value other than "asc"', () => {
    const result = extractSortParams(makeRequest('https://example.com/api?sortOrder=sideways'), [
      'createdAt',
    ])
    expect(result.sortOrder).toBe('desc')
  })
})

describe('extractSearchQuery', () => {
  it('returns undefined when no search parameter is present', () => {
    expect(extractSearchQuery(makeRequest('https://example.com/api'))).toBeUndefined()
  })

  it('returns trimmed + sanitized search string', () => {
    const result = extractSearchQuery(
      makeRequest('https://example.com/api?search=%20hello%20world%20')
    )
    expect(result).toBe('hello world')
  })

  it('strips SQL-ish characters', () => {
    const result = extractSearchQuery(
      makeRequest("https://example.com/api?search=O'Reilly; DROP TABLE users--")
    )
    expect(result).toBe('OReilly DROP TABLE users')
  })

  it('removes block comment markers', () => {
    const result = extractSearchQuery(
      makeRequest('https://example.com/api?search=foo%2F%2Abar%2A%2Fbaz')
    )
    expect(result).toBe('foobarbaz')
  })

  it('returns undefined when below minLength', () => {
    const result = extractSearchQuery(makeRequest('https://example.com/api?search=hi'), 5)
    expect(result).toBeUndefined()
  })

  it('returns undefined when above maxLength', () => {
    const longQuery = 'a'.repeat(150)
    const result = extractSearchQuery(
      makeRequest(`https://example.com/api?search=${longQuery}`),
      1,
      100
    )
    expect(result).toBeUndefined()
  })

  it('returns undefined for an empty search string', () => {
    const result = extractSearchQuery(makeRequest('https://example.com/api?search='))
    expect(result).toBeUndefined()
  })
})

describe('isValidUUID', () => {
  it('accepts lowercase v4 UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts uppercase UUIDs', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('rejects strings that are not UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
    expect(isValidUUID('')).toBe(false)
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts standard emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('a.b+c@d.co.uk')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('nope@nope')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('   hello   ')).toBe('hello')
  })

  it('removes angle brackets', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })

  it('truncates to maxLength (default 500)', () => {
    const input = 'a'.repeat(1000)
    expect(sanitizeString(input)).toHaveLength(500)
  })

  it('truncates to custom maxLength', () => {
    expect(sanitizeString('abcdefghij', 4)).toBe('abcd')
  })
})

describe('extractFilterParams', () => {
  it('returns only filters whose values are in the allowed set', () => {
    const req = makeRequest('https://example.com/api?status=active&role=admin&unknown=x')
    const result = extractFilterParams(req, {
      status: ['active', 'inactive'],
      role: ['admin', 'user'],
    })
    expect(result).toEqual({ status: 'active', role: 'admin' })
  })

  it('omits values not in the allowed set', () => {
    const req = makeRequest('https://example.com/api?status=banned')
    const result = extractFilterParams(req, { status: ['active', 'inactive'] })
    expect(result).toEqual({})
  })

  it('omits missing filters entirely', () => {
    const req = makeRequest('https://example.com/api')
    const result = extractFilterParams(req, { status: ['active'] })
    expect(result).toEqual({})
  })
})

describe('createValidationError', () => {
  it('returns a standardized error object with defaults', () => {
    const err = createValidationError('bad input')
    expect(err).toMatchObject({
      error: 'bad input',
      status: 400,
      details: undefined,
    })
    expect(typeof err.timestamp).toBe('string')
  })

  it('honors custom status and details', () => {
    const err = createValidationError('missing', 422, { field: 'email' })
    expect(err).toMatchObject({
      error: 'missing',
      status: 422,
      details: { field: 'email' },
    })
  })

  it('coerces falsy details to undefined', () => {
    const err = createValidationError('x', 400, null)
    expect(err.details).toBeUndefined()
  })
})
