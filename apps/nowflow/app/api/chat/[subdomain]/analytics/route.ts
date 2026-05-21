import { NextRequest } from 'next/server'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import { chat, chatAnalytics, chatMessageLog, chatSession } from '@/db/schema'

const logger = createLogger('ChatAnalyticsAPI')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await getSession()

    if (!session) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { subdomain } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    // Get chat deployment
    const chatDeployment = await db
      .select()
      .from(chat)
      .where(and(eq(chat.subdomain, subdomain), eq(chat.userId, session.user.id)))
      .limit(1)

    if (chatDeployment.length === 0) {
      return createErrorResponse('Chat not found', 404)
    }

    const chatConfig = chatDeployment[0]

    // Check if analytics is enabled
    if (!chatConfig.analytics?.enabled) {
      return createErrorResponse('Analytics is not enabled for this chat', 403)
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get analytics data
    const analytics = await db
      .select()
      .from(chatAnalytics)
      .where(and(eq(chatAnalytics.chatId, chatConfig.id), gte(chatAnalytics.date, startDate)))
      .orderBy(desc(chatAnalytics.date))

    // Get total sessions
    const sessions = await db
      .select()
      .from(chatSession)
      .where(and(eq(chatSession.chatId, chatConfig.id), gte(chatSession.startedAt, startDate)))

    // Calculate summary metrics
    const totalMessages = analytics.reduce((sum, a) => sum + a.totalMessages, 0)
    const totalUsers = new Set(sessions.map((s) => s.sessionToken)).size
    const avgResponseTime =
      analytics.length > 0
        ? Math.round(analytics.reduce((sum, a) => sum + a.avgResponseTime, 0) / analytics.length)
        : 0
    const totalErrors = analytics.reduce((sum, a) => sum + a.totalErrors, 0)
    const errorRate =
      totalMessages > 0 ? parseFloat(((totalErrors / totalMessages) * 100).toFixed(2)) : 0

    // Get message count by day
    const messagesByDay = analytics.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      total: a.totalMessages,
      user: a.userMessages,
      bot: a.botMessages,
    }))

    // Get user metrics
    const userMetrics = {
      total: totalUsers,
      new: analytics.reduce((sum, a) => sum + a.newUsers, 0),
      returning: analytics.reduce((sum, a) => sum + a.returningUsers, 0),
    }

    // Get feedback metrics
    const totalPositive = analytics.reduce((sum, a) => sum + a.positiveFeedback, 0)
    const totalNegative = analytics.reduce((sum, a) => sum + a.negativeFeedback, 0)
    const satisfactionRate =
      totalPositive + totalNegative > 0
        ? parseFloat(((totalPositive / (totalPositive + totalNegative)) * 100).toFixed(2))
        : 0

    // Get average session duration
    const completedSessions = sessions.filter((s) => s.duration !== null)
    const avgSessionDuration =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) /
              completedSessions.length
          )
        : 0

    // Response time distribution
    const responseTimeDistribution = {
      fast: analytics.filter((a) => a.avgResponseTime < 1000).length,
      medium: analytics.filter((a) => a.avgResponseTime >= 1000 && a.avgResponseTime < 3000).length,
      slow: analytics.filter((a) => a.avgResponseTime >= 3000).length,
    }

    return createSuccessResponse({
      summary: {
        totalMessages,
        totalUsers,
        avgResponseTime,
        errorRate,
        satisfactionRate,
        avgSessionDuration,
      },
      messagesByDay,
      userMetrics,
      responseTimeDistribution,
      feedback: {
        positive: totalPositive,
        negative: totalNegative,
        rate: satisfactionRate,
      },
      analytics: analytics.map((a) => ({
        id: a.id,
        date: a.date,
        hour: a.hour,
        totalMessages: a.totalMessages,
        userMessages: a.userMessages,
        botMessages: a.botMessages,
        uniqueUsers: a.uniqueUsers,
        newUsers: a.newUsers,
        returningUsers: a.returningUsers,
        avgResponseTime: a.avgResponseTime,
        minResponseTime: a.minResponseTime,
        maxResponseTime: a.maxResponseTime,
        totalErrors: a.totalErrors,
        errorRate: parseFloat(a.errorRate),
        avgMessagesPerUser: parseFloat(a.avgMessagesPerUser),
        avgSessionDuration: a.avgSessionDuration,
        positiveFeedback: a.positiveFeedback,
        negativeFeedback: a.negativeFeedback,
        feedbackRate: parseFloat(a.feedbackRate),
        metadata: a.metadata,
      })),
    })
  } catch (error: any) {
    logger.error('Error fetching analytics:', error)
    return createErrorResponse(error.message || 'Failed to fetch analytics', 500)
  }
}
