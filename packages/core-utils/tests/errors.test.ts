import { describe, expect, it } from 'vitest'
import { AuthError, BudgetExhaustedError, NowFlowError, ValidationError } from '../src/errors'

describe('NowFlowError', () => {
  it('sets code, message, and details', () => {
    const err = new NowFlowError('SOME_CODE', 'something went wrong', { foo: 'bar' })

    expect(err.code).toBe('SOME_CODE')
    expect(err.message).toBe('something went wrong')
    expect(err.details).toEqual({ foo: 'bar' })
  })

  it('is an instance of Error and NowFlowError', () => {
    const err = new NowFlowError('X', 'msg')

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(NowFlowError)
  })

  it('maintains prototype chain across new.target', () => {
    const err = new NowFlowError('X', 'msg')
    expect(Object.getPrototypeOf(err)).toBe(NowFlowError.prototype)
  })

  it('leaves details undefined when not provided', () => {
    const err = new NowFlowError('X', 'msg')
    expect(err.details).toBeUndefined()
  })

  it('has name "NowFlowError"', () => {
    const err = new NowFlowError('X', 'msg')
    expect(err.name).toBe('NowFlowError')
  })
})

describe('BudgetExhaustedError', () => {
  it('extends NowFlowError with code BUDGET_EXHAUSTED', () => {
    const err = new BudgetExhaustedError()

    expect(err).toBeInstanceOf(NowFlowError)
    expect(err).toBeInstanceOf(BudgetExhaustedError)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('BUDGET_EXHAUSTED')
    expect(err.name).toBe('BudgetExhaustedError')
  })

  it('accepts a custom message and details', () => {
    const err = new BudgetExhaustedError('over limit', { usedUsd: 10 })
    expect(err.message).toBe('over limit')
    expect(err.details).toEqual({ usedUsd: 10 })
  })

  it('uses a default message when none provided', () => {
    const err = new BudgetExhaustedError()
    expect(err.message).toBe('Budget exhausted')
  })
})

describe('ValidationError', () => {
  it('extends NowFlowError with code VALIDATION_ERROR', () => {
    const err = new ValidationError()

    expect(err).toBeInstanceOf(NowFlowError)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
  })

  it('accepts custom message and details', () => {
    const err = new ValidationError('bad input', { field: 'email' })
    expect(err.message).toBe('bad input')
    expect(err.details).toEqual({ field: 'email' })
  })
})

describe('AuthError', () => {
  it('extends NowFlowError with code AUTH_ERROR', () => {
    const err = new AuthError()

    expect(err).toBeInstanceOf(NowFlowError)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.code).toBe('AUTH_ERROR')
    expect(err.name).toBe('AuthError')
  })

  it('accepts custom message and details', () => {
    const err = new AuthError('not logged in', { userId: null })
    expect(err.message).toBe('not logged in')
    expect(err.details).toEqual({ userId: null })
  })
})

describe('JSON serialization', () => {
  // Note: Error objects do not serialize their own-properties by default because
  // `message`, `name`, and `stack` are non-enumerable. `code` and `details` are
  // set via plain assignment and are therefore enumerable and included.
  it('serializes `code` and `details` through JSON.stringify', () => {
    const err = new NowFlowError('X', 'msg', { foo: 1 })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.code).toBe('X')
    expect(json.details).toEqual({ foo: 1 })
  })

  it('serializes subclass errors with their code', () => {
    const err = new ValidationError('bad', { field: 'email' })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.details).toEqual({ field: 'email' })
  })

  it('serializes BudgetExhaustedError code', () => {
    const err = new BudgetExhaustedError('out', { limit: 5 })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.code).toBe('BUDGET_EXHAUSTED')
    expect(json.details).toEqual({ limit: 5 })
  })

  it('JSON.stringify produces name, code, message, details for NowFlowError', () => {
    const err = new NowFlowError('CODE_X', 'something broke', { foo: 'bar' })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.name).toBe('NowFlowError')
    expect(json.code).toBe('CODE_X')
    expect(json.message).toBe('something broke')
    expect(json.details).toEqual({ foo: 'bar' })
  })

  it('JSON.stringify produces name, code, message, details for BudgetExhaustedError', () => {
    const err = new BudgetExhaustedError('over limit', { usedUsd: 10 })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.name).toBe('BudgetExhaustedError')
    expect(json.code).toBe('BUDGET_EXHAUSTED')
    expect(json.message).toBe('over limit')
    expect(json.details).toEqual({ usedUsd: 10 })
  })

  it('JSON.stringify produces name, code, message, details for ValidationError', () => {
    const err = new ValidationError('bad input', { field: 'email' })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.name).toBe('ValidationError')
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.message).toBe('bad input')
    expect(json.details).toEqual({ field: 'email' })
  })

  it('JSON.stringify produces name, code, message, details for AuthError', () => {
    const err = new AuthError('not logged in', { userId: null })
    const json = JSON.parse(JSON.stringify(err))
    expect(json.name).toBe('AuthError')
    expect(json.code).toBe('AUTH_ERROR')
    expect(json.message).toBe('not logged in')
    expect(json.details).toEqual({ userId: null })
  })
})
