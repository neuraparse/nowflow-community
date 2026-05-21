import OpenAI from 'openai'
import { getDefaultModel } from '@/lib/ai/provider-config'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ChatTitle')

/**
 * Generates a short title for a chat based on the first message
 * @param message First user message in the chat
 * @returns A short title or null if API key is not available
 */
export async function generateChatTitle(message: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Safe: This code runs server-side only
    })

    const response = await openai.chat.completions.create({
      model: getDefaultModel('openai'),
      messages: [
        {
          role: 'system',
          content:
            'Generate a very short title (3-5 words max) for a chat that starts with this message. The title should be concise and descriptive.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 20,
      temperature: 0.7,
    })

    const title = response.choices[0]?.message?.content?.trim() || null
    return title
  } catch (error) {
    logger.error('Error generating chat title:', error)
    return null
  }
}
