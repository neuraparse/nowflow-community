import { getWorkflowAnalytics } from '@/lib/analytics/analytics-service'
import { forecastCosts } from '@/lib/analytics/cost-forecaster'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SpendControlService')

type BudgetPeriod = 'daily' | 'weekly' | 'monthly'
type AlertChannel = 'email' | 'slack' | 'notification'

interface BudgetLimit {
  workspaceId: string
  period: BudgetPeriod
  limit: number
  currentSpend: number
  updatedAt: Date
}

interface AlertConfig {
  workspaceId: string
  thresholds: number[]
  channels: AlertChannel[]
  enabled: boolean
}

interface AlertRecord {
  id: string
  workspaceId: string
  threshold: number
  currentSpend: number
  budgetLimit: number
  channel: AlertChannel
  sentAt: Date
  period: BudgetPeriod
}

interface WorkflowBudget {
  workflowId: string
  limit: number
  currentSpend: number
}

interface SpendingTrendPoint {
  date: string
  spend: number
}

// In-memory stores (swap for DB-backed persistence as needed)
const budgetLimits = new Map<string, Map<BudgetPeriod, BudgetLimit>>()
const alertConfigs = new Map<string, AlertConfig>()
const alertHistory: AlertRecord[] = []
const workflowBudgets = new Map<string, WorkflowBudget>()
const pausedWorkflows = new Set<string>()

export class SpendControlService {
  // --------------- Budget Controls ---------------

  setBudgetLimit(workspaceId: string, period: BudgetPeriod, limit: number): BudgetLimit {
    if (limit < 0) throw new Error('Budget limit must be non-negative')

    if (!budgetLimits.has(workspaceId)) {
      budgetLimits.set(workspaceId, new Map())
    }
    const entry: BudgetLimit = {
      workspaceId,
      period,
      limit,
      currentSpend: budgetLimits.get(workspaceId)?.get(period)?.currentSpend ?? 0,
      updatedAt: new Date(),
    }
    budgetLimits.get(workspaceId)!.set(period, entry)
    logger.info('Budget limit set', { workspaceId, period, limit })
    return entry
  }

  checkBudget(
    workspaceId: string,
    period: BudgetPeriod,
    additionalCost: number
  ): {
    allowed: boolean
    remaining: number
    currentSpend: number
    limit: number
  } {
    const entry = budgetLimits.get(workspaceId)?.get(period)
    if (!entry) return { allowed: true, remaining: Infinity, currentSpend: 0, limit: 0 }

    const remaining = entry.limit - entry.currentSpend
    const allowed = entry.currentSpend + additionalCost <= entry.limit
    return { allowed, remaining, currentSpend: entry.currentSpend, limit: entry.limit }
  }

  getBudgetStatus(workspaceId: string): Record<
    BudgetPeriod,
    {
      limit: number
      currentSpend: number
      remaining: number
      utilizationPct: number
    }
  > {
    const periods: BudgetPeriod[] = ['daily', 'weekly', 'monthly']
    const result = {} as ReturnType<SpendControlService['getBudgetStatus']>

    for (const period of periods) {
      const entry = budgetLimits.get(workspaceId)?.get(period)
      const limit = entry?.limit ?? 0
      const currentSpend = entry?.currentSpend ?? 0
      result[period] = {
        limit,
        currentSpend,
        remaining: Math.max(0, limit - currentSpend),
        utilizationPct: limit > 0 ? (currentSpend / limit) * 100 : 0,
      }
    }
    return result
  }

  pauseOnBudgetExceeded(workspaceId: string, workflowIds: string[]): string[] {
    const status = this.getBudgetStatus(workspaceId)
    const paused: string[] = []

    const exceeded = Object.values(status).some((s) => s.limit > 0 && s.currentSpend >= s.limit)
    if (exceeded) {
      for (const id of workflowIds) {
        pausedWorkflows.add(id)
        paused.push(id)
      }
      logger.warn('Workflows paused due to budget exceeded', { workspaceId, count: paused.length })
    }
    return paused
  }

  resumeWorkflows(workflowIds: string[]): string[] {
    const resumed: string[] = []
    for (const id of workflowIds) {
      if (pausedWorkflows.delete(id)) resumed.push(id)
    }
    logger.info('Workflows resumed', { count: resumed.length })
    return resumed
  }

  // --------------- Alert System ---------------

  configureAlerts(
    workspaceId: string,
    thresholds: number[] = [50, 75, 90, 100],
    channels: AlertChannel[] = ['notification'],
    enabled: boolean = true
  ): AlertConfig {
    const config: AlertConfig = {
      workspaceId,
      thresholds: thresholds.sort((a, b) => a - b),
      channels,
      enabled,
    }
    alertConfigs.set(workspaceId, config)
    logger.info('Alert config updated', { workspaceId, thresholds, channels })
    return config
  }

  checkAlertThresholds(workspaceId: string): {
    triggered: boolean
    crossedThresholds: number[]
    currentUtilization: number
  } {
    const config = alertConfigs.get(workspaceId)
    if (!config || !config.enabled) {
      return { triggered: false, crossedThresholds: [], currentUtilization: 0 }
    }

    const status = this.getBudgetStatus(workspaceId)
    const maxUtil = Math.max(...Object.values(status).map((s) => s.utilizationPct))
    const crossed = config.thresholds.filter((t) => maxUtil >= t)

    if (crossed.length > 0) {
      for (const threshold of crossed) {
        const alreadySent = alertHistory.some(
          (a) =>
            a.workspaceId === workspaceId &&
            a.threshold === threshold &&
            a.sentAt.toDateString() === new Date().toDateString()
        )
        if (!alreadySent) {
          for (const channel of config.channels) {
            this.sendAlert(workspaceId, threshold, maxUtil, status.monthly.limit, channel)
          }
        }
      }
    }

    return {
      triggered: crossed.length > 0,
      crossedThresholds: crossed,
      currentUtilization: maxUtil,
    }
  }

