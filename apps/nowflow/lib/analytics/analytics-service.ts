import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowAnalytics, workflowLogs, workflowRun } from '@/db/schema'

const logger = createLogger('AnalyticsService')

export interface AnalyticsData {
  workflowId: string
  date: Date
  hour?: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCost: number
  inputCost: number
  outputCost: number
  avgExecutionTime: number | null
  minExecutionTime: number | null
  maxExecutionTime: number | null
  p50ExecutionTime: number | null
  p95ExecutionTime: number | null
  p99ExecutionTime: number | null
  errorCount: number
  uniqueErrors: number
  modelUsage: Record<string, { tokens: number; cost: number }>
  triggerBreakdown: Record<string, number>
  blockMetrics: Record<string, any>
}

export interface AnalyticsQuery {
  workflowId?: string
  startDate: Date
  endDate: Date
  granularity?: 'hour' | 'day' | 'week' | 'month'
}

export interface ExecutionMetrics {
  executionId: string
  workflowId: string
  success: boolean
  durationMs: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  cost?: number
  model?: string
  trigger?: string
  error?: string
  blockMetrics?: Record<
    string,
    {
      durationMs: number
      tokens?: number
      success: boolean
    }
  >
}

/**
 * Records execution metrics
 */
export async function recordExecution(metrics: ExecutionMetrics): Promise<void> {
  try {
    const now = new Date()
    const dateKey = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const hour = now.getHours()

    // Get or create analytics record for this hour
    const [existing] = await db
      .select()
      .from(workflowAnalytics)
      .where(
        and(
          eq(workflowAnalytics.workflowId, metrics.workflowId),
          eq(workflowAnalytics.date, dateKey),
          eq(workflowAnalytics.hour, hour)
        )
      )
      .limit(1)

    if (existing) {
      // Update existing record
      const modelUsage = (existing.modelUsage as Record<string, any>) || {}
      const triggerBreakdown = (existing.triggerBreakdown as Record<string, number>) || {}
      const blockMetrics = (existing.blockMetrics as Record<string, any>) || {}

      // Update model usage
      if (metrics.model) {
        if (!modelUsage[metrics.model]) {
          modelUsage[metrics.model] = { tokens: 0, cost: 0 }
        }
        modelUsage[metrics.model].tokens += metrics.totalTokens || 0
        modelUsage[metrics.model].cost += metrics.cost || 0
      }

      // Update trigger breakdown
      if (metrics.trigger) {
        triggerBreakdown[metrics.trigger] = (triggerBreakdown[metrics.trigger] || 0) + 1
      }

      // Update block metrics
      if (metrics.blockMetrics) {
        Object.entries(metrics.blockMetrics).forEach(([blockId, blockData]) => {
          if (!blockMetrics[blockId]) {
            blockMetrics[blockId] = {
              executions: 0,
              totalDurationMs: 0,
              totalTokens: 0,
              errors: 0,
            }
          }
          blockMetrics[blockId].executions++
          blockMetrics[blockId].totalDurationMs += blockData.durationMs
          blockMetrics[blockId].totalTokens += blockData.tokens || 0
          if (!blockData.success) blockMetrics[blockId].errors++
        })
      }

      // Calculate new values
      const newTotalExecutions = existing.totalExecutions + 1
      const newSuccessful = existing.successfulExecutions + (metrics.success ? 1 : 0)
      const newFailed = existing.failedExecutions + (metrics.success ? 0 : 1)

      await db
        .update(workflowAnalytics)
        .set({
          totalExecutions: newTotalExecutions,
          successfulExecutions: newSuccessful,
          failedExecutions: newFailed,
          totalPromptTokens: existing.totalPromptTokens + (metrics.promptTokens || 0),
          totalCompletionTokens: existing.totalCompletionTokens + (metrics.completionTokens || 0),
          totalTokens: existing.totalTokens + (metrics.totalTokens || 0),
          totalCost: String(Number(existing.totalCost || 0) + (metrics.cost || 0)),
          errorCount: existing.errorCount + (metrics.error ? 1 : 0),
          modelUsage,
          triggerBreakdown,
          blockMetrics,
          updatedAt: now,
        })
        .where(eq(workflowAnalytics.id, existing.id))
    } else {
      // Create new record
      const modelUsage: Record<string, any> = {}
      const triggerBreakdown: Record<string, number> = {}
      const blockMetrics: Record<string, any> = {}

      if (metrics.model) {
        modelUsage[metrics.model] = {
          tokens: metrics.totalTokens || 0,
          cost: metrics.cost || 0,
        }
      }

      if (metrics.trigger) {
        triggerBreakdown[metrics.trigger] = 1
      }

      if (metrics.blockMetrics) {
        Object.entries(metrics.blockMetrics).forEach(([blockId, blockData]) => {
          blockMetrics[blockId] = {
            executions: 1,
            totalDurationMs: blockData.durationMs,
            totalTokens: blockData.tokens || 0,
            errors: blockData.success ? 0 : 1,
          }
        })
      }

      await db.insert(workflowAnalytics).values({
        id: uuidv4(),
        workflowId: metrics.workflowId,
        date: dateKey,
        hour,
        totalExecutions: 1,
        successfulExecutions: metrics.success ? 1 : 0,
        failedExecutions: metrics.success ? 0 : 1,
        totalPromptTokens: metrics.promptTokens || 0,
        totalCompletionTokens: metrics.completionTokens || 0,
        totalTokens: metrics.totalTokens || 0,
        totalCost: String(metrics.cost || 0),
        avgExecutionTime: metrics.durationMs,
        minExecutionTime: metrics.durationMs,
        maxExecutionTime: metrics.durationMs,
        errorCount: metrics.error ? 1 : 0,
        uniqueErrors: metrics.error ? 1 : 0,
        modelUsage,
        triggerBreakdown,
        blockMetrics,
        createdAt: now,
        updatedAt: now,
      })
    }

    logger.debug('Recorded execution metrics', {
      workflowId: metrics.workflowId,
      executionId: metrics.executionId,
      success: metrics.success,
    })
  } catch (error) {
    logger.error('Failed to record execution metrics', { error })
    // Don't throw - analytics should not break execution
  }
}

