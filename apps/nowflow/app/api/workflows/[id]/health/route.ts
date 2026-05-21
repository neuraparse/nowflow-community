import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowRun } from '@/db/schema'
import { validateWorkflowAccess } from '../../middleware'

const logger = createLogger('WorkflowHealthAPI')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  isDeployed: boolean
  deployedAt: string | null
  uptime: {
    percentage: number
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
  }
  performance: {
    avgExecutionTime: number
    p50: number
    p95: number
    p99: number
  }
  recentErrors: Array<{
    timestamp: string
    error: string
    executionId: string
  }>
  lastExecution: {
    timestamp: string | null
    status: string | null
    executionTime: number | null
  }
  alerts: string[]
}

/**
 * Get workflow health status
 * Following 2025 best practices for deployment monitoring
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const { id } = await params

  try {
    logger.debug(`[${requestId}] Fetching health status for workflow: ${id}`)

    const validation = await validateWorkflowAccess(request, id, false)

    if (validation.error) {
      logger.warn(`[${requestId}] Failed to fetch health status: ${validation.error.message}`)
      return NextResponse.json(
        { error: validation.error.message },
        { status: validation.error.status }
      )
    }

    // Fetch workflow
    const [workflowData] = await db.select().from(workflow).where(eq(workflow.id, id)).limit(1)

    if (!workflowData) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // If not deployed, return basic status
    if (!workflowData.isDeployed) {
      return NextResponse.json({
        status: 'unknown',
        isDeployed: false,
        deployedAt: null,
        message: 'Workflow is not deployed',
      })
    }

    // Fetch execution history (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    let executions: any[] = []
    try {
      executions = await db
        .select()
        .from(workflowRun)
        .where(and(eq(workflowRun.workflowId, id), gte(workflowRun.createdAt, sevenDaysAgo)))
        .orderBy(desc(workflowRun.createdAt))
        .limit(100)
    } catch (error) {
      logger.debug('WorkflowRun table not available, using empty executions')
    }

    // Calculate health metrics
    const healthStatus = calculateHealthStatus(workflowData, executions)

    logger.info(`[${requestId}] Health status calculated`, {
      workflowId: id,
      status: healthStatus.status,
      uptime: healthStatus.uptime.percentage,
    })

    return NextResponse.json(healthStatus)
  } catch (error: any) {
    logger.error(`[${requestId}] Error fetching health status: ${id}`, error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch health status' },
      { status: 500 }
    )
  }
}

/**
 * Calculate health status from execution history
 */
function calculateHealthStatus(workflowData: any, executions: any[]): HealthStatus {
  const totalExecutions = executions.length
  const successfulExecutions = executions.filter(
    (e) => e.status === 'success' || e.status === 'completed'
  ).length
  const failedExecutions = executions.filter(
    (e) => e.status === 'failed' || e.status === 'error'
  ).length

  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 100

  // Calculate execution times
  const executionTimes = executions
    .filter((e) => e.executionTime && e.executionTime > 0)
    .map((e) => e.executionTime)
    .sort((a, b) => a - b)

  const avgExecutionTime =
    executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0

  const p50 =
    executionTimes.length > 0 ? executionTimes[Math.floor(executionTimes.length * 0.5)] : 0
  const p95 =
    executionTimes.length > 0 ? executionTimes[Math.floor(executionTimes.length * 0.95)] : 0
  const p99 =
    executionTimes.length > 0 ? executionTimes[Math.floor(executionTimes.length * 0.99)] : 0

  // Get recent errors
  const recentErrors = executions
    .filter((e) => e.status === 'failed' || e.status === 'error')
    .slice(0, 5)
    .map((e) => ({
      timestamp: e.createdAt?.toISOString() || '',
      error: e.error || 'Unknown error',
      executionId: e.id,
    }))

  // Get last execution
  const lastExecution = executions[0]
    ? {
        timestamp: executions[0].createdAt?.toISOString() || null,
        status: executions[0].status || null,
        executionTime: executions[0].executionTime || null,
      }
    : {
        timestamp: null,
        status: null,
        executionTime: null,
      }

  // Determine health status
  let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown'
  const alerts: string[] = []

  if (totalExecutions === 0) {
    status = 'unknown'
    alerts.push('No execution history available')
  } else if (successRate >= 95) {
    status = 'healthy'
  } else if (successRate >= 80) {
    status = 'degraded'
    alerts.push(`Success rate is ${successRate.toFixed(1)}% (below 95%)`)
  } else {
    status = 'unhealthy'
    alerts.push(`Success rate is ${successRate.toFixed(1)}% (critical)`)
  }

  // Check for recent failures
  const recentFailures = executions
    .slice(0, 10)
    .filter((e) => e.status === 'failed' || e.status === 'error')
  if (recentFailures.length >= 5) {
    status = 'unhealthy'
    alerts.push(`${recentFailures.length} failures in last 10 executions`)
  }

  return {
    status,
    isDeployed: workflowData.isDeployed,
    deployedAt: workflowData.deployedAt?.toISOString() || null,
    uptime: {
      percentage: Math.round(successRate * 10) / 10,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
    },
    performance: {
      avgExecutionTime: Math.round(avgExecutionTime),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
    },
    recentErrors,
    lastExecution,
    alerts,
  }
}
