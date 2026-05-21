import { eq } from 'drizzle-orm'
import 'server-only'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { settings } from '@/db/schema'

const logger = createLogger('GetUserApiKey')

/**
 * Load the user's OpenAI API key from their settings.
 * Falls back to OPENAI_API_KEY env var if not found in DB.
 * Returns undefined if no key is available.
 */
export async function getUserOpenAIKey(userId: string): Promise<string | undefined> {
  try {
    if (!userId || userId === 'anonymous') {
      return process.env.OPENAI_API_KEY || undefined
    }

    const records = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)

    if (records.length > 0) {
      const general = records[0].general as any
      const key = general?.aiSettings?.apiKeys?.openai
      if (key) return key
    }

    return process.env.OPENAI_API_KEY || undefined
  } catch (error) {
    logger.error('Failed to load user OpenAI API key:', error)
    return process.env.OPENAI_API_KEY || undefined
  }
}
