import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import {
  createErrorResponse,
  createForbiddenResponse,
  createInternalServerErrorResponse,
  createNotFoundResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createValidationErrorResponse,
  generateId,
  getQueryParams,
  isValidEmail,
  parseRequestBody,
  parseRequestBodyLegacy,
  sanitizeString,
  validateRequiredFields,
} from '@/lib/api-utils'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, ...(init || {}) })),
  },
}))

const jsonMock = NextResponse.json as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  jsonMock.mockClear()
})

describe('createSuccessResponse', () => {
  it('returns a JSON response with default status 200', () => {
    const res: any = createSuccessResponse({ hello: 'world' })

    expect(jsonMock).toHaveBeenCalledWith({ hello: 'world' }, { status: 200 })
    expect(res.body).toEqual({ hello: 'world' })
    expect(res.status).toBe(200)
  })

  it('accepts a custom status code', () => {
    const res: any = createSuccessResponse({ created: true }, 201)

    expect(jsonMock).toHaveBeenCalledWith({ created: true }, { status: 201 })
    expect(res.status).toBe(201)
  })
})

describe('createErrorResponse', () => {
  it('returns a standardized error body with default status 400', () => {
    const res: any = createErrorResponse('bad stuff')

    expect(jsonMock).toHaveBeenCalledTimes(1)
    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({
      error: 'bad stuff',
      success: false,
    })
    expect(typeof body.timestamp).toBe('string')
    expect(init).toEqual({ status: 400 })
    expect(res.status).toBe(400)
  })

  it('uses the supplied status code', () => {
    createErrorResponse('teapot', 418)
    const [, init] = jsonMock.mock.calls[0]
    expect(init).toEqual({ status: 418 })
  })
})

describe('createValidationErrorResponse', () => {
  it('returns the validation error payload with status 422', () => {
    const errors = { name: 'required', age: 'must be positive' }
    createValidationErrorResponse(errors)

    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({
      error: 'Validation failed',
      success: false,
      errors,
    })
    expect(body.timestamp).toBeDefined()
    expect(init).toEqual({ status: 422 })
  })
})

describe('createUnauthorizedResponse', () => {
  it('defaults to status 401 and message "Unauthorized"', () => {
    createUnauthorizedResponse()
    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({ error: 'Unauthorized', success: false })
    expect(init).toEqual({ status: 401 })
  })

  it('honors custom message', () => {
    createUnauthorizedResponse('login required')
    const [body] = jsonMock.mock.calls[0]
    expect(body.error).toBe('login required')
  })
})

describe('createForbiddenResponse', () => {
  it('defaults to status 403 and message "Forbidden"', () => {
    createForbiddenResponse()
    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({ error: 'Forbidden', success: false })
    expect(init).toEqual({ status: 403 })
  })
})

describe('createNotFoundResponse', () => {
  it('defaults to status 404 and message "Not found"', () => {
    createNotFoundResponse()
    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({ error: 'Not found', success: false })
    expect(init).toEqual({ status: 404 })
  })
})

describe('createInternalServerErrorResponse', () => {
  it('defaults to status 500 and message "Internal server error"', () => {
    createInternalServerErrorResponse()
    const [body, init] = jsonMock.mock.calls[0]
    expect(body).toMatchObject({
      error: 'Internal server error',
      success: false,
    })
    expect(init).toEqual({ status: 500 })
  })
})

