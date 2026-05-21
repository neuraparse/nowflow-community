import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { chat, deployment, workflow } from '@/db/schema'

const logger = createLogger('EmbedAPI')

/**
 * GET /api/embed - Get embed configuration for a deployed workflow or chat
 * Query params: deploymentId or chatId
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const deploymentId = searchParams.get('deploymentId')
    const chatId = searchParams.get('chatId')

    if (!deploymentId && !chatId) {
      return NextResponse.json({ error: 'deploymentId or chatId is required' }, { status: 400 })
    }

    if (chatId) {
      const [chatConfig] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1)

      if (!chatConfig) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      return NextResponse.json({
        type: 'chat',
        config: {
          id: chatConfig.id,
          name: (chatConfig as any).name || 'Chat Widget',
          theme: (chatConfig as any).customization || {},
        },
      })
    }

    if (deploymentId) {
      const [dep] = await db
        .select()
        .from(deployment)
        .where(eq(deployment.id, deploymentId))
        .limit(1)

      if (!dep) {
        return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })
      }

      return NextResponse.json({
        type: 'workflow',
        config: {
          id: dep.id,
          workflowId: dep.workflowId,
        },
      })
    }
  } catch (error) {
    logger.error('Error fetching embed config:', error)
    return NextResponse.json({ error: 'Failed to fetch embed config' }, { status: 500 })
  }
}