/**
 * Gets analytics for a workflow
 */
export async function getWorkflowAnalytics(query: AnalyticsQuery): Promise<AnalyticsData[]> {
  try {
    const conditions = [
      gte(workflowAnalytics.date, query.startDate),
      lte(workflowAnalytics.date, query.endDate),
    ]

    if (query.workflowId) {
      conditions.push(eq(workflowAnalytics.workflowId, query.workflowId))
    }

    const results = await db
      .select()
      .from(workflowAnalytics)
      .where(and(...conditions))
      .orderBy(desc(workflowAnalytics.date))

    return results.map((r: typeof workflowAnalytics.$inferSelect) => ({
      workflowId: r.workflowId,
      date: r.date,
      hour: r.hour || undefined,
      totalExecutions: r.totalExecutions,
      successfulExecutions: r.successfulExecutions,
      failedExecutions: r.failedExecutions,
      totalPromptTokens: r.totalPromptTokens,
      totalCompletionTokens: r.totalCompletionTokens,
      totalTokens: r.totalTokens,
      totalCost: Number(r.totalCost) || 0,
      inputCost: Number(r.inputCost) || 0,
      outputCost: Number(r.outputCost) || 0,
      avgExecutionTime: r.avgExecutionTime,
      minExecutionTime: r.minExecutionTime,
      maxExecutionTime: r.maxExecutionTime,
      p50ExecutionTime: r.p50ExecutionTime,
      p95ExecutionTime: r.p95ExecutionTime,
      p99ExecutionTime: r.p99ExecutionTime,
      errorCount: r.errorCount,
      uniqueErrors: r.uniqueErrors,
      modelUsage: (r.modelUsage as Record<string, { tokens: number; cost: number }>) || {},
      triggerBreakdown: (r.triggerBreakdown as Record<string, number>) || {},
      blockMetrics: (r.blockMetrics as Record<string, any>) || {},
    }))
  } catch (error) {
    logger.error('Failed to get workflow analytics', { query, error })
    throw error
  }
}

/**
 * Gets aggregated analytics summary
 */
