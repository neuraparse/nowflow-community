import { NextRequest, NextResponse } from 'next/server'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('GatewaySendAPI')

// POST /api/gateway/send - Send a message through a specific channel
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channelId, recipientId, text, media, buttons } = body

    if (!channelId || !recipientId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: channelId, recipientId, text' },
        { status: 400 }
      )
    }

    const gateway = getGatewayService()
    const channelConfig = gateway.getChannelConfig(channelId)
    if (!channelConfig) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const result = await gateway.sendMessage({
      channelId,
      channelType: channelConfig.type,
      recipientId,
      text,
      media,
      buttons,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send message' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error: any) {
    logger.error('Failed to send message', { error: error.message })
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
