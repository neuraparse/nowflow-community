import { describe, expect, it } from 'vitest'
import {
  getPasswordValidationErrors,
  normalizeFirstUserInput,
  validateFirstUserInput,
} from '@/lib/setup/validation'

describe('first-run setup validation', () => {
  it('accepts a strong first-user payload and normalizes email', () => {
    const result = validateFirstUserInput({
      name: 'Ada Lovelace',
      email: ' ADA@Example.COM ',
      password: 'Str0ng#Pass',
      workspaceName: ' Community Lab ',
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Str0ng#Pass',
      workspaceName: 'Community Lab',
    })
  })

  it('reports weak password requirements', () => {
    expect(getPasswordValidationErrors('short')).toEqual([
      'Password must be at least 8 characters long.',
      'Password must include at least one uppercase letter.',
      'Password must include at least one number.',
      'Password must include at least one special character.',
    ])
  })

  it('uses a safe default workspace name', () => {
    expect(
      normalizeFirstUserInput({
        name: 'Grace Hopper',
        email: 'grace@example.com',
        password: 'Str0ng#Pass',
      }).workspaceName
    ).toBe('Grace Hopper Workspace')
  })

  it('rejects missing identity fields', () => {
    const result = validateFirstUserInput({
      name: '',
      email: 'not-an-email',
      password: 'Str0ng#Pass',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Full name is required.')
    expect(result.errors).toContain('Please enter a valid email address.')
  })
})
