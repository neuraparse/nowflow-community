import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkflowAnalytics } from '@/lib/analytics/analytics-service'
import { forecastCosts } from '@/lib/analytics/cost-forecaster'
import { SpendControlService } from '../spend-control-service'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/analytics/cost-forecaster', () => ({ forecastCosts: vi.fn() }))
vi.mock('@/lib/analytics/analytics-service', () => ({ getWorkflowAnalytics: vi.fn() }))

let svc: SpendControlService

describe('SpendControlService', () => {
  beforeEach(() => {
    svc = new SpendControlService()
  })

  describe('setBudgetLimit / getBudgetStatus', () => {
    it('sets a budget and retrieves status', () => {
      svc.setBudgetLimit('ws1', 'monthly', 500)
      const status = svc.getBudgetStatus('ws1')
      expect(status.monthly.limit).toBe(500)
      expect(status.monthly.remaining).toBe(500)
      expect(status.monthly.utilizationPct).toBe(0)
    })

    it('throws on negative limit', () => {
      expect(() => svc.setBudgetLimit('ws1', 'daily', -10)).toThrow(
        'Budget limit must be non-negative'
      )
    })

    it('returns zero values for periods without budgets', () => {
      const status = svc.getBudgetStatus('ws-none')
      expect(status.daily.limit).toBe(0)
      expect(status.weekly.limit).toBe(0)
      expect(status.monthly.limit).toBe(0)
    })
  })

  describe('checkBudget', () => {
    it('allows spend when no budget is configured', () => {
      const result = svc.checkBudget('ws-new', 'monthly', 100)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })

    it('allows spend within budget', () => {
      svc.setBudgetLimit('ws2', 'monthly', 1000)
      const result = svc.checkBudget('ws2', 'monthly', 500)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1000)
    })

    it('rejects spend exceeding budget', () => {
      svc.setBudgetLimit('ws3', 'daily', 100)
      const result = svc.checkBudget('ws3', 'daily', 200)
      expect(result.allowed).toBe(false)
    })
  })

  describe('configureAlerts / checkAlertThresholds', () => {
    it('configures alerts with sorted thresholds', () => {
      const config = svc.configureAlerts('ws4', [90, 50, 75], ['email', 'slack'])
      expect(config.thresholds).toEqual([50, 75, 90])
      expect(config.channels).toEqual(['email', 'slack'])
      expect(config.enabled).toBe(true)
    })

    it('returns no triggers when alerts are disabled', () => {
      svc.configureAlerts('ws5', [50], ['email'], false)
      const result = svc.checkAlertThresholds('ws5')
      expect(result.triggered).toBe(false)
      expect(result.crossedThresholds).toEqual([])
    })

    it('returns no triggers when no config exists', () => {
      const result = svc.checkAlertThresholds('ws-unknown')
      expect(result.triggered).toBe(false)
    })
  })

  describe('detectAnomalies', () => {
    it('detects anomalous spending days', async () => {
      const baseDate = new Date('2025-06-10')
      const analytics = [
        // 5 normal days at ~10 cost, 1 anomaly at 100
        ...Array.from({ length: 5 }, (_, i) => ({
          date: new Date(`2025-06-0${i + 1}`),
          totalCost: 10,
        })),
        { date: new Date('2025-06-06'), totalCost: 100 },
      ]
      vi.mocked(getWorkflowAnalytics).mockResolvedValue(analytics as never)

      const result = await svc.detectAnomalies('wf1')
      expect(result.hasAnomaly).toBe(true)
      expect(result.anomalies.length).toBeGreaterThan(0)
      expect(result.anomalies[0].spend).toBe(100)
    })

    it('returns no anomalies with insufficient data', async () => {
      vi.mocked(getWorkflowAnalytics).mockResolvedValue([
        { date: new Date('2025-06-01'), totalCost: 5 },
      ] as never)
      const result = await svc.detectAnomalies('wf2')
      expect(result.hasAnomaly).toBe(false)
    })

    it('handles errors gracefully', async () => {
      vi.mocked(getWorkflowAnalytics).mockRejectedValue(new Error('fail'))
      const result = await svc.detectAnomalies('wf3')
      expect(result.hasAnomaly).toBe(false)
      expect(result.anomalies).toEqual([])
    })
  })

  describe('suggestBudget', () => {
    it('suggests budget based on forecast with 20% buffer', async () => {
      vi.mocked(forecastCosts).mockResolvedValue({
        projectedDailyCost: 10,
        projectedMonthlyCost: 300,
        confidenceLevel: 0.85,
      } as never)

      const result = await svc.suggestBudget('wf4')
      expect(result.suggested.daily).toBe(12) // ceil(10 * 1.2)
      expect(result.suggested.monthly).toBe(360) // ceil(300 * 1.2)
      expect(result.confidence).toBe(0.85)
      expect(result.basedOn).toContain('20% buffer')
    })

    it('returns zero suggestion on error', async () => {
      vi.mocked(forecastCosts).mockRejectedValue(new Error('no data'))
      const result = await svc.suggestBudget('wf5')
      expect(result.suggested.daily).toBe(0)
      expect(result.confidence).toBe(0)
    })
  })

  describe('getTopSpendingWorkflows', () => {
    it('returns workflows sorted by cost descending', async () => {
      vi.mocked(getWorkflowAnalytics)
        .mockResolvedValueOnce([{ totalCost: 50 }] as never)
        .mockResolvedValueOnce([{ totalCost: 200 }] as never)
        .mockResolvedValueOnce([{ totalCost: 10 }] as never)

      const top = await svc.getTopSpendingWorkflows(['a', 'b', 'c'], 2)
      expect(top).toHaveLength(2)
      expect(top[0].workflowId).toBe('b')
      expect(top[0].totalCost).toBe(200)
      expect(top[1].workflowId).toBe('a')
    })

    it('handles errors per workflow gracefully', async () => {
      vi.mocked(getWorkflowAnalytics).mockRejectedValue(new Error('fail'))
      const top = await svc.getTopSpendingWorkflows(['x'])
      expect(top).toEqual([{ workflowId: 'x', totalCost: 0 }])
    })
  })
})
