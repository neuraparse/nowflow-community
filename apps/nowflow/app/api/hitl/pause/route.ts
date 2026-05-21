import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlPausedExecution } from '@/db/schema'

const logger = createLogger('HITLPauseAPI')

// Check if request is from internal service (executor calling via fetch)
function isInternalServiceCall(request: NextRequest): boolean {
  // Only trust explicit internal service token — no origin-based bypass
  const internalToken = request.headers.get('x-internal-service-token')
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || process.env.AUTH_SECRET

  if (internalToken && expectedToken) {
    try {
      const a = Buffer.from(internalToken)
      const b = Buffer.from(expectedToken)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  return false
}

/**
 * POST /api/hitl/pause
 * Save paused execution state when workflow pauses for HITL
 */
export async function POST(request: NextRequest) {
  try {
    // Allow internal service calls without session
    const isInternal = isInternalServiceCall(request)

    if (!isInternal) {
      const session = await getSession()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const { hitlRequestId, workflowId, executionId, executionState } = body

    if (!hitlRequestId || !workflowId || !executionState) {
      return NextResponse.json(
        { error: 'Missing required fields: hitlRequestId, workflowId, executionState' },
        { status: 400 }
      )
    }

    // Check if already exists
    const [existing] = await db
      .select()
      .from(hitlPausedExecution)
      .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))
      .limit(1)

    if (existing) {
      // Update existing
      await db
        .update(hitlPausedExecution)
        .set({
          executionState,
        })
        .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))

      logger.info('Updated paused execution state', { hitlRequestId, workflowId })
    } else {
      // Insert new
      await db.insert(hitlPausedExecution).values({
        id: uuidv4(),
        hitlRequestId,
        workflowId,
        executionId: executionId || workflowId,
        executionState,
        pausedAt: new Date(),
      })

      logger.info('Saved paused execution state', { hitlRequestId, workflowId })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to save paused execution', { error: error.message })
    return NextResponse.json(
      { error: error.message || 'Failed to save paused execution' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/hitl/pause
 * Get paused execution state
 */
export async function GET(request: NextRequest) {
  try {
    // Allow internal service calls without session
    const isInternal = isInternalServiceCall(request)

    if (!isInternal) {
      const session = await getSession()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const hitlRequestId = searchParams.get('hitlRequestId')

    if (!hitlRequestId) {
      return NextResponse.json({ error: 'hitlRequestId is required' }, { status: 400 })
    }

    const [paused] = await db
      .select()
      .from(hitlPausedExecution)
      .where(eq(hitlPausedExecution.hitlRequestId, hitlRequestId))
      .limit(1)

    if (!paused) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: paused.id,
        hitlRequestId: paused.hitlRequestId,
        workflowId: paused.workflowId,
        executionId: paused.executionId,
        executionState: paused.executionState,
        pausedAt: paused.pausedAt,
        resumedAt: paused.resumedAt,
      },
    })
  } catch (error: any) {
    logger.error('Failed to get paused execution', { error: error.message })
    return NextResponse.json(
      { error: error.message || 'Failed to get paused execution' },
      { status: 500 }
    )
  }
}
