import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { gatewayChannel } from '@/db/schema'

const logger = createLogger('GatewayChannelsAPI')

// GET /api/gateway/channels - List all channels for the user
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ channels: [], total: 0 })
    }

    // Load channels from database for persistence across restarts
    const dbChannels = await db
      .select()
      .from(gatewayChannel)
      .where(eq(gatewayChannel.userId, session.user.id))

    // Also ensure the in-memory gateway is synced
    const gateway = getGatewayService()
    await gateway.loadChannelsFromDB(session.user.id)

    return NextResponse.json({
      channels: dbChannels.map((ch: any) => ({
        id: ch.id,
        type: ch.type,
        name: ch.name,
        status: ch.status,
        settings: ch.settings,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      })),
      total: dbChannels.length,
    })
  } catch (error: any) {
    logger.error('Failed to list channels', { error: error.message })
    // Fall back to in-memory if DB fails
    try {
      const gateway = getGatewayService()
      const allChannels = gateway.getChannels()
      const session = await getSession()
      const userChannels = allChannels.filter((ch) => ch.userId === session?.user?.id)
      return NextResponse.json({
        channels: userChannels.map((ch) => ({
          id: ch.id,
          type: ch.type,
          name: ch.name,
          status: ch.status,
          settings: ch.settings,
          createdAt: ch.createdAt,
          updatedAt: ch.updatedAt,
        })),
        total: userChannels.length,
      })
    } catch {
      return NextResponse.json({ channels: [], total: 0 })
    }
  }
}

// POST /api/gateway/channels - Create/connect a new channel
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, name, credentials, settings } = body

    if (!type || !name || !credentials) {
      return NextResponse.json(
        { error: 'Missing required fields: type, name, credentials' },
        { status: 400 }
      )
    }

    const gateway = getGatewayService()
    const now = new Date()
    const channel = await gateway.connectChannel({
      id: crypto.randomUUID(),
      type,
      name,
      status: 'connecting',
      userId: session.user.id,
      credentials,
      settings: settings || {},
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error: any) {
    logger.error('Failed to create channel', { error: error.message })
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }
}
