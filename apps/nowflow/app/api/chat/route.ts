import { NextRequest } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { APP_HOSTNAME } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'
import { getBaseDomain } from '@/lib/urls/utils'
import { encryptSecret } from '@/lib/utils'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import { chat, chatSession, workflow } from '@/db/schema'

const logger = createLogger('ChatAPI')

const chatSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  subdomain: z
    .string()
    .min(1, 'Subdomain is required')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  surface: z
    .enum([
      'chat',
      'portal',
      'console',
      'embedded',
      'form',
      'dashboard',
      'scheduler',
      'kanban',
      'gallery',
      'wizard',
      'voice',
      'custom',
    ])
    .default('chat'),
  customizations: z
    .object({
      // Colors & Branding
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      logoUrl: z.string().optional(),
      faviconUrl: z.string().optional(),
      // Layout & Design
      chatPosition: z.enum(['bottom-right', 'bottom-left', 'center', 'full-screen']).optional(),
      bubbleStyle: z.enum(['rounded', 'sharp', 'minimal']).optional(),
      fontSize: z.enum(['small', 'medium', 'large']).optional(),
      fontFamily: z.string().optional(),
      // Messages
      welcomeMessage: z.string().optional(),
      placeholderText: z.string().optional(),
      headerText: z.string().optional(),
      footerText: z.string().optional(),
      emptyStateMessage: z.string().optional(),
      errorMessage: z.string().optional(),
      // Features
      showTimestamps: z.boolean().optional(),
      showTypingIndicator: z.boolean().optional(),
      enableFileUpload: z.boolean().optional(),
      enableVoiceInput: z.boolean().optional(),
      showPoweredBy: z.boolean().optional(),
      enableFeedback: z.boolean().optional(),
      enableCopyMessage: z.boolean().optional(),
      enableDownloadChat: z.boolean().optional(),
      // Surface type for routing
      surface: z.string().optional(),
      // AI-Generated UI - stores the complete generated UI
      generatedUI: z
        .object({
          componentName: z.string(),
          code: z.string().optional(),
          html: z.string(), // The actual HTML to render
          htmlPreview: z.string().optional(),
          styles: z.string().optional(),
          dependencies: z.array(z.string()).optional(),
          uiType: z.string().optional(),
          industry: z.string().optional(),
          preview: z
            .object({
              title: z.string(),
              description: z.string(),
              features: z.array(z.string()),
            })
            .optional(),
          apiIntegration: z
            .object({
              endpoint: z.string(),
              method: z.string(),
              inputFields: z
                .array(
                  z.object({
                    name: z.string(),
                    type: z.string(),
                    required: z.boolean().optional(),
                  })
                )
                .optional(),
              outputFormat: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .passthrough() // Allow additional fields we haven't explicitly defined
    .optional(),
  responseConfig: z
    .object({
      format: z.enum(['text', 'markdown', 'html', 'json']).optional(),
      maxLength: z.number().optional(),
      temperature: z.number().min(0).max(1).optional(),
      streamResponse: z.boolean().optional(),
      showThinking: z.boolean().optional(),
      includeMetadata: z.boolean().optional(),
      tone: z.enum(['professional', 'friendly', 'casual', 'technical']).optional(),
      language: z.string().optional(),
      customPromptPrefix: z.string().optional(),
      customPromptSuffix: z.string().optional(),
      systemMessage: z.string().optional(),
      defaultOutput: z.string().optional(),
      fallbackMessage: z.string().optional(),
    })
    .optional(),
  authType: z.enum(['public', 'password', 'email']).default('public'),
  password: z.string().optional(),
  allowedEmails: z.array(z.string()).optional().default([]),
  outputConfigs: z
    .array(
      z.object({
        blockId: z.string(),
        path: z.string(),
        label: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  outputBlockId: z.string().optional(),
  outputPath: z.string().optional(),
  analytics: z
    .object({
      enabled: z.boolean().optional(),
      trackUsage: z.boolean().optional(),
      trackUserMessages: z.boolean().optional(),
      retentionDays: z.number().min(1).max(365).optional(),
      webhookUrl: z.string().url().optional().or(z.literal('')),
    })
    .optional(),
  limits: z
    .object({
      rateLimit: z
        .object({
          enabled: z.boolean().optional(),
          requestsPerMinute: z.number().optional(),
          requestsPerHour: z.number().optional(),
          requestsPerDay: z.number().optional(),
        })
        .optional(),
      quotas: z
        .object({
          enabled: z.boolean().optional(),
          monthlyMessageLimit: z.number().optional(),
          perUserDailyLimit: z.number().optional(),
        })
        .optional(),
      ipWhitelist: z.array(z.string()).optional(),
      ipBlacklist: z.array(z.string()).optional(),
    })
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Get workflowId from query parameters
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')

    let deployments
    if (workflowId) {
      // Get chat deployments for specific workflow
      deployments = await db
        .select()
        .from(chat)
        .where(and(eq(chat.userId, session.user.id), eq(chat.workflowId, workflowId)))
    } else {
      // Get all user's chat deployments
      deployments = await db.select().from(chat).where(eq(chat.userId, session.user.id))
    }

    let deploymentsWithUsage = deployments

    if (workflowId && deployments.length > 0) {
      const chatIds = deployments.map((deployment: any) => deployment.id)
      const sessions = await db
        .select({
          chatId: chatSession.chatId,
          startedAt: chatSession.startedAt,
          lastActivityAt: chatSession.lastActivityAt,
          endedAt: chatSession.endedAt,
          duration: chatSession.duration,
          messageCount: chatSession.messageCount,
          feedbackRating: chatSession.feedbackRating,
        })
        .from(chatSession)
        .where(inArray(chatSession.chatId, chatIds))

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const usageByChatId = new Map<string, any>()
      chatIds.forEach((chatId: any) => {
        usageByChatId.set(chatId, {
          totalSessions: 0,
          sessionsToday: 0,
          sessionsThisWeek: 0,
          sessionsThisMonth: 0,
          avgSessionDuration: 0,
          totalMessages: 0,
          messagesPerSession: 0,
          lastSession: null,
          userSatisfaction: 0,
          topQueries: [],
        })
      })

      const durationTotals = new Map<string, { totalSeconds: number; count: number }>()
      const feedbackTotals = new Map<string, { total: number; count: number }>()

      sessions.forEach((session: any) => {
        const usage = usageByChatId.get(session.chatId)
        if (!usage) return

        usage.totalSessions += 1
        if (session.startedAt >= todayStart) usage.sessionsToday += 1
        if (session.startedAt >= weekStart) usage.sessionsThisWeek += 1
        if (session.startedAt >= monthStart) usage.sessionsThisMonth += 1

        usage.totalMessages += session.messageCount || 0

        const sessionEnd = session.endedAt || session.lastActivityAt || session.startedAt
        if (!usage.lastSession || sessionEnd > usage.lastSession) {
          usage.lastSession = sessionEnd
        }

        let sessionDurationSeconds = session.duration || 0
        if (!sessionDurationSeconds && sessionEnd && session.startedAt) {
          sessionDurationSeconds = Math.max(
            0,
            Math.round((sessionEnd.getTime() - session.startedAt.getTime()) / 1000)
          )
        }

        if (sessionDurationSeconds > 0) {
          const durationTotal = durationTotals.get(session.chatId) || {
            totalSeconds: 0,
            count: 0,
          }
          durationTotal.totalSeconds += sessionDurationSeconds
          durationTotal.count += 1
          durationTotals.set(session.chatId, durationTotal)
        }

        if (typeof session.feedbackRating === 'number') {
          const feedbackTotal = feedbackTotals.get(session.chatId) || { total: 0, count: 0 }
          feedbackTotal.total += session.feedbackRating
          feedbackTotal.count += 1
          feedbackTotals.set(session.chatId, feedbackTotal)
        }
      })

      usageByChatId.forEach((usage, chatId) => {
        const durationTotal = durationTotals.get(chatId)
        if (durationTotal && durationTotal.count > 0) {
          usage.avgSessionDuration = Math.round(
            durationTotal.totalSeconds / 60 / durationTotal.count
          )
        }

        if (usage.totalSessions > 0) {
          usage.messagesPerSession =
            Math.round((usage.totalMessages / usage.totalSessions) * 10) / 10
        }

        const feedbackTotal = feedbackTotals.get(chatId)
        if (feedbackTotal && feedbackTotal.count > 0) {
          usage.userSatisfaction = Math.round((feedbackTotal.total / feedbackTotal.count) * 10) / 10
        }
      })

      deploymentsWithUsage = deployments.map((deployment: any) => ({
        ...deployment,
        usage: usageByChatId.get(deployment.id),
      }))
    }

    return createSuccessResponse({ deployments: deploymentsWithUsage })
  } catch (error: any) {
    logger.error('Error fetching chat deployments:', error)
    return createErrorResponse(error.message || 'Failed to fetch chat deployments', 500)
  }
}

export async function POST(request: NextRequest) {
  logger.info('POST /api/chat - Chat deployment request received')

  try {
    const session = await getSession()
    logger.info('Session check:', { hasSession: !!session, userId: session?.user?.id })

    if (!session) {
      logger.warn('POST /api/chat - Unauthorized: No session')
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse and validate request body
    const body = await request.json()
    logger.info('POST /api/chat - Request body:', {
      workflowId: body.workflowId,
      subdomain: body.subdomain,
      title: body.title,
      surface: body.surface,
      hasCustomizations: !!body.customizations,
      customizationsKeys: body.customizations ? Object.keys(body.customizations) : [],
      hasGeneratedUI: !!body.customizations?.generatedUI,
      generatedUIHasHtml: !!body.customizations?.generatedUI?.html,
    })

    try {
      const validatedData = chatSchema.parse(body)

      // Extract validated data
      const {
        workflowId,
        subdomain,
        title,
        description = '',
        surface = 'chat',
        customizations = {},
        responseConfig = {},
        authType = 'public',
        password,
        allowedEmails = [],
        outputConfigs = [],
        outputBlockId,
        outputPath,
        analytics = {},
        limits = {},
      } = validatedData

      // Perform additional validation specific to auth types
      if (authType === 'password' && !password) {
        return createErrorResponse('Password is required when using password protection', 400)
      }

      if (authType === 'email' && (!Array.isArray(allowedEmails) || allowedEmails.length === 0)) {
        return createErrorResponse(
          'At least one email or domain is required when using email access control',
          400
        )
      }

      // Check if subdomain is available
      const existingSubdomain = await db
        .select()
        .from(chat)
        .where(eq(chat.subdomain, subdomain))
        .limit(1)

      if (existingSubdomain.length > 0) {
        return createErrorResponse('Subdomain already in use', 400)
      }

      // Verify the workflow exists and belongs to the user
      const workflowExists = await db
        .select()
        .from(workflow)
        .where(and(eq(workflow.id, workflowId), eq(workflow.userId, session.user.id)))
        .limit(1)

      if (workflowExists.length === 0) {
        return createErrorResponse('Workflow not found or access denied', 404)
      }

      // Verify the workflow is deployed (required for chat deployment)
      if (!workflowExists[0].isDeployed) {
        return createErrorResponse('Workflow must be deployed before creating a chat', 400)
      }

      // Encrypt password if provided
      let encryptedPassword = null
      if (authType === 'password' && password) {
        const { encrypted } = await encryptSecret(password)
        encryptedPassword = encrypted
      }

      // Create the chat deployment
      const id = uuidv4()

      // Log the values we're inserting
      logger.info('Creating chat deployment with values:', {
        workflowId,
        subdomain,
        title,
        authType,
        hasPassword: !!encryptedPassword,
        emailCount: allowedEmails?.length || 0,
        outputConfigsCount: outputConfigs.length,
      })

      // Merge customizations with defaults
      const mergedCustomizations = {
        primaryColor: '#7C3AED', // WCAG AA compliant purple (violet-600)
        welcomeMessage: 'Hi there! How can I help you today?',
        showTimestamps: true,
        showTypingIndicator: true,
        enableCopyMessage: true,
        enableFeedback: true,
        enableDownloadChat: true,
        showPoweredBy: true,
        ...customizations,
      }

      // Merge response config with defaults
      const mergedResponseConfig = {
        format: 'markdown',
        streamResponse: true,
        tone: 'friendly',
        ...responseConfig,
      }

      // Merge analytics config with defaults
      const mergedAnalytics = {
        enabled: true,
        trackUsage: true,
        trackUserMessages: false,
        retentionDays: 30,
        ...analytics,
      }

      // Merge limits config with defaults
      const mergedLimits = {
        rateLimit: {
          enabled: false,
          ...limits.rateLimit,
        },
        quotas: {
          enabled: false,
          ...limits.quotas,
        },
        ipWhitelist: limits.ipWhitelist || [],
        ipBlacklist: limits.ipBlacklist || [],
      }

      // Build outputConfigs from outputBlockId and outputPath if provided
      let finalOutputConfigs = outputConfigs
      if (outputBlockId && outputBlockId !== 'auto' && outputPath) {
        finalOutputConfigs = [
          {
            blockId: outputBlockId,
            path: outputPath,
            label: 'Chat Response',
          },
        ]
        logger.info('Using manual output selection:', { outputBlockId, outputPath })
      } else if (outputBlockId === 'auto' || !outputBlockId) {
        // Auto-detect mode - outputConfigs will be empty and auto-detect will happen at runtime
        finalOutputConfigs = []
        logger.info('Using auto-detect mode for output selection')
      }

      await db.insert(chat).values({
        id,
        workflowId,
        userId: session.user.id,
        subdomain,
        title,
        description: description || '',
        surface,
        customizations: mergedCustomizations,
        responseConfig: mergedResponseConfig,
        isActive: true,
        authType,
        password: encryptedPassword,
        allowedEmails: authType === 'email' ? allowedEmails : [],
        outputConfigs: finalOutputConfigs,
        analytics: mergedAnalytics,
        limits: mergedLimits,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Return successful response with chat URL
      // Both development and production use subdomain routing
      // Development: subdomain.localhost:3000
      // Production: subdomain.<APP_HOSTNAME>
      const isDevelopment = process.env.NODE_ENV === 'development'
      const protocol = isDevelopment ? 'http://' : 'https://'
      const baseDomain = isDevelopment ? 'localhost:3000' : APP_HOSTNAME
      const chatUrl = `${protocol}${subdomain}.${baseDomain}`

      logger.info(`Chat "${title}" deployed successfully at ${chatUrl}`, {
        isDevelopment,
        subdomain,
        baseDomain,
        chatUrl,
      })

      return createSuccessResponse({
        id,
        chatUrl,
        message: 'Chat deployment created successfully',
      })
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorMessage = validationError.issues[0]?.message || 'Invalid request data'
        return createErrorResponse(errorMessage, 400, 'VALIDATION_ERROR')
      }
      throw validationError
    }
  } catch (error: any) {
    logger.error('Error creating chat deployment:', error)
    return createErrorResponse(error.message || 'Failed to create chat deployment', 500)
  }
}