export async function getAnalyticsSummary(
  workflowId: string,
  days: number = 30
): Promise<{
  totalExecutions: number
  successRate: number
  avgLatencyMs: number
  totalCost: number
  totalTokens: number
  topModels: Array<{ model: string; usage: number }>
  executionsByTrigger: Record<string, number>
  dailyTrend: Array<{ date: string; executions: number; cost: number }>
}> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const analytics = await getWorkflowAnalytics({
      workflowId,
      startDate,
      endDate: new Date(),
    })

    // Aggregate data
    let totalExecutions = 0
    let successfulExecutions = 0
    let totalLatency = 0
    let latencyCount = 0
    let totalCost = 0
    let totalTokens = 0
    const modelUsage: Record<string, number> = {}
    const triggerBreakdown: Record<string, number> = {}
    const dailyData: Record<string, { executions: number; cost: number }> = {}

    analytics.forEach((a) => {
      totalExecutions += a.totalExecutions
      successfulExecutions += a.successfulExecutions
      totalCost += a.totalCost
      totalTokens += a.totalTokens

      if (a.avgExecutionTime) {
        totalLatency += a.avgExecutionTime * a.totalExecutions
        latencyCount += a.totalExecutions
      }

      // Model usage
      Object.entries(a.modelUsage).forEach(([model, data]) => {
        modelUsage[model] = (modelUsage[model] || 0) + data.tokens
      })

      // Trigger breakdown
      Object.entries(a.triggerBreakdown).forEach(([trigger, count]) => {
        triggerBreakdown[trigger] = (triggerBreakdown[trigger] || 0) + count
      })

      // Daily trend
      const dateStr = a.date.toISOString().split('T')[0]
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { executions: 0, cost: 0 }
      }
      dailyData[dateStr].executions += a.totalExecutions
      dailyData[dateStr].cost += a.totalCost
    })

    const topModels = Object.entries(modelUsage)
      .map(([model, usage]) => ({ model, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5)

    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      totalCost,
      totalTokens,
      topModels,
      executionsByTrigger: triggerBreakdown,
      dailyTrend,
    }
  } catch (error) {
    logger.error('Failed to get analytics summary', { workflowId, error })
    throw error
  }
}

/**
 * Gets cost breakdown by model
 */
