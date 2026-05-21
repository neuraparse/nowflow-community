import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { userNotificationChannel } from '@/db/schema'

const logger = createLogger('NotificationChannelsAPI')

// GET /api/user/notification-channels - List user's notification channel configs
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ channels: [] })
    }

    const channels = await db
      .select()
      .from(userNotificationChannel)
      .where(eq(userNotificationChannel.userId, session.user.id))

    return NextResponse.json({ channels })
  } catch (error: any) {
    logger.error('Failed to list notification channels', { error: error.message })
    return NextResponse.json({ channels: [] })
  }
}

// POST /api/user/notification-channels - Create or update a notification channel config
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel, config, enabled, categories } = body

    if (!channel) {
      return NextResponse.json({ error: 'Missing channel' }, { status: 400 })
    }

    // Upsert - update if exists, insert if not
    const existing = await db
      .select()
      .from(userNotificationChannel)
      .where(
        and(
          eq(userNotificationChannel.userId, session.user.id),
          eq(userNotificationChannel.channel, channel)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      const updates: Record<string, any> = { updatedAt: new Date() }
      if (config !== undefined) updates.config = config
      if (enabled !== undefined) updates.enabled = enabled
      if (categories !== undefined) updates.categories = categories

      const [updated] = await db
        .update(userNotificationChannel)
        .set(updates)
        .where(
          and(
            eq(userNotificationChannel.userId, session.user.id),
            eq(userNotificationChannel.channel, channel)
          )
        )
        .returning()

      return NextResponse.json({ channel: updated })
    }

    const [created] = await db
      .insert(userNotificationChannel)
      .values({
        userId: session.user.id,
        channel,
        config: config || {},
        enabled: enabled !== undefined ? enabled : true,
        categories: categories || [],
      })
      .returning()

    return NextResponse.json({ channel: created }, { status: 201 })
  } catch (error: any) {
    logger.error('Failed to save notification channel', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
