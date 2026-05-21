import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { copilotConversation, copilotMessage } from '@/db/schema'

const logger = createLogger('CopilotConversationDetail')

/**
 * GET /api/ai/copilot/conversations/[conversationId]
 *
 * Get a single conversation with its messages.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params

    const [conversation] = await db
      .select()
      .from(copilotConversation)
      .where(
        and(
          eq(copilotConversation.id, conversationId),
          eq(copilotConversation.userId, session.user.id),
          isNull(copilotConversation.deletedAt)
        )
      )
      .limit(1)

    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    const messages = await db
      .select()
      .from(copilotMessage)
      .where(eq(copilotMessage.conversationId, conversationId))
      .orderBy(asc(copilotMessage.createdAt))
      .limit(50)

    return NextResponse.json({
      success: true,
      data: { conversation, messages },
    })
  } catch (error: any) {
    logger.error('Error getting conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get conversation' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai/copilot/conversations/[conversationId]
 *
 * Update conversation title.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const { title } = await req.json()

    const [updated] = await db
      .update(copilotConversation)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(copilotConversation.id, conversationId),
          eq(copilotConversation.userId, session.user.id),
          isNull(copilotConversation.deletedAt)
        )
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    logger.error('Error updating conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/copilot/conversations/[conversationId]
 *
 * Soft-delete a conversation.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params

    const [deleted] = await db
      .update(copilotConversation)
      .set({ deletedAt: new Date(), isActive: false })
      .where(
        and(
          eq(copilotConversation.id, conversationId),
          eq(copilotConversation.userId, session.user.id),
          isNull(copilotConversation.deletedAt)
        )
      )
      .returning()

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
