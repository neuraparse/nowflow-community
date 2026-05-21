/**
 * Webhook secret storage helpers.
 *
 * Webhook signing secrets are encrypted at rest using AES-256-GCM via the
 * project's `encryptSecret` / `decryptSecret` primitives. Encrypted values are
 * stored in the canonical format `iv:ciphertext:authTag` (3 colon-separated
 * hex segments). Plaintext legacy values are also accepted on read for
 * backward compatibility — they're detected by failing to match the encrypted
 * format heuristic.
 */
import { createLogger } from '@/lib/logs/console-logger'
import { decryptSecret, encryptSecret } from '@/lib/utils'

const logger = createLogger('WebhookSecret')

/**
 * Format heuristic for our encryption envelope: three colon-separated
 * hex segments. The IV is exactly 32 hex chars (16 bytes), and the auth tag
 * is exactly 32 hex chars (16 bytes). Anything else is treated as plaintext.
 */
const ENCRYPTED_RE = /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/i

/**
 * Returns true if `stored` looks like an encrypted secret produced by
 * `encryptWebhookSecret`. False for plaintext legacy values.
 */
export function isEncryptedSecret(stored: string): boolean {
  return ENCRYPTED_RE.test(stored)
}

/**
 * Encrypt a webhook signing secret for storage.
 *
 * The output is safe to write to `webhook.secret_key` directly — there's no
 * additional envelope. Use `decryptWebhookSecret()` on read.
 */
export async function encryptWebhookSecret(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error('Cannot encrypt empty webhook secret')
  const { encrypted } = await encryptSecret(plaintext)
  return encrypted
}

/**
 * Decrypt a webhook signing secret. Accepts both new encrypted values AND
 * legacy plaintext values (returns them unchanged). Returns `null` when the
 * input is empty so callers can short-circuit verification cleanly.
 */
export async function decryptWebhookSecret(
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) return null
  if (!isEncryptedSecret(stored)) {
    // Legacy plaintext — accept but warn so the team can migrate via rotation.
    logger.warn(
      'Webhook secret stored as plaintext; rotate via encryptWebhookSecret() to encrypt at rest.'
    )
    return stored
  }
  try {
    const { decrypted } = await decryptSecret(stored)
    return decrypted
  } catch (err) {
    logger.error('Failed to decrypt webhook secret', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
