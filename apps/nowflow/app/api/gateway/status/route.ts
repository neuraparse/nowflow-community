import { NextRequest, NextResponse } from 'next/server'
import { getGatewayService } from '@/lib/gateway/gateway-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('GatewayStatusAPI')

// GET /api/gateway/status - Get gateway status and health
export async function GET(_request: NextRequest) {
  try {
    const gateway = getGatewayService()
    const status = await gateway.getStatus()

    return NextResponse.json({
      status: 'operational',
      uptime: process.uptime(),
      channels: status.channels,
      activeSessions: status.activeSessions,
      messageStats: status.messageStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Failed to get gateway status', { error: error.message })
    return NextResponse.json(
      { status: 'error', error: 'Failed to get gateway status' },
      { status: 500 }
    )
  }
}
