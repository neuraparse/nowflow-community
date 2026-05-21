import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { forecastCosts, getBudgetRecommendations } from '@/lib/analytics/cost-forecaster'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('WorkflowCostAPI')

/**
 * GET /api/analytics/workflows/[id]/cost
 * Get cost forecast and budget recommendations
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)

    const forecastDays = parseInt(searchParams.get('forecastDays') || '30')
    const monthlyBudget = searchParams.get('budget')
      ? parseFloat(searchParams.get('budget')!)
      : undefined

    const forecast = await forecastCosts(workflowId, forecastDays)

    let budgetRecommendations = null
    if (monthlyBudget) {
      budgetRecommendations = await getBudgetRecommendations(workflowId, monthlyBudget)
    }

    return NextResponse.json({
      success: true,
      data: {
        forecast,
        budgetRecommendations,
      },
    })
  } catch (error) {
    logger.error('Failed to get cost forecast', { error })
    return NextResponse.json({ error: 'Failed to get cost forecast' }, { status: 500 })
  }
}
