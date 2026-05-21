import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { conversation, message, workflow } from '@/db/schema'

const logger = createLogger('ConversationAPI')

/**
 * GET /api/workflows/[id]/conversations
 * Get all conversations for a workflow
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workflow access
    const workflowData = await db
      .select({
        id: workflow.id,
        userId: workflow.userId,
      })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData.length) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const wf = workflowData[0]

    // Check if user owns the workflow
    if (wf.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all conversations for this workflow
    const conversations = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.workflowId, workflowId), eq(conversation.userId, session.user.id)))
      .orderBy(desc(conversation.updatedAt))

    logger.info('Conversations retrieved', {
      workflowId,
      userId: session.user.id,
      count: conversations.length,
    })

    return NextResponse.json({
      conversations,
    })
  } catch (error: any) {
    logger.error('Failed to get conversations', { error: error.message })
    return NextResponse.json({ error: 'Failed to get conversations' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[id]/conversations
 * Create a new conversation for a workflow
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title = 'New Conversation', summary = null } = body

    // Verify workflow access
    const workflowData = await db
      .select({
        id: workflow.id,
        userId: workflow.userId,
        name: workflow.name,
      })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!workflowData.length) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const wf = workflowData[0]

    // Check if user owns the workflow
    if (wf.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create new conversation
    const conversationId = nanoid()
    const now = new Date()

    const newConversation = {
      id: conversationId,
      workflowId,
      userId: session.user.id,
      title,
      summary,
      isActive: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(conversation).values(newConversation)

    // Log conversation creation (avoid cyclic references)
    logger.info('Conversation created', {
      conversationId: String(conversationId),
      workflowId: String(workflowId),
      workflowName: String(wf.name),
      userId: String(session.user.id),
      title: String(title),
    })

    // Return serializable data (convert Dates to strings)
    const responseData = {
      success: true,
      conversation: {
        id: conversationId,
        workflowId: workflowId,
        userId: String(session.user.id),
        title: String(title),
        summary: summary ? String(summary) : null,
        isActive: true,
        metadata: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    logger.error('Failed to create conversation', { error: error.message })
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

/**
 * DELETE /api/workflows/[id]/conversations
 * Delete a conversation (requires conversationId query param)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workflowId } = await params
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 })
    }

    // Get conversation
    const conversationData = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1)

    if (!conversationData.length) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conv = conversationData[0]

    // Verify ownership
    if (conv.userId !== session.user.id || conv.workflowId !== workflowId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete conversation (messages will be cascade deleted)
    await db.delete(conversation).where(eq(conversation.id, conversationId))

    logger.info('Conversation deleted', {
      conversationId,
      workflowId,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to delete conversation', { error: error.message })
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
