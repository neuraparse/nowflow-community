/**
 * Tests for subblock utils helpers.
 * Covers: isEnvVarReference, extractEnvVarName,
 *         generatePossibleEnvVarNames, findMatchingEnvVar
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractEnvVarName,
  findMatchingEnvVar,
  generatePossibleEnvVarNames,
  isEnvVarReference,
} from '@/stores/workflows/subblock/utils'

const getVariable = vi.fn()

vi.mock('@/stores/settings/environment/store', () => ({
  useEnvironmentStore: {
    getState: () => ({ getVariable }),
  },
}))

describe('isEnvVarReference', () => {
  it('matches a simple env var reference', () => {
    expect(isEnvVarReference('{{CRM_API_KEY}}')).toBe(true)
  })

  it('allows alphanumerics, underscore, and dash', () => {
    expect(isEnvVarReference('{{MY_TOKEN_1}}')).toBe(true)
    expect(isEnvVarReference('{{some-var}}')).toBe(true)
  })

  it('rejects plain values', () => {
    expect(isEnvVarReference('plain')).toBe(false)
    expect(isEnvVarReference('')).toBe(false)
  })

  it('rejects partial braces', () => {
    expect(isEnvVarReference('{ENV}')).toBe(false)
    expect(isEnvVarReference('{{ENV}')).toBe(false)
    expect(isEnvVarReference('{{ENV}}}')).toBe(false)
  })

  it('rejects values with whitespace inside braces', () => {
    expect(isEnvVarReference('{{ ENV }}')).toBe(false)
  })
})

describe('extractEnvVarName', () => {
  it('returns the variable name for a valid reference', () => {
    expect(extractEnvVarName('{{FOO}}')).toBe('FOO')
    expect(extractEnvVarName('{{MY_VAR_1}}')).toBe('MY_VAR_1')
  })

  it('returns null for invalid references', () => {
    expect(extractEnvVarName('plain')).toBeNull()
    expect(extractEnvVarName('')).toBeNull()
    expect(extractEnvVarName('{{ FOO }}')).toBeNull()
  })
})

describe('generatePossibleEnvVarNames', () => {
  it('generates candidates using the base tool name', () => {
    const names = generatePossibleEnvVarNames('crm')
    expect(names).toEqual(['CRM_API_KEY', 'CRM_API_KEY', 'CRM_KEY', 'CRM_TOKEN', 'CRM'])
  })

  it('strips suffix after dash when generating candidates', () => {
    const names = generatePossibleEnvVarNames('crm-create')
    // baseTool is "crm", toolPrefix "CRM"
    expect(names[0]).toBe('CRM_API_KEY')
    expect(names).toContain('CRM_KEY')
    expect(names).toContain('CRM_TOKEN')
    expect(names).toContain('CRM')
  })

  it('uppercases lowercase tool ids', () => {
    expect(generatePossibleEnvVarNames('openai')[0]).toBe('OPENAI_API_KEY')
  })
})

describe('findMatchingEnvVar', () => {
  beforeEach(() => {
    getVariable.mockReset()
  })

  it('returns the first matching env var name', () => {
    getVariable.mockImplementation((name: string) => (name === 'CRM_KEY' ? 'secret' : undefined))
    expect(findMatchingEnvVar('crm')).toBe('CRM_KEY')
  })

  it('prefers earlier candidates when multiple match', () => {
    getVariable.mockImplementation((name: string) =>
      name === 'CRM_API_KEY' || name === 'CRM_TOKEN' ? 'val' : undefined
    )
    expect(findMatchingEnvVar('crm')).toBe('CRM_API_KEY')
  })

  it('returns null when no candidate exists in the env store', () => {
    getVariable.mockReturnValue(undefined)
    expect(findMatchingEnvVar('unknown')).toBeNull()
  })

  it('uses the base tool name for compound ids', () => {
    getVariable.mockImplementation((name: string) => (name === 'CRM_API_KEY' ? 'x' : undefined))
    expect(findMatchingEnvVar('crm-create')).toBe('CRM_API_KEY')
  })
})
