import { createLogger } from '@/lib/logs/console-logger'
import { getAnalyticsSummary, getWorkflowAnalytics } from './analytics-service'

const logger = createLogger('CostForecaster')

export interface CostForecast {
  currentPeriodCost: number
  projectedMonthlyCost: number
  projectedDailyCost: number
  costTrend: 'increasing' | 'decreasing' | 'stable'
  trendPercentage: number
  confidenceLevel: number
  breakdown: {
    byModel: Record<string, { current: number; projected: number }>
    byTrigger: Record<string, { current: number; projected: number }>
  }
  recommendations: string[]
}

export interface UsageForecast {
  currentExecutions: number
  projectedMonthlyExecutions: number
  projectedDailyExecutions: number
  executionTrend: 'increasing' | 'decreasing' | 'stable'
  trendPercentage: number
  peakHours: number[]
  peakDays: string[]
}

/**
 * Forecasts costs for a workflow
 */
export async function forecastCosts(
  workflowId: string,
  forecastDays: number = 30
): Promise<CostForecast> {
  try {
    // Get historical data (last 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const analytics = await getWorkflowAnalytics({
      workflowId,
      startDate,
      endDate,
    })

    if (analytics.length === 0) {
      return {
        currentPeriodCost: 0,
        projectedMonthlyCost: 0,
        projectedDailyCost: 0,
        costTrend: 'stable',
        trendPercentage: 0,
        confidenceLevel: 0,
        breakdown: { byModel: {}, byTrigger: {} },
        recommendations: ['Insufficient data for accurate forecasting'],
      }
    }

    // Calculate daily costs
    const dailyCosts: Record<string, number> = {}
    const modelCosts: Record<string, number> = {}

    analytics.forEach((a) => {
      const dateStr = a.date.toISOString().split('T')[0]
      dailyCosts[dateStr] = (dailyCosts[dateStr] || 0) + a.totalCost

      Object.entries(a.modelUsage).forEach(([model, data]) => {
        modelCosts[model] = (modelCosts[model] || 0) + data.cost
      })
    })

    const sortedDates = Object.keys(dailyCosts).sort()
    const costs = sortedDates.map((d) => dailyCosts[d])

    // Calculate current period cost
    const currentPeriodCost = costs.reduce((a, b) => a + b, 0)

    // Calculate trend using linear regression
    const { slope, intercept, r2 } = linearRegression(costs)
    const avgDaily = currentPeriodCost / costs.length
    const trendPercentage = avgDaily > 0 ? (slope / avgDaily) * 100 * 7 : 0 // Weekly trend

    let costTrend: 'increasing' | 'decreasing' | 'stable'
    if (trendPercentage > 5) {
      costTrend = 'increasing'
    } else if (trendPercentage < -5) {
      costTrend = 'decreasing'
    } else {
      costTrend = 'stable'
    }

    // Project future costs
    const projectedDailyCost = Math.max(0, intercept + slope * (costs.length + forecastDays / 2))
    const projectedMonthlyCost = projectedDailyCost * 30

    // Breakdown projections
    const totalCost = currentPeriodCost || 1
    const byModel: Record<string, { current: number; projected: number }> = {}
    Object.entries(modelCosts).forEach(([model, cost]) => {
      const ratio = cost / totalCost
      byModel[model] = {
        current: cost,
        projected: projectedMonthlyCost * ratio,
      }
    })

    // Generate recommendations
    const recommendations = generateCostRecommendations(
      costTrend,
      trendPercentage,
      modelCosts,
      projectedMonthlyCost
    )

    return {
      currentPeriodCost,
      projectedMonthlyCost,
      projectedDailyCost,
      costTrend,
      trendPercentage,
      confidenceLevel: r2,
      breakdown: {
        byModel,
        byTrigger: {},
      },
      recommendations,
    }
  } catch (error) {
    logger.error('Failed to forecast costs', { workflowId, error })
    throw error
  }
}

/**
 * Forecasts usage for a workflow
 */
