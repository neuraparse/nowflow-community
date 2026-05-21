import { createHmac } from 'crypto'
import { APP_DOMAIN } from '@/lib/config/app-urls'

const SECRET = process.env.BETTER_AUTH_SECRET || process.env.ENCRYPTION_KEY || ''

export type UnsubscribeCategory = 'workflowCompletion' | 'workflowFailure' | 'digest' | 'all'

/**
 * Generates a signed unsubscribe token for email List-Unsubscribe headers.
 * Token format: base64url(userId:category:signature)
 */
export function generateUnsubscribeToken(userId: string, category: UnsubscribeCategory): string {
  const payload = `${userId}:${category}`
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

/**
 * Verifies and decodes an unsubscribe token.
 * Returns null if the token is invalid or tampered with.
 */
export function verifyUnsubscribeToken(
  token: string
): { userId: string; category: UnsubscribeCategory } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 3) return null

    const [userId, category, signature] = parts
    if (!userId || !category || !signature) return null

    const validCategories: UnsubscribeCategory[] = [
      'workflowCompletion',
      'workflowFailure',
      'digest',
      'all',
    ]
    if (!validCategories.includes(category as UnsubscribeCategory)) return null

    const expectedSignature = createHmac('sha256', SECRET)
      .update(`${userId}:${category}`)
      .digest('hex')
      .slice(0, 16)

    if (signature !== expectedSignature) return null

    return { userId, category: category as UnsubscribeCategory }
  } catch {
    return null
  }
}

/**
 * Builds the List-Unsubscribe and List-Unsubscribe-Post headers
 * for Gmail/RFC 8058 one-click unsubscribe compliance.
 */
export function buildUnsubscribeHeaders(
  userId: string,
  category: UnsubscribeCategory
): Record<string, string> {
  const token = generateUnsubscribeToken(userId, category)
  const baseUrl = APP_DOMAIN
  const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${token}`

  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
