import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { SpendControlService } from '@/lib/billing/spend-control-service'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SpendControlsAPI')
const service = new SpendControlService()

/**
 * GET /api/billing/spend-controls
 * Get current budget status, alerts, and spending breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId') ?? session.user.id
    const workflowId = searchParams.get('workflowId')

    const budgetStatus = service.getBudgetStatus(workspaceId)
    const alertThresholds = service.checkAlertThresholds(workspaceId)
    const alertHistory = service.getAlertHistory(workspaceId)

    const result: Record<string, unknown> = {
      budgetStatus,
      alerts: { ...alertThresholds, history: alertHistory },
    }

    if (workflowId) {
      const workflowSpending = service.getWorkflowSpending(workflowId)
      const trend = await service.getSpendingTrend(workflowId)
      const anomalies = await service.detectAnomalies(workflowId)
      result.workflow = { spending: workflowSpending, trend, anomalies }
    }

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: { 'Cache-Control': 'private, max-age=60' },
      }
    )
  } catch (error) {
    logger.error('Failed to get spend controls', { error })
    return NextResponse.json({ error: 'Failed to get spend controls' }, { status: 500 })
  }
}

/**
 * POST /api/billing/spend-controls
 * Set or update budget limits and alert thresholds
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId = session.user.id,
      budgets,
      workflowBudget,
    } = body as {
      workspaceId?: string
      budgets?: { period: 'daily' | 'weekly' | 'monthly'; limit: number }[]
      workflowBudget?: { workflowId: string; limit: number }
    }

    const results: Record<string, unknown> = {}

    if (budgets && Array.isArray(budgets)) {
      results.budgets = budgets.map((b) => service.setBudgetLimit(workspaceId, b.period, b.limit))
    }

    if (workflowBudget) {
      results.workflowBudget = service.setWorkflowBudget(
        workflowBudget.workflowId,
        workflowBudget.limit
      )
    }

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    logger.error('Failed to set spend controls', { error })
    return NextResponse.json({ error: 'Failed to set spend controls' }, { status: 500 })
  }
}

/**
 * PUT /api/billing/spend-controls
 * Update alert configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId = session.user.id,
      thresholds = [50, 75, 90, 100],
      channels = ['notification'],
      enabled = true,
    } = body as {
      workspaceId?: string
      thresholds?: number[]
      channels?: ('email' | 'slack' | 'notification')[]
      enabled?: boolean
    }

    const config = service.configureAlerts(workspaceId, thresholds, channels, enabled)

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    logger.error('Failed to update alert config', { error })
    return NextResponse.json({ error: 'Failed to update alert configuration' }, { status: 500 })
  }
}