describe('parseRequestBody', () => {
  const makeRequest = (text: string | (() => Promise<string>)): Request =>
    ({
      text: typeof text === 'function' ? text : async () => text,
    }) as unknown as Request

  it('returns parsed data for valid JSON', async () => {
    const request = makeRequest(JSON.stringify({ a: 1, b: 'two' }))
    const result = await parseRequestBody<{ a: number; b: string }>(request)
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ a: 1, b: 'two' })
  })

  it('returns empty body error when text is empty', async () => {
    const request = makeRequest('')
    const result = await parseRequestBody(request)
    expect(result.data).toBeNull()
    expect(result.error).toBe('Empty request body')
  })

  it('returns empty body error for whitespace-only bodies', async () => {
    const request = makeRequest('   \n  \t ')
    const result = await parseRequestBody(request)
    expect(result.data).toBeNull()
    expect(result.error).toBe('Empty request body')
  })

  it('returns JSON syntax error for malformed JSON', async () => {
    const request = makeRequest('{not: "json"')
    const result = await parseRequestBody(request)
    expect(result.data).toBeNull()
    expect(result.error).toBe('Invalid JSON format')
  })

  it('returns generic error when text() throws a non-syntax error', async () => {
    const request = makeRequest(async () => {
      throw new Error('network blew up')
    })
    const result = await parseRequestBody(request)
    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to parse request body')
  })
})

describe('parseRequestBodyLegacy', () => {
  it('returns parsed data on success', async () => {
    const request = { text: async () => JSON.stringify({ ok: true }) } as unknown as Request
    const data = await parseRequestBodyLegacy<{ ok: boolean }>(request)
    expect(data).toEqual({ ok: true })
  })

  it('returns null on failure', async () => {
    const request = { text: async () => 'definitely not json' } as unknown as Request
    const data = await parseRequestBodyLegacy(request)
    expect(data).toBeNull()
  })
})

describe('getQueryParams', () => {
  it('returns URLSearchParams for a URL', () => {
    const params = getQueryParams('https://example.com/foo?a=1&b=two&b=three')
    expect(params).toBeInstanceOf(URLSearchParams)
    expect(params.get('a')).toBe('1')
    expect(params.getAll('b')).toEqual(['two', 'three'])
  })

  it('returns empty URLSearchParams for URL without query', () => {
    const params = getQueryParams('https://example.com/foo')
    expect(Array.from(params.entries())).toEqual([])
  })
})

describe('validateRequiredFields', () => {
  it('returns null when all required fields are present', () => {
    const result = validateRequiredFields({ name: 'Alice', age: 30, active: true }, [
      'name',
      'age',
      'active',
    ])
    expect(result).toBeNull()
  })

  it('returns errors for missing fields', () => {
    const result = validateRequiredFields({ name: 'Alice' }, ['name', 'email'])
    expect(result).toEqual({ email: 'email is required' })
  })

  it('treats empty strings and whitespace as missing', () => {
    const result = validateRequiredFields({ name: '', description: '   ', email: 'a@b.co' }, [
      'name',
      'description',
      'email',
    ])
    expect(result).toEqual({
      name: 'name is required',
      description: 'description is required',
    })
  })

  it('treats falsy values (0, false, null, undefined) as missing', () => {
    const result = validateRequiredFields({ a: 0, b: false, c: null, d: undefined }, [
      'a',
      'b',
      'c',
      'd',
    ])
    expect(result).toEqual({
      a: 'a is required',
      b: 'b is required',
      c: 'c is required',
      d: 'd is required',
    })
  })
})

describe('sanitizeString', () => {
  it('trims and removes angle brackets', () => {
    expect(sanitizeString('  <hi> there  ')).toBe('hi there')
  })

  it('leaves safe strings alone (aside from trimming)', () => {
    expect(sanitizeString('  hello world  ')).toBe('hello world')
  })

  it('handles empty strings', () => {
    expect(sanitizeString('')).toBe('')
  })
})

describe('isValidEmail', () => {
  it('accepts typical emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('a.b+c@sub.example.co')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('missing@dot')).toBe(false)
    expect(isValidEmail('white space@example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('generateId', () => {
  it('defaults to length 8', () => {
    const id = generateId()
    expect(id).toHaveLength(8)
  })

  it('supports custom length', () => {
    expect(generateId(1)).toHaveLength(1)
    expect(generateId(32)).toHaveLength(32)
  })

  it('only uses the allowed alphanumeric character set', () => {
    const id = generateId(100)
    expect(id).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('produces (very likely) unique values across calls', () => {
    const a = generateId(32)
    const b = generateId(32)
    expect(a).not.toBe(b)
  })
})
