import { NextResponse } from 'next/server'
import {
  analyzeConversationSentiment,
  analyzeSentiment,
  summarizeConversation,
} from '@/lib/ai/sentiment-analyzer'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SentimentAPI')

/**
 * POST /api/ai/sentiment - Analyze sentiment of text or conversation
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, messages, mode } = await req.json()

    if (mode === 'conversation' && Array.isArray(messages)) {
      const sentiment = analyzeConversationSentiment(messages)
      const summary = summarizeConversation(messages)

      return NextResponse.json({ sentiment, summary })
    }

    if (typeof text === 'string' && text.trim()) {
      const sentiment = analyzeSentiment(text)
      return NextResponse.json({ sentiment })
    }

    return NextResponse.json(
      {
        error:
          'Provide either "text" for single analysis or "messages" array with mode: "conversation"',
      },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Sentiment analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze sentiment' }, { status: 500 })
  }
}