  sendAlert(
    workspaceId: string,
    threshold: number,
    currentSpend: number,
    budgetLimit: number,
    channel: AlertChannel
  ): AlertRecord {
    const record: AlertRecord = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      threshold,
      currentSpend,
      budgetLimit,
      channel,
      sentAt: new Date(),
      period: 'monthly',
    }
    alertHistory.push(record)
    logger.info('Alert sent', { workspaceId, threshold, channel })
    return record
  }

  getAlertHistory(workspaceId: string, limit: number = 50): AlertRecord[] {
    return alertHistory
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit)
  }

  // --------------- Per-Workflow Limits ---------------

  setWorkflowBudget(workflowId: string, limit: number): WorkflowBudget {
    if (limit < 0) throw new Error('Workflow budget must be non-negative')
    const existing = workflowBudgets.get(workflowId)
    const budget: WorkflowBudget = { workflowId, limit, currentSpend: existing?.currentSpend ?? 0 }
    workflowBudgets.set(workflowId, budget)
    logger.info('Workflow budget set', { workflowId, limit })
    return budget
  }

  getWorkflowSpending(workflowId: string): WorkflowBudget {
    return workflowBudgets.get(workflowId) ?? { workflowId, limit: 0, currentSpend: 0 }
  }

  async getTopSpendingWorkflows(
    workflowIds: string[],
    limit: number = 10
  ): Promise<{ workflowId: string; totalCost: number }[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const costs: { workflowId: string; totalCost: number }[] = []

    for (const wfId of workflowIds) {
      try {
        const analytics = await getWorkflowAnalytics({ workflowId: wfId, startDate, endDate })
        const total = analytics.reduce((sum, a) => sum + a.totalCost, 0)
        costs.push({ workflowId: wfId, totalCost: total })
      } catch {
        costs.push({ workflowId: wfId, totalCost: 0 })
      }
    }

    return costs.sort((a, b) => b.totalCost - a.totalCost).slice(0, limit)
  }

  // --------------- Smart Controls ---------------

  async suggestBudget(workflowId: string): Promise<{
    suggested: { daily: number; weekly: number; monthly: number }
    basedOn: string
    confidence: number
  }> {
    try {
      const forecast = await forecastCosts(workflowId)
      const margin = 1.2 // 20% buffer
      const monthly = Math.ceil(forecast.projectedMonthlyCost * margin * 100) / 100
      const daily = Math.ceil(forecast.projectedDailyCost * margin * 100) / 100
      const weekly = Math.ceil(daily * 7 * 100) / 100

      return {
        suggested: { daily, weekly, monthly },
        basedOn: '30-day cost forecast with 20% buffer',
        confidence: forecast.confidenceLevel,
      }
    } catch (error) {
      logger.error('Failed to suggest budget', { workflowId, error })
      return {
        suggested: { daily: 0, weekly: 0, monthly: 0 },
        basedOn: 'insufficient data',
        confidence: 0,
      }
    }
  }

  async detectAnomalies(workflowId: string): Promise<{
    hasAnomaly: boolean
    anomalies: { date: string; spend: number; expected: number; deviationPct: number }[]
  }> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    try {
      const analytics = await getWorkflowAnalytics({ workflowId, startDate, endDate })
      const dailyCosts: Record<string, number> = {}

      for (const a of analytics) {
        const key = a.date.toISOString().split('T')[0]
        dailyCosts[key] = (dailyCosts[key] || 0) + a.totalCost
      }

      const values = Object.values(dailyCosts)
      if (values.length < 3) return { hasAnomaly: false, anomalies: [] }

      const mean = values.reduce((s, v) => s + v, 0) / values.length
      const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
      const threshold = 2 // 2 standard deviations

      const anomalies = Object.entries(dailyCosts)
        .filter(([, cost]) => stdDev > 0 && Math.abs(cost - mean) > threshold * stdDev)
        .map(([date, spend]) => ({
          date,
          spend,
          expected: mean,
          deviationPct: ((spend - mean) / mean) * 100,
        }))

      return { hasAnomaly: anomalies.length > 0, anomalies }
    } catch (error) {
      logger.error('Failed to detect anomalies', { workflowId, error })
      return { hasAnomaly: false, anomalies: [] }
    }
  }

  async getSpendingTrend(workflowId: string, days: number = 30): Promise<SpendingTrendPoint[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    try {
      const analytics = await getWorkflowAnalytics({ workflowId, startDate, endDate })
      const dailyCosts: Record<string, number> = {}

      for (const a of analytics) {
        const key = a.date.toISOString().split('T')[0]
        dailyCosts[key] = (dailyCosts[key] || 0) + a.totalCost
      }

      return Object.entries(dailyCosts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, spend]) => ({ date, spend }))
    } catch (error) {
      logger.error('Failed to get spending trend', { workflowId, error })
      return []
    }
  }
}
