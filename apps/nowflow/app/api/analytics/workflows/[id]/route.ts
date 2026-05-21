import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { chat, deployment, workflow, workflowAnalytics, workflowRun } from '@/db/schema'

const logger = createLogger('WorkflowAnalyticsAPI')

/**
 * GET /api/analytics/workflows/[id]
 * Get analytics for a specific workflow
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId } = await params
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    // Get the workflow
    const [workflowData] = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        isDeployed: workflow.isDeployed,
        runCount: workflow.runCount,
        lastRunAt: workflow.lastRunAt,
        deployedAt: workflow.deployedAt,
      })
      .from(workflow)
      .where(
        and(
          eq(workflow.id, workflowId),
          eq(workflow.userId, session.user.id),
          isNull(workflow.deletedAt)
        )
      )
      .limit(1)

    if (!workflowData) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Get analytics
    const analytics = await db
      .select()
      .from(workflowAnalytics)
      .where(
        and(
          eq(workflowAnalytics.workflowId, workflowId),
          gte(workflowAnalytics.date, startDate),
          lte(workflowAnalytics.date, endDate)
        )
      )
      .orderBy(desc(workflowAnalytics.date))

    // Get API deployments
    const apiDeployments = await db
      .select({
        id: deployment.id,
        workflowId: deployment.workflowId,
        type: deployment.type,
        status: deployment.status,
        deployedAt: deployment.deployedAt,
      })
      .from(deployment)
      .where(eq(deployment.workflowId, workflowId))
      .orderBy(desc(deployment.deployedAt))

    // Get chat deployments
    const chatDeployments = await db
      .select({
        id: chat.id,
        workflowId: chat.workflowId,
        subdomain: chat.subdomain,
        isActive: chat.isActive,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(eq(chat.workflowId, workflowId))
      .orderBy(desc(chat.createdAt))

    // Merge all deployments
    const deployments = [
      ...apiDeployments.map((d: any) => ({
        id: d.id,
        workflowId: d.workflowId,
        type: d.type || 'api',
        status: d.status,
        deployedAt: d.deployedAt,
        subdomain: null,
      })),
      ...chatDeployments.map((d: any) => ({
        id: d.id,
        workflowId: d.workflowId,
        type: 'chat' as const,
        status: d.isActive ? 'active' : 'inactive',
        deployedAt: d.createdAt,
        subdomain: d.subdomain,
      })),
    ].sort((a, b) => {
      const dateA = a.deployedAt ? new Date(a.deployedAt).getTime() : 0
      const dateB = b.deployedAt ? new Date(b.deployedAt).getTime() : 0
      return dateB - dateA
    })

    // Get recent runs
    const recentRuns = await db
      .select({
        id: workflowRun.id,
        workflowId: workflowRun.workflowId,
        status: workflowRun.status,
        executionTime: workflowRun.executionTime,
        metadata: workflowRun.metadata,
        createdAt: workflowRun.createdAt,
      })
      .from(workflowRun)
      .where(
        and(
          eq(workflowRun.workflowId, workflowId),
          gte(workflowRun.createdAt, startDate),
          lte(workflowRun.createdAt, endDate)
        )
      )
      .orderBy(desc(workflowRun.createdAt))
      .limit(100)

    // Aggregate summary
    let totalExecutions = 0
    let successfulExecutions = 0
    let totalLatency = 0
    let latencyCount = 0
    let totalCost = 0
    let totalTokens = 0
    let errorCount = 0
    const modelUsage: Record<string, { tokens: number; cost: number; count: number }> = {}
    const dailyData: Record<
      string,
      { executions: number; cost: number; tokens: number; errors: number }
    > = {}

    analytics.forEach((a: any) => {
      totalExecutions += a.totalExecutions
      successfulExecutions += a.successfulExecutions
      totalCost += Number(a.totalCost) || 0
      totalTokens += a.totalTokens
      errorCount += a.errorCount

      if (a.avgExecutionTime) {
        totalLatency += a.avgExecutionTime * a.totalExecutions
        latencyCount += a.totalExecutions
      }

      // Model usage
      const models = a.modelUsage as Record<string, { tokens: number; cost: number }> | null
      if (models) {
        Object.entries(models).forEach(([model, data]) => {
          if (!modelUsage[model]) {
            modelUsage[model] = { tokens: 0, cost: 0, count: 0 }
          }
          modelUsage[model].tokens += data.tokens || 0
          modelUsage[model].cost += data.cost || 0
          modelUsage[model].count += 1
        })
      }

      // Daily trend
      const dateStr = a.date.toISOString().split('T')[0]
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { executions: 0, cost: 0, tokens: 0, errors: 0 }
      }
      dailyData[dateStr].executions += a.totalExecutions
      dailyData[dateStr].cost += Number(a.totalCost) || 0
      dailyData[dateStr].tokens += a.totalTokens
      dailyData[dateStr].errors += a.errorCount
    })

    // Also aggregate from recent runs for more accurate model usage
    recentRuns.forEach((run: any) => {
      const meta = run.metadata as { model?: string; tokensUsed?: number; cost?: number } | null
      if (meta?.model) {
        if (!modelUsage[meta.model]) {
          modelUsage[meta.model] = { tokens: 0, cost: 0, count: 0 }
        }
        modelUsage[meta.model].tokens += meta.tokensUsed || 0
        modelUsage[meta.model].cost += Number(meta.cost) || 0
        modelUsage[meta.model].count += 1
      }
    })

    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const workflowStats = {
      executions: totalExecutions,
      cost: totalCost,
      tokens: totalTokens,
      errors: errorCount,
    }

    return NextResponse.json({
      success: true,
      data: {
        analytics: analytics.map((a: any) => ({
          workflowId: a.workflowId,
          date: a.date,
          hour: a.hour,
          totalExecutions: a.totalExecutions,
          successfulExecutions: a.successfulExecutions,
          failedExecutions: a.failedExecutions,
          totalTokens: a.totalTokens,
          totalCost: Number(a.totalCost) || 0,
          avgExecutionTime: a.avgExecutionTime,
          errorCount: a.errorCount,
          modelUsage: a.modelUsage || {},
          triggerBreakdown: a.triggerBreakdown || {},
        })),
        summary: {
          totalExecutions,
          successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
          avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
          totalCost,
          totalTokens,
          errorCount,
        },
        workflows: [
          {
            ...workflowData,
            stats: workflowStats,
          },
        ],
        deployments,
        modelUsage,
        dailyTrend,
        recentRuns: recentRuns.map((run: any) => {
          const meta = run.metadata as { model?: string; tokensUsed?: number; cost?: number } | null
          return {
            id: run.id,
            workflowId: run.workflowId,
            status: run.status,
            executionTime: run.executionTime,
            tokensUsed: meta?.tokensUsed || null,
            cost: Number(meta?.cost) || 0,
            model: meta?.model || null,
            createdAt: run.createdAt,
          }
        }),
      },
    })
  } catch (error) {
    logger.error('Failed to get workflow analytics', { error })
    return NextResponse.json({ error: 'Failed to get analytics' }, { status: 500 })
  }
}
