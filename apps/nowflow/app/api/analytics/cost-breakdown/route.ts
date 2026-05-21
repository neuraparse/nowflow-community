import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCostBreakdown } from '@/lib/analytics/analytics-service'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('CostBreakdownAPI')

/**
 * GET /api/analytics/cost-breakdown
 * Get cost breakdown by model and day
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })
    }

    // Verify ownership
    const [wf] = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!wf) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const breakdown = await getCostBreakdown(workflowId, startDate, endDate)

    return NextResponse.json(
      { success: true, data: breakdown },
      {
        headers: { 'Cache-Control': 'private, max-age=300' },
      }
    )
  } catch (error) {
    logger.error('Failed to get cost breakdown', { error })
    return NextResponse.json({ error: 'Failed to get cost breakdown' }, { status: 500 })
  }
}
