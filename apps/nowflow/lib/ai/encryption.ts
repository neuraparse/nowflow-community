import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('AIProviderService')

const DEFAULT_INSECURE_KEY = 'default-key-change-in-production'

/**
 * Validates that ENCRYPTION_KEY is set to a non-default value.
 *
 * - In production: throws if the key is missing or equal to the insecure default.
 * - In development/test: logs a loud warning but allows the process to continue.
 *
 * Called at server startup via instrumentation.ts and available for unit tests.
 */
export function validateEncryptionKey(): void {
  if (typeof window !== 'undefined') return

  const key = process.env.ENCRYPTION_KEY
  const isMissing = !key || key.length === 0
  const isDefault = key === DEFAULT_INSECURE_KEY
  const isProd = process.env.NODE_ENV === 'production'

  if (isMissing || isDefault) {
    const reason = isMissing
      ? 'ENCRYPTION_KEY environment variable is not set'
      : 'ENCRYPTION_KEY is set to the insecure default value'
    if (isProd) {
      const message = `CRITICAL: ${reason}. Refusing to start in production.`
      logger.error(message)
      throw new Error(message)
    }
    logger.warn(
      `WARNING: ${reason}. This is insecure and will cause a crash in production. ` +
        'Set ENCRYPTION_KEY to a strong random value before deploying.'
    )
  }
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key === DEFAULT_INSECURE_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is not configured; refusing to encrypt/decrypt.')
    }
    return key || DEFAULT_INSECURE_KEY
  }
  return key
}

function getAesKey(): Buffer {
  return createHash('sha256').update(getEncryptionKey()).digest()
}

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM (legacy base64 fallback removed per 4.5)
// ---------------------------------------------------------------------------

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return ''
  try {
    const iv = randomBytes(12) // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', getAesKey(), iv)
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    // Format: "aes:" prefix + base64(iv + authTag + ciphertext)
    return 'aes:' + Buffer.concat([iv, authTag, encrypted]).toString('base64')
  } catch (error) {
    logger.error('Failed to encrypt API key', { error })
    return ''
  }
}

export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return ''
  try {
    if (!encryptedKey.startsWith('aes:')) {
      // Legacy base64 format is no longer supported. Existing rows encrypted
      // with the old scheme must be migrated (see Phase -1 S5 migration note).
      logger.error('Refusing to decrypt non-AES ciphertext; legacy format is unsupported')
      return ''
    }
    const data = Buffer.from(encryptedKey.slice(4), 'base64')
    const iv = data.subarray(0, 12)
    const authTag = data.subarray(12, 28)
    const ciphertext = data.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', getAesKey(), iv)
    decipher.setAuthTag(authTag)
    return decipher.update(ciphertext) + decipher.final('utf8')
  } catch (error) {
    logger.error('Failed to decrypt API key', { error })
    return ''
  }
}
