import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import {
  type CollaborationEvent,
  getCollaborationService,
} from '@/lib/collaboration/collaboration-service'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('CollaborationAPI')

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * GET /api/collaboration/[workflowId]
 * SSE endpoint for real-time collaboration updates (presence, changes, locks)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const userName = session.user.name || 'Anonymous'

  // Authorization: verify user owns or collaborates on this workflow
  const [wf] = await db
    .select({ userId: workflow.userId, collaborators: workflow.collaborators })
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1)
  if (!wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
  const collabs = (wf.collaborators as any[]) || []
  if (wf.userId !== userId && !collabs.some((c: any) => c.userId === userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const encoder = new TextEncoder()
  const service = getCollaborationService()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let isClosed = false
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null

      const close = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }

      const send = (event: string, data: unknown) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)))
        } catch {
          close()
        }
      }

      // Join the workflow session and send initial state
      try {
        await service.joinWorkflow(workflowId, {
          id: userId,
          name: userName,
          avatar: (session.user as any).image,
        })

        const collaborators = await service.getActiveCollaborators(workflowId)
        send('init', { collaborators, timestamp: Date.now() })
      } catch (err) {
        logger.error('Failed to initialize collaboration session', {
          error: err,
          workflowId,
          userId,
        })
        send('error', { message: 'Failed to join collaboration session' })
        close()
        return
      }

      // Subscribe to collaboration events
      const unsubscribe = service.subscribe(workflowId, (event: CollaborationEvent) => {
        // Don't echo back cursor events to the sender
        if (event.type === 'cursor' && event.data.userId === userId) return
        send(event.type, event.data)
      })

      // Heartbeat every 15s – also refreshes presence TTL in Redis
      heartbeatTimer = setInterval(() => {
        send('ping', { t: Date.now() })
        service.refreshPresence(workflowId, userId).catch(() => {})
      }, 15000)

      // Cleanup on disconnect
      const cleanup = async () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        unsubscribe()
        await service.leaveWorkflow(workflowId, userId).catch(() => {})
        close()
        logger.info('Collaboration SSE closed', { workflowId, userId })
      }

      request.signal.addEventListener('abort', () => void cleanup(), { once: true })
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

/**
 * POST /api/collaboration/[workflowId]
 * Send collaboration events: cursor move, block edit, lock/unlock
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const userName = session.user.name || 'Anonymous'

  // Authorization: verify user owns or collaborates on this workflow
  const [wf] = await db
    .select({ userId: workflow.userId, collaborators: workflow.collaborators })
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1)
  if (!wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
  const collabs = (wf.collaborators as any[]) || []
  if (wf.userId !== userId && !collabs.some((c: any) => c.userId === userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action } = body as { action: string }
    const service = getCollaborationService()

    switch (action) {
      case 'cursor': {
        const { blockId, field, position, selectedNodes } = body as {
          blockId: string
          field?: string
          position?: { x: number; y: number }
          selectedNodes?: string[]
        }
        await service.broadcastCursor(
          workflowId,
          { id: userId, name: userName },
          { blockId, field, position, selectedNodes }
        )
        return NextResponse.json({ ok: true })
      }

      case 'change': {
        const { blockId, changes, version } = body as {
          blockId: string
          changes: Record<string, unknown>
          version: number
        }
        await service.broadcastChange(workflowId, {
          blockId,
          userId,
          userName,
          changes,
          timestamp: Date.now(),
          version: version || 1,
        })
        return NextResponse.json({ ok: true })
      }

      case 'lock': {
        const { blockId } = body as { blockId: string }
        const acquired = await service.lockBlock(workflowId, blockId, {
          id: userId,
          name: userName,
        })
        return NextResponse.json({ ok: acquired, locked: acquired })
      }

      case 'unlock': {
        const { blockId } = body as { blockId: string }
        await service.unlockBlock(workflowId, blockId, userId)
        return NextResponse.json({ ok: true })
      }

      // Real-time block/edge sync events - broadcast immediately to all collaborators
      case 'node_move':
      case 'node_add':
      case 'node_remove':
      case 'node_data':
      case 'block_config':
      case 'edge_add':
      case 'edge_remove': {
        await service.broadcastChange(workflowId, {
          blockId: body.nodeId || body.edgeId || '',
          userId,
          userName,
          changes: { action, ...body.payload },
          timestamp: Date.now(),
          version: body.version || 1,
        })
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    // Client-disconnect mid-request (tab close, navigation, network blip) surfaces
    // as ECONNRESET / AbortError inside request.json() or the downstream pubsub.
    // The client is already gone, so a 500 helps no one — log quietly and move on.
    const code = (error as { code?: string } | null)?.code
    const name = (error as { name?: string } | null)?.name
    const isClientGone =
      request.signal.aborted ||
      code === 'ECONNRESET' ||
      code === 'UND_ERR_SOCKET' ||
      name === 'AbortError'
    if (isClientGone) {
      logger.debug('Collaboration POST aborted by client', { workflowId, code })
      return NextResponse.json({ ok: false, aborted: true }, { status: 499 })
    }
    logger.error('Collaboration POST error', { error, workflowId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
