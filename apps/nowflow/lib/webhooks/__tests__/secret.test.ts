import { beforeAll, describe, expect, it, vi } from 'vitest'
import { decryptWebhookSecret, encryptWebhookSecret, isEncryptedSecret } from '../secret'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

beforeAll(() => {
  // Provide a deterministic 32-byte key so encryption is reproducible across runs.
  process.env.ENCRYPTION_KEY = 'test-key-deterministic-do-not-use-in-prod'
})

describe('encryptWebhookSecret / decryptWebhookSecret', () => {
  it('round-trips an arbitrary string', async () => {
    const plaintext = 'whsec_abc123XYZ!@#'
    const encrypted = await encryptWebhookSecret(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(isEncryptedSecret(encrypted)).toBe(true)
    expect(await decryptWebhookSecret(encrypted)).toBe(plaintext)
  })

  it('produces a different ciphertext on every call (random IV)', async () => {
    const a = await encryptWebhookSecret('same-input')
    const b = await encryptWebhookSecret('same-input')
    expect(a).not.toBe(b)
    expect(await decryptWebhookSecret(a)).toBe('same-input')
    expect(await decryptWebhookSecret(b)).toBe('same-input')
  })

  it('throws when encrypting an empty string', async () => {
    await expect(encryptWebhookSecret('')).rejects.toThrow()
  })
})

describe('decryptWebhookSecret edge cases', () => {
  it('returns null for null/undefined/empty input', async () => {
    expect(await decryptWebhookSecret(null)).toBeNull()
    expect(await decryptWebhookSecret(undefined)).toBeNull()
    expect(await decryptWebhookSecret('')).toBeNull()
  })

  it('passes plaintext legacy values through unchanged', async () => {
    const legacy = 'plain-text-secret'
    expect(isEncryptedSecret(legacy)).toBe(false)
    expect(await decryptWebhookSecret(legacy)).toBe(legacy)
  })

  it('returns null when ciphertext is corrupted', async () => {
    const valid = await encryptWebhookSecret('payload')
    // Mutate the ciphertext middle segment so AEAD verification fails.
    const parts = valid.split(':')
    parts[1] = parts[1].split('').reverse().join('')
    const tampered = parts.join(':')
    // Still matches the format heuristic so it's treated as encrypted.
    expect(isEncryptedSecret(tampered)).toBe(true)
    expect(await decryptWebhookSecret(tampered)).toBeNull()
  })
})

describe('isEncryptedSecret', () => {
  it('matches canonical iv:ciphertext:authTag format', async () => {
    const encrypted = await encryptWebhookSecret('payload')
    expect(isEncryptedSecret(encrypted)).toBe(true)
  })

  it('rejects plaintext, partial, and malformed values', () => {
    expect(isEncryptedSecret('plaintext')).toBe(false)
    expect(isEncryptedSecret('aabb:ccdd')).toBe(false) // only 2 segments
    expect(isEncryptedSecret('a'.repeat(31) + ':abc:' + 'b'.repeat(32))).toBe(false) // iv wrong length
  })
})
