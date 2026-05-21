import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logs/console-logger'
import { getRedisClient } from '@/lib/redis'
import { db } from '@/db'

const logger = createLogger('healthAPI')

export async function GET() {
  const services: Record<string, string> = {
    application: 'running',
    database: 'unknown',
    redis: 'unknown',
  }

  try {
    // Test database connection
    await db.execute('SELECT 1')
    services.database = 'connected'
  } catch {
    services.database = 'disconnected'
  }

  try {
    // Test Redis connection
    const redis = getRedisClient()
    if (redis) {
      await redis.ping()
      services.redis = 'connected'
    } else {
      services.redis = 'unavailable'
    }
  } catch {
    services.redis = 'disconnected'
  }

  const isHealthy = services.database === 'connected'

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
    },
    { status: isHealthy ? 200 : 503 }
  )
}
