import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getToolAnalytics } from '@/lib/analytics/analytics-service'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow } from '@/db/schema'

const logger = createLogger('ToolAnalyticsAPI')

/**
 * GET /api/analytics/tools
 * Get tool call analytics across workflows
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

    let workflowIds: string[]

    if (workflowId && workflowId !== 'all') {
      workflowIds = [workflowId]
    } else {
      // Get all user's workflows
      const userWorkflows = await db
        .select({ id: workflow.id })
        .from(workflow)
        .where(and(eq(workflow.userId, session.user.id), isNull(workflow.deletedAt)))
      workflowIds = userWorkflows.map((w: any) => w.id)
    }

    if (workflowIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: { tools: [], slowestTools: [], mostUsedTools: [], errorProneTools: [] },
        },
        {
          headers: { 'Cache-Control': 'private, max-age=300' },
        }
      )
    }

    const analytics = await getToolAnalytics(workflowIds, startDate, endDate)

    return NextResponse.json(
      { success: true, data: analytics },
      {
        headers: { 'Cache-Control': 'private, max-age=300' },
      }
    )
  } catch (error) {
    logger.error('Failed to get tool analytics', { error })
    return NextResponse.json({ error: 'Failed to get tool analytics' }, { status: 500 })
  }
}
