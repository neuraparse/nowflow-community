import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createReplaySession,
  getCurrentReplayState,
  getExecutionStats,
  getTimeline,
  jumpToStep,
  ReplaySession,
} from '@/lib/debug/replay-engine'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DebugReplayAPI')

// In-memory session store (in production, use Redis or similar)
const replaySessions = new Map<string, ReplaySession>()

/**
 * POST /api/workflows/[id]/debug/replay
 * Create or control a replay session
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const body = await request.json()
    const action = body.action || 'create'

    switch (action) {
      case 'create': {
        if (!body.executionId) {
          return NextResponse.json({ error: 'executionId is required' }, { status: 400 })
        }

        const replaySession = await createReplaySession(body.executionId)

        // Store session with a generated ID
        const sessionId = `${workflowId}-${body.executionId}-${Date.now()}`
        replaySessions.set(sessionId, replaySession)

        return NextResponse.json({
          success: true,
          data: {
            sessionId,
            ...replaySession,
            currentState: getCurrentReplayState(replaySession),
            timeline: getTimeline(replaySession),
            stats: getExecutionStats(replaySession),
          },
        })
      }

      case 'step': {
        if (!body.sessionId || body.targetStep === undefined) {
          return NextResponse.json(
            { error: 'sessionId and targetStep are required' },
            { status: 400 }
          )
        }

        const replaySession = replaySessions.get(body.sessionId)
        if (!replaySession) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const state = jumpToStep(replaySession, body.targetStep)

        return NextResponse.json({
          success: true,
          data: state,
        })
      }

      case 'get': {
        if (!body.sessionId) {
          return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
        }

        const replaySession = replaySessions.get(body.sessionId)
        if (!replaySession) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          data: {
            sessionId: body.sessionId,
            ...replaySession,
            currentState: getCurrentReplayState(replaySession),
            timeline: getTimeline(replaySession),
            stats: getExecutionStats(replaySession),
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use create, step, or get' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Failed to handle replay', { error })
    return NextResponse.json({ error: 'Failed to handle replay' }, { status: 500 })
  }
}
