import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { conversation, message } from '@/db/schema'

const logger = createLogger('MessageAPI')

/**
 * GET /api/workflows/[id]/conversations/[conversationId]/messages
 * Get all messages for a conversation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: workflowId, conversationId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify conversation access
    const conversationData = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1)

    if (!conversationData.length) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conv = conversationData[0]

    // Verify ownership and workflow match
    if (conv.userId !== session.user.id || conv.workflowId !== workflowId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all messages for this conversation, ordered chronologically
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(asc(message.createdAt))

    logger.info('Messages retrieved', {
      conversationId,
      workflowId,
      userId: session.user.id,
      count: messages.length,
    })

    return NextResponse.json({
      messages,
    })
  } catch (error: any) {
    logger.error('Failed to get messages', { error: error.message })
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/conversations/[conversationId]/messages
 * Create a new message in a conversation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: workflowId, conversationId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      type,
      content,
      workflowSnapshot = null,
      aiConfig = null,
      intent = null,
      actions = null,
      metadata = {},
    } = body

    // Validate required fields
    if (!type || !content) {
      return NextResponse.json({ error: 'Type and content are required' }, { status: 400 })
    }

    // Validate type
    if (!['user', 'ai', 'system'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be user, ai, or system' },
        { status: 400 }
      )
    }

    // Verify conversation access
    const conversationData = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1)

    if (!conversationData.length) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conv = conversationData[0]

    // Verify ownership and workflow match
    if (conv.userId !== session.user.id || conv.workflowId !== workflowId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create new message
    const messageId = nanoid()
    const now = new Date()

    const newMessage = {
      id: messageId,
      conversationId,
      userId: type === 'user' ? session.user.id : null,
      type,
      content,
      workflowSnapshot,
      aiConfig,
      intent,
      actions,
      metadata,
      createdAt: now,
    }

    await db.insert(message).values(newMessage)

    // Update conversation's updatedAt timestamp
    await db.update(conversation).set({ updatedAt: now }).where(eq(conversation.id, conversationId))

    logger.info('Message created', {
      messageId,
      conversationId,
      workflowId,
      userId: session.user.id,
      type,
      contentLength: content.length,
    })

    return NextResponse.json({
      success: true,
      message: newMessage,
    })
  } catch (error: any) {
    logger.error('Failed to create message', { error: error.message })
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/[id]/conversations/[conversationId]/messages
 * Delete a message (requires messageId query param)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: workflowId, conversationId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    // Verify conversation access
    const conversationData = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1)

    if (!conversationData.length) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conv = conversationData[0]

    // Verify ownership and workflow match
    if (conv.userId !== session.user.id || conv.workflowId !== workflowId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get message
    const messageData = await db.select().from(message).where(eq(message.id, messageId)).limit(1)

    if (!messageData.length) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const msg = messageData[0]

    // Verify message belongs to this conversation
    if (msg.conversationId !== conversationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete message
    await db.delete(message).where(eq(message.id, messageId))

    logger.info('Message deleted', {
      messageId,
      conversationId,
      workflowId,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to delete message', { error: error.message })
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}
