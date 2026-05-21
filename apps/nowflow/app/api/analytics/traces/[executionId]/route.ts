import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { executionTrace } from '@/db/schema'

const logger = createLogger('TraceAPI')

/**
 * GET /api/analytics/traces/[executionId]
 * Get trace spans for a specific execution
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { executionId } = await params

    const [trace] = await db
      .select()
      .from(executionTrace)
      .where(eq(executionTrace.executionId, executionId))
      .limit(1)

    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          spans: trace.spans,
          totalDuration: trace.totalDuration,
          blockCount: trace.blockCount,
        },
      },
      {
        headers: { 'Cache-Control': 'private, max-age=300' },
      }
    )
  } catch (error) {
    logger.error('Failed to get execution trace', { error })
    return NextResponse.json({ error: 'Failed to get trace' }, { status: 500 })
  }
}
