import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('GatewayChannelAPI')

// GET /api/gateway/channels/:channelId - Get channel details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params
    const gateway = getGatewayService()
    const channel = await gateway.getChannel(channelId)

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ channel })
  } catch (error: any) {
    logger.error('Failed to get channel', { error: error.message })
    return NextResponse.json({ error: 'Failed to get channel' }, { status: 500 })
  }
}

// PATCH /api/gateway/channels/:channelId - Update channel settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params
    const body = await request.json()
    const { name, settings } = body

    const gateway = getGatewayService()
    const updated = await gateway.updateChannel(channelId, { name, settings })

    if (!updated) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ channel: updated })
  } catch (error: any) {
    logger.error('Failed to update channel', { error: error.message })
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
  }
}

// DELETE /api/gateway/channels/:channelId - Disconnect and remove channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params
    const gateway = getGatewayService()
    await gateway.disconnectChannel(channelId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to delete channel', { error: error.message })
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
  }
}
