import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { copilotConversation, copilotMessage } from '@/db/schema'

const logger = createLogger('CopilotMessages')

/**
 * POST /api/ai/copilot/conversations/[conversationId]/messages
 *
 * Save a single message to a conversation (fire-and-forget from the client).
 * Also updates the conversation's updatedAt and auto-sets title from first user message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const { role, content, context, metadata } = await req.json()

    if (!role) {
      return NextResponse.json({ success: false, error: 'role is required' }, { status: 400 })
    }

    // Verify conversation ownership
    const [conversation] = await db
      .select({ id: copilotConversation.id, title: copilotConversation.title })
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

    // Insert message
    const messageId = crypto.randomUUID()
    await db.insert(copilotMessage).values({
      id: messageId,
      conversationId,
      role,
      content: content || '',
      context: context || null,
      metadata: metadata || {},
    })

    // Update conversation updatedAt + auto-title from first user message
    const updates: Record<string, any> = { updatedAt: new Date() }
    if (!conversation.title && role === 'user') {
      updates.title = content.length > 80 ? content.substring(0, 77) + '...' : content
    }

    await db
      .update(copilotConversation)
      .set(updates)
      .where(eq(copilotConversation.id, conversationId))

    return NextResponse.json({ success: true, data: { id: messageId } })
  } catch (error: any) {
    logger.error('Error saving message:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save message' },
      { status: 500 }
    )
  }
}
