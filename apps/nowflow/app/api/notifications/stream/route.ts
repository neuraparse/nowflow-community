import { NextRequest, NextResponse } from 'next/server'
import { and, count, desc, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { userNotification, userNotificationRecipient } from '@/db/schema'

const logger = createLogger('NotificationsStreamAPI')

type Payload = {
  unreadCount: number
  notifications: Array<{
    recipientId: string
    notificationId: string
    title: string
    message: string
    type: string
    actionUrl: string | null
    createdAt: string
    isRead: boolean
    readAt: string | null
  }>
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false
      let lastFingerprint = ''

      const close = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch {
          // ignore
        }
      }

      const fetchSnapshot = async (): Promise<Payload> => {
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
          .limit(10)

        const notifications = rows.map((row: any) => ({
          recipientId: row.recipientId,
          notificationId: row.notificationId,
          title: row.title,
          message: row.message,
          type: row.type,
          actionUrl: row.actionUrl || null,
          createdAt: row.createdAt.toISOString(),
          isRead: row.isRead,
          readAt: row.readAt ? row.readAt.toISOString() : null,
        }))

        const [unread] = await db
          .select({ count: count() })
          .from(userNotificationRecipient)
          .where(
            and(
              eq(userNotificationRecipient.userId, session.user.id),
              eq(userNotificationRecipient.isRead, false)
            )
          )

        return { notifications, unreadCount: Number(unread?.count || 0) }
      }

      const send = (event: string, data: unknown) => {
        if (isClosed || request.signal.aborted) return false

        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)))
          return true
        } catch (error) {
          if (!isAbortLikeError(error, request.signal)) {
            logger.debug(`[${requestId}] SSE send skipped after stream closed`)
          }
          close()
          return false
        }
      }

      const tick = async () => {
        if (isClosed || request.signal.aborted) return

        try {
          const snapshot = await fetchSnapshot()
          if (isClosed || request.signal.aborted) return

          const fingerprint = `${snapshot.unreadCount}:${snapshot.notifications
            .slice(0, 5)
            .map((n) => `${n.recipientId}:${n.isRead}`)
            .join('|')}`

          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint
            send('update', snapshot)
          } else {
            send('ping', { t: Date.now() })
          }
        } catch (error) {
          if (isClosed || request.signal.aborted || isAbortLikeError(error, request.signal)) {
            return
          }

          logger.error(`[${requestId}] SSE tick failed`, error)
          send('error', { message: 'stream_error' })
        }
      }

      // Initial hello + snapshot
      send('hello', { ok: true })
      void tick()

      const interval = setInterval(() => {
        void tick()
      }, 3000)

      // Ensure interval cleared on close
      const cleanup = () => {
        clearInterval(interval)
        close()
      }

      request.signal.addEventListener('abort', cleanup, { once: true })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
