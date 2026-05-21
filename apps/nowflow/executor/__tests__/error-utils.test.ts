import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractErrorMessage, sanitizeError } from '@/executor/error-utils'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('error-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractErrorMessage', () => {
    it('returns the same string when given a string', () => {
      expect(extractErrorMessage('boom')).toBe('boom')
    })

    it('returns an empty string unchanged', () => {
      expect(extractErrorMessage('')).toBe('')
    })

    it('returns the message property when present', () => {
      const err = new Error('something failed')
      expect(extractErrorMessage(err)).toBe('something failed')
    })

    it('returns the message property on a plain object', () => {
      expect(extractErrorMessage({ message: 'hello' })).toBe('hello')
    })

    it('returns response.data when it is a string', () => {
      const err = { response: { data: 'bad request' } }
      expect(extractErrorMessage(err)).toBe('bad request')
    })

    it('returns response.data.message when present', () => {
      const err = { response: { data: { message: 'validation failed' } } }
      expect(extractErrorMessage(err)).toBe('validation failed')
    })

    it('stringifies response.data when no message exists on it', () => {
      const err = { response: { data: { code: 42, detail: 'nope' } } }
      expect(extractErrorMessage(err)).toBe(JSON.stringify({ code: 42, detail: 'nope' }))
    })

    it('stringifies a plain object when no message or response is present', () => {
      const err = { foo: 'bar', n: 1 }
      expect(extractErrorMessage(err)).toBe(JSON.stringify(err))
    })

    it('converts a number error to a string via String()', () => {
      expect(extractErrorMessage(42)).toBe('42')
    })

    it('prefers message over response.data', () => {
      const err = { message: 'top level', response: { data: 'nested' } }
      expect(extractErrorMessage(err)).toBe('top level')
    })
  })

  describe('sanitizeError', () => {
    it('returns the same string when given a string', () => {
      expect(sanitizeError('oh no')).toBe('oh no')
    })

    it('returns the message property on Error instances', () => {
      const err = new Error('kaboom')
      expect(sanitizeError(err)).toBe('kaboom')
    })

    it('returns response.data when it is a string', () => {
      const err = { response: { data: 'server unreachable' } }
      expect(sanitizeError(err)).toBe('server unreachable')
    })

    it('returns response.data.message when present', () => {
      const err = { response: { data: { message: 'unauthorized' } } }
      expect(sanitizeError(err)).toBe('unauthorized')
    })

    it('stringifies response.data without a message field', () => {
      const err = { response: { data: { errorCode: 'X1' } } }
      expect(sanitizeError(err)).toBe(JSON.stringify({ errorCode: 'X1' }))
    })

    it('stringifies plain objects with no recognized fields', () => {
      const err = { custom: true }
      expect(sanitizeError(err)).toBe(JSON.stringify(err))
    })

    it('falls back to String() for primitives like booleans', () => {
      expect(sanitizeError(false)).toBe('false')
    })
  })
})