export async function getCostBreakdown(
  workflowId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  total: number
  byModel: Record<string, { cost: number; tokens: number; percentage: number }>
  byDay: Array<{ date: string; cost: number }>
}> {
  try {
    const analytics = await getWorkflowAnalytics({
      workflowId,
      startDate,
      endDate,
    })

    let total = 0
    const byModel: Record<string, { cost: number; tokens: number }> = {}
    const byDay: Record<string, number> = {}

    analytics.forEach((a) => {
      total += a.totalCost

      // By model
      Object.entries(a.modelUsage).forEach(([model, data]) => {
        if (!byModel[model]) {
          byModel[model] = { cost: 0, tokens: 0 }
        }
        byModel[model].cost += data.cost
        byModel[model].tokens += data.tokens
      })

      // By day
      const dateStr = a.date.toISOString().split('T')[0]
      byDay[dateStr] = (byDay[dateStr] || 0) + a.totalCost
    })

    // Add percentages
    const byModelWithPercentage = Object.fromEntries(
      Object.entries(byModel).map(([model, data]) => [
        model,
        { ...data, percentage: total > 0 ? (data.cost / total) * 100 : 0 },
      ])
    )

    return {
      total,
      byModel: byModelWithPercentage,
      byDay: Object.entries(byDay)
        .map(([date, cost]) => ({ date, cost }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  } catch (error) {
    logger.error('Failed to get cost breakdown', { workflowId, error })
    throw error
  }
}

/**
 * Gets latency percentiles
 */
export async function getLatencyMetrics(
  workflowId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  avg: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
  histogram: Array<{ bucket: string; count: number }>
}> {
  try {
    // Use database-level aggregation for percentiles and stats
    const percentiles = await db.execute(sql`
      SELECT
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time), 0) as p50,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time), 0) as p95,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time), 0) as p99,
        COALESCE(AVG(execution_time), 0) as avg_time,
        COALESCE(MIN(execution_time), 0) as min_time,
        COALESCE(MAX(execution_time), 0) as max_time,
        COUNT(*) as total_count
      FROM workflow_run
      WHERE workflow_id = ${workflowId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND execution_time IS NOT NULL
    `)

    const stats = percentiles.rows[0] as {
      p50: string | number
      p95: string | number
      p99: string | number
      avg_time: string | number
      min_time: string | number
      max_time: string | number
      total_count: string | number
    }

    if (Number(stats.total_count) === 0) {
      return {
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        histogram: [],
      }
    }

    // Use database-level histogram aggregation
    const histogramResult = await db.execute(sql`
      SELECT
        CASE
          WHEN execution_time < 100 THEN '<100ms'
          WHEN execution_time < 500 THEN '100-500ms'
          WHEN execution_time < 1000 THEN '500ms-1s'
          WHEN execution_time < 5000 THEN '1-5s'
          WHEN execution_time < 10000 THEN '5-10s'
          ELSE '>10s'
        END as bucket,
        COUNT(*) as count
      FROM workflow_run
      WHERE workflow_id = ${workflowId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND execution_time IS NOT NULL
      GROUP BY bucket
    `)

    // Map histogram results into ordered buckets
    const bucketOrder = ['<100ms', '100-500ms', '500ms-1s', '1-5s', '5-10s', '>10s']
    const histogramMap: Record<string, number> = {}
    for (const row of histogramResult.rows as Array<{ bucket: string; count: string | number }>) {
      histogramMap[row.bucket] = Number(row.count)
    }
    const histogram = bucketOrder.map((bucket) => ({
      bucket,
      count: histogramMap[bucket] || 0,
    }))

    return {
      avg: Number(stats.avg_time),
      min: Number(stats.min_time),
      max: Number(stats.max_time),
      p50: Number(stats.p50),
      p95: Number(stats.p95),
      p99: Number(stats.p99),
      histogram,
    }
  } catch (error) {
    logger.error('Failed to get latency metrics', { workflowId, error })
    throw error
  }
}

/**
 * Gets error analysis
 */
export async function getErrorAnalysis(
  workflowId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalErrors: number
  errorRate: number
  topErrors: Array<{ error: string; count: number; percentage: number }>
  errorsByDay: Array<{ date: string; count: number }>
}> {
  try {
    // Use database-level aggregation for counts
    const [totalsResult] = await db
      .select({
        totalRuns: sql`count(*)`.mapWith(Number),
        totalErrors:
          sql`count(*) FILTER (WHERE ${workflowRun.status} IN ('failed', 'error'))`.mapWith(Number),
      })
      .from(workflowRun)
      .where(
        and(
          eq(workflowRun.workflowId, workflowId),
          gte(workflowRun.createdAt, startDate),
          lte(workflowRun.createdAt, endDate)
        )
      )

    const totalRuns = Number(totalsResult?.totalRuns ?? 0)
    const totalErrors = Number(totalsResult?.totalErrors ?? 0)
    const errorRate = totalRuns > 0 ? (totalErrors / totalRuns) * 100 : 0

    // Use database-level grouping for error breakdown
    const errorBreakdown = await db
      .select({
        error: workflowRun.error,
        count: sql`count(*)`.mapWith(Number),
        lastOccurred: sql`max(${workflowRun.createdAt})`,
      })
      .from(workflowRun)
      .where(
        and(
          eq(workflowRun.workflowId, workflowId),
          gte(workflowRun.createdAt, startDate),
          lte(workflowRun.createdAt, endDate),
          sql`${workflowRun.status} IN ('failed', 'error')`
        )
      )
      .groupBy(workflowRun.error)
      .orderBy(sql`count(*) DESC`)
      .limit(20)

    const topErrors = errorBreakdown
      .map((row: { error: string | null; count: number; lastOccurred: unknown }) => ({
        error: row.error || 'Unknown error',
        count: Number(row.count),
        percentage: totalErrors > 0 ? (Number(row.count) / totalErrors) * 100 : 0,
      }))
      .slice(0, 10)

    // Use database-level grouping for errors by day
    const errorsByDayResult = await db
      .select({
        date: sql`to_char(${workflowRun.createdAt}, 'YYYY-MM-DD')`.mapWith(String),
        count: sql`count(*)`.mapWith(Number),
      })
      .from(workflowRun)
      .where(
        and(
          eq(workflowRun.workflowId, workflowId),
          gte(workflowRun.createdAt, startDate),
          lte(workflowRun.createdAt, endDate),
          sql`${workflowRun.status} IN ('failed', 'error')`
        )
      )
      .groupBy(sql`to_char(${workflowRun.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${workflowRun.createdAt}, 'YYYY-MM-DD') ASC`)

    return {
      totalErrors,
      errorRate,
      topErrors,
      errorsByDay: errorsByDayResult.map((row: { date: string; count: number }) => ({
        date: String(row.date),
        count: Number(row.count),
      })),
    }
  } catch (error) {
    logger.error('Failed to get error analysis', { workflowId, error })
    throw error
  }
}

/**
 * Gets tool call analytics from workflow logs
 */
export async function getToolAnalytics(
  workflowIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{
  tools: Array<{
    name: string
    totalCalls: number
    avgDuration: number
    errorCount: number
    errorRate: number
    totalTokens: number
  }>
  slowestTools: Array<{ name: string; avgDuration: number }>
  mostUsedTools: Array<{ name: string; totalCalls: number }>
  errorProneTools: Array<{ name: string; errorRate: number; errorCount: number }>
}> {
  try {
    const logs = await db
      .select({
        metadata: workflowLogs.metadata,
      })
      .from(workflowLogs)
      .where(
        and(
          inArray(workflowLogs.workflowId, workflowIds),
          gte(workflowLogs.createdAt, startDate),
          lte(workflowLogs.createdAt, endDate)
        )
      )

    const toolStats: Record<
      string,
      {
        totalCalls: number
        totalDuration: number
        errorCount: number
        totalTokens: number
      }
    > = {}

    logs.forEach((log: { metadata: unknown }) => {
      const meta = log.metadata as {
        toolCalls?: Array<{
          name?: string
          duration?: number
          error?: string | boolean
          tokens?: number
        }>
      } | null
      if (!meta?.toolCalls || !Array.isArray(meta.toolCalls)) return

      meta.toolCalls.forEach((tc) => {
        const name = tc.name || 'unknown'
        if (!toolStats[name]) {
          toolStats[name] = { totalCalls: 0, totalDuration: 0, errorCount: 0, totalTokens: 0 }
        }
        toolStats[name].totalCalls++
        toolStats[name].totalDuration += tc.duration || 0
        if (tc.error) toolStats[name].errorCount++
        toolStats[name].totalTokens += tc.tokens || 0
      })
    })

    const tools = Object.entries(toolStats).map(([name, stats]) => ({
      name,
      totalCalls: stats.totalCalls,
      avgDuration: stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0,
      errorCount: stats.errorCount,
      errorRate: stats.totalCalls > 0 ? (stats.errorCount / stats.totalCalls) * 100 : 0,
      totalTokens: stats.totalTokens,
    }))

    return {
      tools: tools.sort((a, b) => b.totalCalls - a.totalCalls),
      slowestTools: [...tools].sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 5),
      mostUsedTools: [...tools].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 5),
      errorProneTools: [...tools]
        .filter((t) => t.errorCount > 0)
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 5),
    }
  } catch (error) {
    logger.error('Failed to get tool analytics', { error })
    throw error
  }
}

/**
 * Gets block-level performance analytics
 */
export async function getBlockAnalytics(
  workflowIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{
  blocks: Array<{
    blockId: string
    blockName: string
    blockType: string
    totalExecutions: number
    avgDuration: number
    errorRate: number
    totalTokens: number
  }>
  bottlenecks: Array<{ blockId: string; blockName: string; avgDuration: number }>
}> {
  try {
    // Get analytics with block metrics
    const analyticsData = await db
      .select({
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

    // Get workflow block definitions for names/types
    const workflows = await db
      .select({
        id: workflow.id,
        state: workflow.state,
      })
      .from(workflow)
      .where(inArray(workflow.id, workflowIds))

    // Build block name/type lookup from workflow state
    const blockInfo: Record<string, { name: string; type: string }> = {}
    workflows.forEach((w: { id: string; state: unknown }) => {
      const state = w.state as { blocks?: Record<string, { name?: string; type?: string }> } | null
      if (state?.blocks && typeof state.blocks === 'object') {
        Object.entries(state.blocks).forEach(([blockId, b]) => {
          if (b && typeof b === 'object') {
            blockInfo[blockId] = { name: b.name || blockId.slice(0, 8), type: b.type || 'unknown' }
          }
        })
      }
    })

    // Aggregate block metrics
    const aggregated: Record<
      string,
      { executions: number; totalDurationMs: number; totalTokens: number; errors: number }
    > = {}

    analyticsData.forEach((a: { blockMetrics: unknown }) => {
      const blocks = a.blockMetrics as Record<
        string,
        { executions: number; totalDurationMs: number; totalTokens: number; errors: number }
      > | null
      if (!blocks) return

      Object.entries(blocks).forEach(([blockId, data]) => {
        if (!aggregated[blockId]) {
          aggregated[blockId] = { executions: 0, totalDurationMs: 0, totalTokens: 0, errors: 0 }
        }
        aggregated[blockId].executions += data.executions || 0
        aggregated[blockId].totalDurationMs += data.totalDurationMs || 0
        aggregated[blockId].totalTokens += data.totalTokens || 0
        aggregated[blockId].errors += data.errors || 0
      })
    })

    const blocks = Object.entries(aggregated).map(([blockId, data]) => ({
      blockId,
      blockName: blockInfo[blockId]?.name || blockId.slice(0, 8),
      blockType: blockInfo[blockId]?.type || 'unknown',
      totalExecutions: data.executions,
      avgDuration: data.executions > 0 ? Math.round(data.totalDurationMs / data.executions) : 0,
      errorRate: data.executions > 0 ? (data.errors / data.executions) * 100 : 0,
      totalTokens: data.totalTokens,
    }))

    return {
      blocks: blocks.sort((a, b) => b.totalExecutions - a.totalExecutions),
      bottlenecks: [...blocks]
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 5)
        .map((b) => ({ blockId: b.blockId, blockName: b.blockName, avgDuration: b.avgDuration })),
    }
  } catch (error) {
    logger.error('Failed to get block analytics', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
