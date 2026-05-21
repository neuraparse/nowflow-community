import { NextResponse } from 'next/server'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { copilotConversation, copilotMessage } from '@/db/schema'

const logger = createLogger('CopilotResolve')

/**
 * POST /api/ai/copilot/conversations/resolve
 *
 * Find the most recent active conversation for the given scope,
 * or create a new one if none exists. Returns conversation + messages.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId, context, workflowId } = await req.json()

    if (!context) {
      return NextResponse.json({ success: false, error: 'context is required' }, { status: 400 })
    }

    const userId = session.user.id

    // Build WHERE conditions for scoped lookup
    const conditions = [
      eq(copilotConversation.userId, userId),
      eq(copilotConversation.context, context),
      eq(copilotConversation.isActive, true),
      isNull(copilotConversation.deletedAt),
    ]

    if (workspaceId) {
      conditions.push(eq(copilotConversation.workspaceId, workspaceId))
    }

    if (workflowId) {
      conditions.push(eq(copilotConversation.workflowId, workflowId))
    }

    // Find the most recent conversation matching this scope
    const [existing] = await db
      .select()
      .from(copilotConversation)
      .where(and(...conditions))
      .orderBy(desc(copilotConversation.updatedAt))
      .limit(1)

    if (existing) {
      // Load messages for this conversation (last 50)
      const messages = await db
        .select()
        .from(copilotMessage)
        .where(eq(copilotMessage.conversationId, existing.id))
        .orderBy(asc(copilotMessage.createdAt))
        .limit(50)

      return NextResponse.json({
        success: true,
        data: {
          conversation: existing,
          messages,
        },
      })
    }

    // No existing conversation — create a new one
    const newId = crypto.randomUUID()
    const [created] = await db
      .insert(copilotConversation)
      .values({
        id: newId,
        userId,
        workspaceId: workspaceId || null,
        workflowId: workflowId || null,
        context,
        title: null,
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        conversation: created,
        messages: [],
      },
    })
  } catch (error: any) {
    logger.error('Error resolving conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resolve conversation' },
      { status: 500 }
    )
  }
}
