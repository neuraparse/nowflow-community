import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateEncryptionKey } from '../encryption'

// Helper to mutate NODE_ENV (declared read-only on process.env in TS lib).
const setNodeEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV
    return
  }
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

describe('validateEncryptionKey (Phase -1 S5 startup guard)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('throws in production when ENCRYPTION_KEY is missing', () => {
    setNodeEnv('production')
    delete process.env.ENCRYPTION_KEY
    expect(() => validateEncryptionKey()).toThrow(/ENCRYPTION_KEY/)
  })

  it('throws in production when ENCRYPTION_KEY is the insecure default', () => {
    setNodeEnv('production')
    process.env.ENCRYPTION_KEY = 'default-key-change-in-production'
    expect(() => validateEncryptionKey()).toThrow(/ENCRYPTION_KEY/)
  })

  it('logs a warning but does not throw in development when missing', () => {
    setNodeEnv('development')
    delete process.env.ENCRYPTION_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => validateEncryptionKey()).not.toThrow()
    warnSpy.mockRestore()
  })

  it('does not throw when a valid non-default ENCRYPTION_KEY is set', () => {
    setNodeEnv('production')
    process.env.ENCRYPTION_KEY = 'a-strong-random-secret-value-1234567890'
    expect(() => validateEncryptionKey()).not.toThrow()
  })
})
