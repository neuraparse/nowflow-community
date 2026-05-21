/**
 * AES-256-GCM secret encryption helpers.
 *
 * Extracted from `lib/utils.ts` so the core encryption surface lives in a
 * focused, single-purpose module. Callers should import from `@/lib/utils`
 * (the canonical entry — re-exports these symbols) unless they're inside
 * the encryption package itself.
 *
 * Key resolution (`getEncryptionKey`):
 *  - 64-char hex `ENCRYPTION_KEY` → used as-is (32 bytes)
 *  - any other non-empty `ENCRYPTION_KEY` → derived to 32 bytes via SHA-256
 *  - missing → falls back to an insecure default + emits a one-time CRITICAL
 *    log line; this path must never reach production
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Encryption')

let warnedInsecureEncryptionKey = false

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  const fallback = 'default-key-change-in-production'
  const raw = (key && key.trim().length > 0 ? key : fallback).trim()

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }

  if (raw === fallback && !warnedInsecureEncryptionKey) {
    warnedInsecureEncryptionKey = true
    logger.error(
      'CRITICAL: ENCRYPTION_KEY is not set. Using an insecure default — set ENCRYPTION_KEY to a 32-byte random value for production.'
    )
  }

  return createHash('sha256').update(raw, 'utf8').digest()
}

/**
 * Encrypts a secret using AES-256-GCM.
 *
 * Returns the canonical envelope `{ encrypted: 'iv:ciphertext:authTag', iv }`
 * — the same format `decryptSecret` expects on read.
 */
export async function encryptSecret(secret: string): Promise<{ encrypted: string; iv: string }> {
  const iv = randomBytes(16)
  const key = getEncryptionKey()

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return {
    encrypted: `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypts an `iv:ciphertext:authTag` envelope produced by `encryptSecret`.
 * Throws when the envelope is malformed or the AEAD tag fails to verify.
 */
export async function decryptSecret(encryptedValue: string): Promise<{ decrypted: string }> {
  const parts = encryptedValue.split(':')
  const ivHex = parts[0]
  const authTagHex = parts[parts.length - 1]
  const encrypted = parts.slice(1, -1).join(':')

  if (!ivHex || !encrypted || !authTagHex) {
    throw new Error('Invalid encrypted value format. Expected "iv:encrypted:authTag"')
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return { decrypted }
  } catch (error: any) {
    logger.error('Decryption error:', { error: error.message })
    throw error
  }
}
