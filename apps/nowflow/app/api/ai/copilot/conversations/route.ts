import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { copilotConversation } from '@/db/schema'

const logger = createLogger('CopilotConversations')

/**
 * GET /api/ai/copilot/conversations
 *
 * List recent conversations for the current user, optionally filtered by workspace/context.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')
    const context = searchParams.get('context')
    const workflowId = searchParams.get('workflowId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    const conditions = [
      eq(copilotConversation.userId, session.user.id),
      eq(copilotConversation.isActive, true),
      isNull(copilotConversation.deletedAt),
    ]

    if (workspaceId) {
      conditions.push(eq(copilotConversation.workspaceId, workspaceId))
    }
    if (context) {
      conditions.push(eq(copilotConversation.context, context))
    }
    if (workflowId) {
      conditions.push(eq(copilotConversation.workflowId, workflowId))
    }

    const conversations = await db
      .select()
      .from(copilotConversation)
      .where(and(...conditions))
      .orderBy(desc(copilotConversation.updatedAt))
      .limit(limit)

    return NextResponse.json({ success: true, data: conversations })
  } catch (error: any) {
    logger.error('Error listing conversations:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list conversations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/copilot/conversations
 *
 * Create a new conversation.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId, context, workflowId, title } = await req.json()

    if (!context) {
      return NextResponse.json({ success: false, error: 'context is required' }, { status: 400 })
    }

    const newId = crypto.randomUUID()
    const [created] = await db
      .insert(copilotConversation)
      .values({
        id: newId,
        userId: session.user.id,
        workspaceId: workspaceId || null,
        workflowId: workflowId || null,
        context,
        title: title || null,
      })
      .returning()

    return NextResponse.json({ success: true, data: created })
  } catch (error: any) {
    logger.error('Error creating conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
