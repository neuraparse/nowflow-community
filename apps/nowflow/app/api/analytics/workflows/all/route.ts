import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { chat, deployment, workflow, workflowAnalytics, workflowRun } from '@/db/schema'

const logger = createLogger('AllWorkflowAnalyticsAPI')

/**
 * GET /api/analytics/workflows/all
 * Get analytics for all user's workflows
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    // Validate max 90 day range
    const maxRange = 90 * 24 * 60 * 60 * 1000
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      startDate = new Date(endDate.getTime() - maxRange)
    }

    // Get all user's workflows
    const userWorkflows = await db
      .select({
        id: workflow.id,
        name: workflow.name,
        isDeployed: workflow.isDeployed,
        runCount: workflow.runCount,
        lastRunAt: workflow.lastRunAt,
        deployedAt: workflow.deployedAt,
      })
      .from(workflow)
      .where(and(eq(workflow.userId, session.user.id), isNull(workflow.deletedAt)))
      .orderBy(desc(workflow.lastRunAt))

    if (userWorkflows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            analytics: [],
            summary: {
              totalExecutions: 0,
              successRate: 0,
              avgLatency: 0,
              p50Latency: null,
              p95Latency: null,
              p99Latency: null,
              totalCost: 0,
              totalInputCost: 0,
              totalOutputCost: 0,
              totalTokens: 0,
              totalPromptTokens: 0,
              totalCompletionTokens: 0,
              errorCount: 0,
            },
            blockMetrics: {},
            triggerBreakdown: {},
            workflows: [],
            deployments: [],
            modelUsage: {},
            dailyTrend: [],
          },
        },
        {
          headers: { 'Cache-Control': 'private, max-age=300' },
        }
      )
    }

    const workflowIds = userWorkflows.map((w: any) => w.id)

    // Run independent queries in parallel
    const [analytics, apiDeployments, chatDeployments, recentRuns] = await Promise.all([
      // Get analytics for all workflows (select only needed columns)
      db
        .select({
          workflowId: workflowAnalytics.workflowId,
          date: workflowAnalytics.date,
          hour: workflowAnalytics.hour,
          totalExecutions: workflowAnalytics.totalExecutions,
          successfulExecutions: workflowAnalytics.successfulExecutions,
          failedExecutions: workflowAnalytics.failedExecutions,
          avgExecutionTime: workflowAnalytics.avgExecutionTime,
          p50ExecutionTime: workflowAnalytics.p50ExecutionTime,
          p95ExecutionTime: workflowAnalytics.p95ExecutionTime,
          p99ExecutionTime: workflowAnalytics.p99ExecutionTime,
          totalTokens: workflowAnalytics.totalTokens,
          totalPromptTokens: workflowAnalytics.totalPromptTokens,
          totalCompletionTokens: workflowAnalytics.totalCompletionTokens,
          totalCost: workflowAnalytics.totalCost,
          inputCost: workflowAnalytics.inputCost,
          outputCost: workflowAnalytics.outputCost,
          errorCount: workflowAnalytics.errorCount,
          modelUsage: workflowAnalytics.modelUsage,
          triggerBreakdown: workflowAnalytics.triggerBreakdown,
          blockMetrics: workflowAnalytics.blockMetrics,
        })
        .from(workflowAnalytics)
        .where(
          and(
            inArray(workflowAnalytics.workflowId, workflowIds),
            gte(workflowAnalytics.date, startDate),
            lte(workflowAnalytics.date, endDate)
          )
        )
        .orderBy(desc(workflowAnalytics.date)),

      // Get API deployments
      db
        .select({
          id: deployment.id,
          workflowId: deployment.workflowId,
          type: deployment.type,
          status: deployment.status,
          deployedAt: deployment.deployedAt,
        })
        .from(deployment)
        .where(inArray(deployment.workflowId, workflowIds))
        .orderBy(desc(deployment.deployedAt)),

      // Get chat deployments
      db
        .select({
          id: chat.id,
          workflowId: chat.workflowId,
          subdomain: chat.subdomain,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
        })
        .from(chat)
        .where(inArray(chat.workflowId, workflowIds))
        .orderBy(desc(chat.createdAt)),

      // Get recent runs for detailed breakdown
      db
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
            inArray(workflowRun.workflowId, workflowIds),
            gte(workflowRun.createdAt, startDate),
            lte(workflowRun.createdAt, endDate)
          )
        )
        .orderBy(desc(workflowRun.createdAt))
        .limit(500),
    ])

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

    // Aggregate summary
    let totalExecutions = 0
    let successfulExecutions = 0
    let totalLatency = 0
    let latencyCount = 0
    let totalCost = 0
    let totalTokens = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalInputCost = 0
    let totalOutputCost = 0
    let errorCount = 0
    const allP50: number[] = []
    const allP95: number[] = []
    const allP99: number[] = []
    const aggregatedBlockMetrics: Record<
      string,
      { executions: number; totalDurationMs: number; totalTokens: number; errors: number }
    > = {}
    const aggregatedTriggerBreakdown: Record<string, number> = {}
    const modelUsage: Record<string, { tokens: number; cost: number; count: number }> = {}
    const dailyData: Record<
      string,
      {
        executions: number
        cost: number
        tokens: number
        errors: number
        inputCost: number
        outputCost: number
        promptTokens: number
        completionTokens: number
      }
    > = {}
    const workflowStats: Record<
      string,
      { executions: number; cost: number; tokens: number; errors: number }
    > = {}

    // Initialize workflow stats
    workflowIds.forEach((id: any) => {
      workflowStats[id] = { executions: 0, cost: 0, tokens: 0, errors: 0 }
    })

    analytics.forEach((a: any) => {
      totalExecutions += a.totalExecutions
      successfulExecutions += a.successfulExecutions
      totalCost += Number(a.totalCost) || 0
      totalTokens += a.totalTokens
      totalPromptTokens += a.totalPromptTokens || 0
      totalCompletionTokens += a.totalCompletionTokens || 0
      totalInputCost += Number(a.inputCost) || 0
      totalOutputCost += Number(a.outputCost) || 0
      errorCount += a.errorCount

      if (a.avgExecutionTime) {
        totalLatency += a.avgExecutionTime * a.totalExecutions
        latencyCount += a.totalExecutions
      }

      // Collect percentiles for weighted aggregation
      if (a.p50ExecutionTime != null) allP50.push(a.p50ExecutionTime)
      if (a.p95ExecutionTime != null) allP95.push(a.p95ExecutionTime)
      if (a.p99ExecutionTime != null) allP99.push(a.p99ExecutionTime)

      // Block metrics aggregation
      const blocks = a.blockMetrics as Record<
        string,
        { executions: number; totalDurationMs: number; totalTokens: number; errors: number }
      > | null
      if (blocks) {
        Object.entries(blocks).forEach(([blockId, data]) => {
          if (!aggregatedBlockMetrics[blockId]) {
            aggregatedBlockMetrics[blockId] = {
              executions: 0,
              totalDurationMs: 0,
              totalTokens: 0,
              errors: 0,
            }
          }
          aggregatedBlockMetrics[blockId].executions += data.executions || 0
          aggregatedBlockMetrics[blockId].totalDurationMs += data.totalDurationMs || 0
          aggregatedBlockMetrics[blockId].totalTokens += data.totalTokens || 0
          aggregatedBlockMetrics[blockId].errors += data.errors || 0
        })
      }

      // Trigger breakdown aggregation
      const triggers = a.triggerBreakdown as Record<string, number> | null
      if (triggers) {
        Object.entries(triggers).forEach(([trigger, count]) => {
          aggregatedTriggerBreakdown[trigger] = (aggregatedTriggerBreakdown[trigger] || 0) + count
        })
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

      // Daily trend (enhanced)
      const dateStr = a.date.toISOString().split('T')[0]
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          executions: 0,
          cost: 0,
          tokens: 0,
          errors: 0,
          inputCost: 0,
          outputCost: 0,
          promptTokens: 0,
          completionTokens: 0,
        }
      }
      dailyData[dateStr].executions += a.totalExecutions
      dailyData[dateStr].cost += Number(a.totalCost) || 0
      dailyData[dateStr].tokens += a.totalTokens
      dailyData[dateStr].errors += a.errorCount
      dailyData[dateStr].inputCost += Number(a.inputCost) || 0
      dailyData[dateStr].outputCost += Number(a.outputCost) || 0
      dailyData[dateStr].promptTokens += a.totalPromptTokens || 0
      dailyData[dateStr].completionTokens += a.totalCompletionTokens || 0

      // Workflow stats
      if (workflowStats[a.workflowId]) {
        workflowStats[a.workflowId].executions += a.totalExecutions
        workflowStats[a.workflowId].cost += Number(a.totalCost) || 0
        workflowStats[a.workflowId].tokens += a.totalTokens
        workflowStats[a.workflowId].errors += a.errorCount
      }
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

    // Merge workflow info with stats
    const workflowsWithStats = userWorkflows.map((w: any) => ({
      ...w,
      stats: workflowStats[w.id] || { executions: 0, cost: 0, tokens: 0, errors: 0 },
    }))

    // Calculate aggregated percentiles (median of collected values)
    const medianOf = (arr: number[]) => {
      if (arr.length === 0) return null
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }

    return NextResponse.json(
      {
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
            totalPromptTokens: a.totalPromptTokens || 0,
            totalCompletionTokens: a.totalCompletionTokens || 0,
            totalCost: Number(a.totalCost) || 0,
            inputCost: Number(a.inputCost) || 0,
            outputCost: Number(a.outputCost) || 0,
            avgExecutionTime: a.avgExecutionTime,
            p50ExecutionTime: a.p50ExecutionTime,
            p95ExecutionTime: a.p95ExecutionTime,
            p99ExecutionTime: a.p99ExecutionTime,
            errorCount: a.errorCount,
            modelUsage: a.modelUsage || {},
            triggerBreakdown: a.triggerBreakdown || {},
            blockMetrics: a.blockMetrics || {},
          })),
          summary: {
            totalExecutions,
            successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
            avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
            p50Latency: medianOf(allP50),
            p95Latency: medianOf(allP95),
            p99Latency: medianOf(allP99),
            totalCost,
            totalInputCost,
            totalOutputCost,
            totalTokens,
            totalPromptTokens,
            totalCompletionTokens,
            errorCount,
          },
          blockMetrics: aggregatedBlockMetrics,
          triggerBreakdown: aggregatedTriggerBreakdown,
          workflows: workflowsWithStats,
          deployments,
          modelUsage,
          dailyTrend,
          recentRuns: recentRuns.slice(0, 100).map((run: any) => {
            const meta = run.metadata as {
              model?: string
              tokensUsed?: number
              cost?: number
            } | null
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
      },
      {
        headers: { 'Cache-Control': 'private, max-age=300' },
      }
    )
  } catch (error) {
    logger.error('Failed to get all workflow analytics', { error })
    return NextResponse.json({ error: 'Failed to get analytics' }, { status: 500 })
  }
}
