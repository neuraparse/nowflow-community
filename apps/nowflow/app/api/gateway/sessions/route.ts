import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('GatewaySessionsAPI')

// GET /api/gateway/sessions - List all active gateway sessions
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ sessions: [], total: 0 })
    }

    const gateway = getGatewayService()
    const sessions = await gateway.getActiveSessions(session.user.id)

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        channelId: s.channelId,
        channelType: s.channelType,
        senderId: s.senderId,
        workflowId: s.workflowId,
        messageCount: s.messageHistory?.length || 0,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
      })),
      total: sessions.length,
    })
  } catch (error: any) {
    logger.error('Failed to list sessions', { error: error.message })
    return NextResponse.json({ sessions: [], total: 0 })
  }
}
