import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { userNotification, userNotificationRecipient } from '@/db/schema'

const logger = createLogger('NotificationsAPI')

const MarkReadSchema = z
  .object({
    recipientId: z.string().min(1).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.recipientId) || value.all === true, {
    message: 'recipientId or all=true is required',
  })

function toIso(value: Date | null) {
  return value ? value.toISOString() : null
}

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
      .select({
        recipientId: userNotificationRecipient.id,
        notificationId: userNotification.id,
        title: userNotification.title,
        message: userNotification.message,
        type: userNotification.type,
        actionUrl: userNotification.actionUrl,
        createdAt: userNotification.createdAt,
        isRead: userNotificationRecipient.isRead,
        readAt: userNotificationRecipient.readAt,
      })
      .from(userNotificationRecipient)
      .innerJoin(
        userNotification,
        eq(userNotificationRecipient.notificationId, userNotification.id)
      )
      .where(eq(userNotificationRecipient.userId, session.user.id))
      .orderBy(desc(userNotification.createdAt))
      .limit(50)

    const notifications = rows.map((row: any) => ({
      recipientId: row.recipientId,
      notificationId: row.notificationId,
      title: row.title,
      message: row.message,
      type: row.type,
      actionUrl: row.actionUrl || null,
      createdAt: toIso(row.createdAt),
      isRead: row.isRead,
      readAt: toIso(row.readAt),
    }))

    const unreadCount = rows.reduce((acc: any, row: any) => (row.isRead ? acc : acc + 1), 0)

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    logger.error(`[${requestId}] Failed to fetch notifications`, error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = MarkReadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const now = new Date()

    if (parsed.data.all === true) {
      await db
        .update(userNotificationRecipient)
        .set({ isRead: true, readAt: now })
        .where(
          and(
            eq(userNotificationRecipient.userId, session.user.id),
            eq(userNotificationRecipient.isRead, false)
          )
        )

      return NextResponse.json({ success: true })
    }

    await db
      .update(userNotificationRecipient)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(userNotificationRecipient.id, parsed.data.recipientId!),
          eq(userNotificationRecipient.userId, session.user.id)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`[${requestId}] Failed to update notification read state`, error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
