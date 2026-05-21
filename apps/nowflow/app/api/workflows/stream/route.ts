import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { isPubSubReady, subscribeToUserWorkflows } from '@/lib/redis-pubsub'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('WorkflowsStreamAPI')

// Polling intervals: reduced DB load when Pub/Sub delivers updates in real-time
const POLL_INTERVAL_PUBSUB_ACTIVE = 3000 // 3s fallback when Redis is handling delivery (Redis pub/sub pushes instantly, this is safety net)
const POLL_INTERVAL_FALLBACK = 2000 // 2s when Redis is unavailable - fast polling for real-time feel

type WorkflowUpdate = {
  workflowId: string
  lastUpdate: number
  lastRunAt: number
  workspaceId: string
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

  const userId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false
      let isTickRunning = false
      let hasPendingTick = false
      let lastFingerprint = ''
      let pollTimer: ReturnType<typeof setTimeout> | null = null
      let intervalCheckTimer: ReturnType<typeof setInterval> | null = null
      let unsubscribe: (() => void) | null = null
      let currentPollInterval = isPubSubReady()
        ? POLL_INTERVAL_PUBSUB_ACTIVE
        : POLL_INTERVAL_FALLBACK

      const close = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch {
          // ignore
        }
      }

      const fetchWorkflowUpdates = async (): Promise<WorkflowUpdate[]> => {
        // Fetch only the current user's non-deleted workflows
        const rows = await db
          .select({
            id: workflow.id,
            updatedAt: workflow.updatedAt,
            lastRunAt: workflow.lastRunAt,
            workspaceId: workflow.workspaceId,
          })
          .from(workflow)
          .where(and(eq(workflow.userId, userId), isNull(workflow.deletedAt)))

        return rows.map((row: any) => ({
          workflowId: row.id,
          lastUpdate: row.updatedAt?.getTime() || 0,
          lastRunAt: row.lastRunAt?.getTime() || 0,
          workspaceId: row.workspaceId || '',
        }))
      }

      const send = (event: string, data: unknown) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)))
        } catch {
          // Stream closed between check and write
          close()
        }
      }

      const tick = async () => {
        if (isClosed) return

        // If tick is already running, mark that we need another run
        if (isTickRunning) {
          logger.debug(`[${requestId}] Tick already running, marking pending`)
          hasPendingTick = true
          return
        }

        isTickRunning = true
        hasPendingTick = false

        try {
          const updates = await fetchWorkflowUpdates()

          // Create fingerprint from workflow updates
          // Include lastRunAt so execution completions trigger updates
          const fingerprint = updates
            .map((u) => `${u.workflowId}:${u.lastUpdate}:${u.lastRunAt}`)
            .sort()
            .join('|')

          if (fingerprint !== lastFingerprint) {
            const oldFingerprint = lastFingerprint
            lastFingerprint = fingerprint
            send('workflow-update', { updates, timestamp: Date.now() })
            logger.debug(`[${requestId}] Workflow updates sent: ${updates.length} workflows`, {
              changed: oldFingerprint !== '',
              oldFingerprint: oldFingerprint.substring(0, 100),
              newFingerprint: fingerprint.substring(0, 100),
            })
          } else {
            send('ping', { t: Date.now() })
            logger.debug(`[${requestId}] No changes, sending ping`)
          }
        } catch (error) {
          logger.error(`[${requestId}] SSE tick failed`, error)
          send('error', { message: 'stream_error' })
        } finally {
          isTickRunning = false

          // If a tick was requested while we were running, run again
          if (hasPendingTick && !isClosed) {
            logger.debug(`[${requestId}] Running pending tick`)
            setTimeout(() => void tick(), 500)
          }
        }
      }

      // Schedule next poll with current interval, using recursive setTimeout
      // (more flexible than setInterval for adaptive intervals)
      const scheduleNextPoll = () => {
        if (isClosed) return
        pollTimer = setTimeout(() => {
          void tick().finally(scheduleNextPoll)
        }, currentPollInterval)
      }

      // --- Redis Pub/Sub integration ---
      try {
        unsubscribe = subscribeToUserWorkflows(userId, (_message) => {
          logger.debug(`[${requestId}] Pub/Sub message received, triggering immediate update`, {
            event: _message.event,
            workflowId: _message.workflowId,
            timestamp: _message.timestamp,
          })
          // Immediately trigger a DB fetch and push to client
          void tick()
        })
        logger.info(`[${requestId}] Subscribed to Redis Pub/Sub for user ${userId}`)

        // Check immediately if Redis is ready (subscriber might be ready already)
        setTimeout(() => {
          const isReady = isPubSubReady()
          if (isReady && currentPollInterval !== POLL_INTERVAL_PUBSUB_ACTIVE) {
            currentPollInterval = POLL_INTERVAL_PUBSUB_ACTIVE
            if (pollTimer) clearTimeout(pollTimer)
            scheduleNextPoll()
            logger.info(
              `[${requestId}] Redis Pub/Sub is ready, poll interval set to ${currentPollInterval}ms`
            )
          }
        }, 1000) // Check after 1s to allow subscriber to connect
      } catch (subError) {
        logger.warn(`[${requestId}] Failed to subscribe to Pub/Sub, polling only`, subError)
      }

      // Periodically check if poll interval should change based on Redis availability
      // Check every 5s instead of 30s for faster Redis Pub/Sub detection
      intervalCheckTimer = setInterval(() => {
        const newInterval = isPubSubReady() ? POLL_INTERVAL_PUBSUB_ACTIVE : POLL_INTERVAL_FALLBACK
        if (newInterval !== currentPollInterval) {
          currentPollInterval = newInterval
          // Cancel current scheduled poll and reschedule with new interval
          if (pollTimer) clearTimeout(pollTimer)
          scheduleNextPoll()
          logger.info(
            `[${requestId}] Poll interval changed to ${currentPollInterval}ms (Redis Pub/Sub ${isPubSubReady() ? 'active' : 'inactive'})`
          )
        }
      }, 5000)

      // Initial hello + snapshot
      send('hello', { ok: true })
      void tick()

      // Start adaptive polling
      scheduleNextPoll()

      // Cleanup on stream close
      const cleanup = () => {
        if (pollTimer) clearTimeout(pollTimer)
        if (intervalCheckTimer) clearInterval(intervalCheckTimer)
        if (unsubscribe) {
          unsubscribe()
          logger.debug(`[${requestId}] Unsubscribed from Redis Pub/Sub`)
        }
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