export async function forecastUsage(
  workflowId: string,
  forecastDays: number = 30
): Promise<UsageForecast> {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const analytics = await getWorkflowAnalytics({
      workflowId,
      startDate,
      endDate,
    })

    if (analytics.length === 0) {
      return {
        currentExecutions: 0,
        projectedMonthlyExecutions: 0,
        projectedDailyExecutions: 0,
        executionTrend: 'stable',
        trendPercentage: 0,
        peakHours: [],
        peakDays: [],
      }
    }

    // Calculate daily executions and hourly patterns
    const dailyExecutions: Record<string, number> = {}
    const hourlyExecutions: Record<number, number> = {}
    const dayOfWeekExecutions: Record<string, number> = {}

    analytics.forEach((a) => {
      const dateStr = a.date.toISOString().split('T')[0]
      const dayOfWeek = new Date(a.date).toLocaleDateString('en-US', { weekday: 'long' })

      dailyExecutions[dateStr] = (dailyExecutions[dateStr] || 0) + a.totalExecutions

      if (a.hour !== undefined) {
        hourlyExecutions[a.hour] = (hourlyExecutions[a.hour] || 0) + a.totalExecutions
      }

      dayOfWeekExecutions[dayOfWeek] = (dayOfWeekExecutions[dayOfWeek] || 0) + a.totalExecutions
    })

    const sortedDates = Object.keys(dailyExecutions).sort()
    const executions = sortedDates.map((d) => dailyExecutions[d])

    const currentExecutions = executions.reduce((a, b) => a + b, 0)
    const { slope, intercept, r2 } = linearRegression(executions)

    const avgDaily = currentExecutions / executions.length
    const trendPercentage = avgDaily > 0 ? (slope / avgDaily) * 100 * 7 : 0

    let executionTrend: 'increasing' | 'decreasing' | 'stable'
    if (trendPercentage > 5) {
      executionTrend = 'increasing'
    } else if (trendPercentage < -5) {
      executionTrend = 'decreasing'
    } else {
      executionTrend = 'stable'
    }

    const projectedDailyExecutions = Math.max(
      0,
      intercept + slope * (executions.length + forecastDays / 2)
    )
    const projectedMonthlyExecutions = Math.round(projectedDailyExecutions * 30)

    // Find peak hours
    const peakHours = Object.entries(hourlyExecutions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))

    // Find peak days
    const peakDays = Object.entries(dayOfWeekExecutions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([day]) => day)

    return {
      currentExecutions,
      projectedMonthlyExecutions,
      projectedDailyExecutions,
      executionTrend,
      trendPercentage,
      peakHours,
      peakDays,
    }
  } catch (error) {
    logger.error('Failed to forecast usage', { workflowId, error })
    throw error
  }
}

/**
 * Gets budget recommendations
 */
export async function getBudgetRecommendations(
  workflowId: string,
  monthlyBudget: number
): Promise<{
  withinBudget: boolean
  projectedSpend: number
  budgetUtilization: number
  daysUntilBudgetExhausted: number | null
  recommendations: string[]
}> {
  try {
    const forecast = await forecastCosts(workflowId)

    const withinBudget = forecast.projectedMonthlyCost <= monthlyBudget
    const budgetUtilization =
      monthlyBudget > 0 ? (forecast.projectedMonthlyCost / monthlyBudget) * 100 : 0

    let daysUntilBudgetExhausted: number | null = null
    if (forecast.projectedDailyCost > 0 && !withinBudget) {
      const remainingBudget = monthlyBudget - forecast.currentPeriodCost
      daysUntilBudgetExhausted = Math.max(
        0,
        Math.floor(remainingBudget / forecast.projectedDailyCost)
      )
    }

    const recommendations: string[] = []

    if (!withinBudget) {
      recommendations.push(
        `Projected spending exceeds budget by $${(forecast.projectedMonthlyCost - monthlyBudget).toFixed(2)}`
      )

      if (forecast.costTrend === 'increasing') {
        recommendations.push('Cost trend is increasing - consider optimizing expensive operations')
      }

      // Model-specific recommendations
      const expensiveModels = Object.entries(forecast.breakdown.byModel)
        .filter(([, data]) => data.projected > monthlyBudget * 0.3)
        .map(([model]) => model)

      if (expensiveModels.length > 0) {
        recommendations.push(
          `Consider using more cost-effective models for: ${expensiveModels.join(', ')}`
        )
      }
    } else if (budgetUtilization > 80) {
      recommendations.push('Approaching budget limit - monitor usage closely')
    }

    return {
      withinBudget,
      projectedSpend: forecast.projectedMonthlyCost,
      budgetUtilization,
      daysUntilBudgetExhausted,
      recommendations,
    }
  } catch (error) {
    logger.error('Failed to get budget recommendations', { workflowId, error })
    throw error
  }
}

/**
 * Simple linear regression
 */
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length
  if (n < 2) {
    return { slope: 0, intercept: values[0] || 0, r2: 0 }
  }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  let sumYY = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
    sumYY += values[i] * values[i]
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R²
  const meanY = sumY / n
  let ssRes = 0
  let ssTot = 0

  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i
    ssRes += (values[i] - predicted) ** 2
    ssTot += (values[i] - meanY) ** 2
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2: Math.max(0, r2) }
}

/**
 * Generate cost recommendations
 */
function generateCostRecommendations(
  trend: 'increasing' | 'decreasing' | 'stable',
  trendPercentage: number,
  modelCosts: Record<string, number>,
  projectedCost: number
): string[] {
  const recommendations: string[] = []

  // Trend-based recommendations
  if (trend === 'increasing' && trendPercentage > 20) {
    recommendations.push('Costs are increasing rapidly. Review recent workflow changes.')
  }

  // Model-based recommendations
  const totalCost = Object.values(modelCosts).reduce((a, b) => a + b, 0)
  const expensiveModels = Object.entries(modelCosts)
    .filter(([, cost]) => cost > totalCost * 0.5)
    .map(([model]) => model)

  if (expensiveModels.length > 0) {
    recommendations.push(
      `Consider using GPT-4o-mini or Claude Haiku for non-critical tasks to reduce costs.`
    )
  }

  // Cost threshold recommendations
  if (projectedCost > 100) {
    recommendations.push('Enable caching for repeated queries to reduce API calls.')
  }

  if (projectedCost > 500) {
    recommendations.push('Consider setting up spending alerts and limits.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Current spending patterns look healthy.')
  }

  return recommendations
}
