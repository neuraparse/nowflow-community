import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { createLogger } from '@/lib/logs/console-logger'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import { chat, chatAnalytics, chatSession } from '@/db/schema'

const logger = createLogger('ChatFeedbackAPI')

const FeedbackSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  isPositive: z.boolean(),
  comment: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params
    const sessionToken = request.headers.get('X-Session-Token')

    if (!sessionToken) {
      return createErrorResponse('Session token required', 400)
    }

    // Get chat deployment
    const chatDeployment = await db
      .select()
      .from(chat)
      .where(eq(chat.subdomain, subdomain))
      .limit(1)

    if (chatDeployment.length === 0) {
      return createErrorResponse('Chat not found', 404)
    }

    const chatConfig = chatDeployment[0]

    // Check if feedback is enabled
    if (!chatConfig.customizations?.enableFeedback) {
      return createErrorResponse('Feedback is not enabled for this chat', 403)
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return createErrorResponse('Invalid JSON in request body', 400)
    }

    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return createErrorResponse(parsed.error.issues[0]?.message || 'Invalid feedback data', 400)
    }

    const { messageId, isPositive, comment } = parsed.data

    // Get or create session
    let session = await db
      .select()
      .from(chatSession)
      .where(eq(chatSession.sessionToken, sessionToken))
      .limit(1)

    if (session.length === 0) {
      // Create new session
      const newSessionId = uuidv4()
      await db.insert(chatSession).values({
        id: newSessionId,
        chatId: chatConfig.id,
        sessionToken,
        messageCount: 0,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } else {
      // Update session feedback
      const currentSession = session[0]
      await db
        .update(chatSession)
        .set({
          feedbackRating: isPositive ? 5 : 1,
          feedbackComment: comment || null,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatSession.id, currentSession.id))
    }

    // Update analytics
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingAnalytics = await db
      .select()
      .from(chatAnalytics)
      .where(eq(chatAnalytics.chatId, chatConfig.id))
      .limit(1)

    if (existingAnalytics.length > 0) {
      const current = existingAnalytics[0]
      await db
        .update(chatAnalytics)
        .set({
          positiveFeedback: isPositive ? current.positiveFeedback + 1 : current.positiveFeedback,
          negativeFeedback: !isPositive ? current.negativeFeedback + 1 : current.negativeFeedback,
          feedbackRate: parseFloat(
            (
              ((isPositive ? current.positiveFeedback + 1 : current.positiveFeedback) /
                (current.positiveFeedback + current.negativeFeedback + 1)) *
              100
            ).toFixed(2)
          ),
          updatedAt: new Date(),
        })
        .where(eq(chatAnalytics.id, current.id))
    } else {
      // Create new analytics entry
      await db.insert(chatAnalytics).values({
        id: uuidv4(),
        chatId: chatConfig.id,
        date: today,
        totalMessages: 0,
        userMessages: 0,
        botMessages: 0,
        uniqueUsers: 0,
        newUsers: 0,
        returningUsers: 0,
        avgResponseTime: 0,
        totalErrors: 0,
        errorRate: 0,
        avgMessagesPerUser: 0,
        avgSessionDuration: 0,
        positiveFeedback: isPositive ? 1 : 0,
        negativeFeedback: !isPositive ? 1 : 0,
        feedbackRate: isPositive ? 100 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    logger.info('Feedback recorded:', {
      chatId: chatConfig.id,
      messageId,
      isPositive,
      hasComment: !!comment,
    })

    return createSuccessResponse({
      message: 'Feedback recorded successfully',
    })
  } catch (error: any) {
    logger.error('Error recording feedback:', error)
    return createErrorResponse(error.message || 'Failed to record feedback', 500)
  }
}
