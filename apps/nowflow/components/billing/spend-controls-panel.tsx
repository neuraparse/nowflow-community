'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, DollarSign, Loader2, Save, TrendingUp, WalletMinimal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'

type BudgetPeriod = 'daily' | 'weekly' | 'monthly'

interface BudgetStatus {
  limit: number
  currentSpend: number
  remaining: number
  utilizationPct: number
}

interface Anomaly {
  date: string
  spend: number
  expected: number
  deviationPct: number
}

interface TopWorkflow {
  workflowId: string
  name?: string
  totalCost: number
}

interface SpendControlsData {
  budgets: Record<BudgetPeriod, BudgetStatus>
  alertThresholds: number[]
  alertsEnabled: boolean
  topWorkflows: TopWorkflow[]
  anomalies: Anomaly[]
}

const THRESHOLD_OPTIONS = [50, 75, 90, 100]

export function SpendControlsPanel() {
  const [data, setData] = useState<SpendControlsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [budgetInputs, setBudgetInputs] = useState<Record<BudgetPeriod, string>>({
    daily: '',
    weekly: '',
    monthly: '',
  })
  const [enabledThresholds, setEnabledThresholds] = useState<Set<number>>(
    new Set(THRESHOLD_OPTIONS)
  )
  const [alertsEnabled, setAlertsEnabled] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/spend-controls')
      const result = await res.json()
      if (result.success && result.data) {
        const raw = result.data
        // Map API response to component's expected shape
        const budgetStatus = raw.budgetStatus || {}
        const alerts = raw.alerts || {}
        const d: SpendControlsData = {
          budgets: {
            daily: budgetStatus.daily || {
              limit: 0,
              currentSpend: 0,
              remaining: 0,
              utilizationPct: 0,
            },
            weekly: budgetStatus.weekly || {
              limit: 0,
              currentSpend: 0,
              remaining: 0,
              utilizationPct: 0,
            },
            monthly: budgetStatus.monthly || {
              limit: 0,
              currentSpend: 0,
              remaining: 0,
              utilizationPct: 0,
            },
          },
          alertThresholds: alerts.thresholds || [50, 75, 90, 100],
          alertsEnabled: alerts.enabled !== false,
          topWorkflows: raw.topWorkflows || [],
          anomalies: raw.workflow?.anomalies || [],
        }
        setData(d)
        setBudgetInputs({
          daily: d.budgets.daily.limit > 0 ? String(d.budgets.daily.limit) : '',
          weekly: d.budgets.weekly.limit > 0 ? String(d.budgets.weekly.limit) : '',
          monthly: d.budgets.monthly.limit > 0 ? String(d.budgets.monthly.limit) : '',
        })
        setEnabledThresholds(new Set(d.alertThresholds))
        setAlertsEnabled(d.alertsEnabled)
      } else {
        // No data yet - set defaults
        setData({
          budgets: {
            daily: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
            weekly: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
            monthly: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
          },
          alertThresholds: [50, 75, 90, 100],
          alertsEnabled: true,
          topWorkflows: [],
          anomalies: [],
        })
      }
    } catch (err) {
      console.error('Failed to fetch spend controls:', err)
      // Set defaults on error so UI doesn't crash
      setData({
        budgets: {
          daily: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
          weekly: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
          monthly: { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 },
        },
        alertThresholds: [50, 75, 90, 100],
        alertsEnabled: true,
        topWorkflows: [],
        anomalies: [],
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/billing/spend-controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgets: {
            daily: parseFloat(budgetInputs.daily) || 0,
            weekly: parseFloat(budgetInputs.weekly) || 0,
            monthly: parseFloat(budgetInputs.monthly) || 0,
          },
          alertThresholds: Array.from(enabledThresholds).sort((a, b) => a - b),
          alertsEnabled,
        }),
      })
      await fetchData()
    } catch (err) {
      console.error('Failed to save spend controls:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleThreshold = (t: number) => {
    setEnabledThresholds((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 75) return 'bg-amber-500'
    return 'bg-[#4A7A68]'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#4A7A68] dark:text-[#94B8A6]" />
      </div>
    )
  }

  const activeBudget = data?.budgets?.monthly ??
    data?.budgets?.weekly ??
    data?.budgets?.daily ?? { limit: 0, currentSpend: 0, remaining: 0, utilizationPct: 0 }
  const activePct = activeBudget?.utilizationPct ?? 0

  return (
    <div className="space-y-6">
      {/* Spending Overview */}
      <Card className="border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
            <WalletMinimal className="h-4 w-4" />
            Spending Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBudget && activeBudget.limit > 0 ? (
            <>
              <div className="flex items-center justify-between text-[12px] font-logo">
                <span className="text-zinc-500 dark:text-white/60">
                  ${activeBudget.currentSpend.toFixed(2)} used
                </span>
                <span className="text-zinc-700 dark:text-white/85 font-medium">
                  ${activeBudget.limit.toFixed(2)} limit
                </span>
              </div>
              <Progress
                value={Math.min(activePct, 100)}
                className="h-2.5"
                indicatorClassName={getBarColor(activePct)}
              />
              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                {activePct.toFixed(1)}% of monthly budget used &middot; $
                {activeBudget.remaining.toFixed(2)} remaining
              </p>
            </>
          ) : (
            <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60">
              No budget limits configured yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget Limits */}
      <Card className="border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budget Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['daily', 'weekly', 'monthly'] as BudgetPeriod[]).map((period) => (
            <div key={period} className="flex items-center gap-3">
              <span className="text-[12px] font-logo font-medium text-zinc-600 dark:text-white/70 w-16 capitalize">
                {period}
              </span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-400">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={budgetInputs[period]}
                  onChange={(e) =>
                    setBudgetInputs((prev) => ({ ...prev, [period]: e.target.value }))
                  }
                  className="pl-7 h-9 text-[12px] font-logo"
                />
              </div>
              {data?.budgets[period] && data.budgets[period].limit > 0 && (
                <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40 w-20 text-right">
                  {data.budgets[period].utilizationPct.toFixed(0)}% used
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alert Thresholds */}
      <Card className="border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alert Thresholds
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40">Alerts</span>
              <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {THRESHOLD_OPTIONS.map((t) => (
              <div key={t} className="flex items-center justify-between">
                <span className="text-[12px] font-logo text-zinc-600 dark:text-white/70">
                  {t}% of budget
                </span>
                <Switch
                  checked={enabledThresholds.has(t)}
                  onCheckedChange={() => toggleThreshold(t)}
                  disabled={!alertsEnabled}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Spending Workflows */}
      {data?.topWorkflows && data.topWorkflows.length > 0 && (
        <Card className="border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Spending Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topWorkflows.slice(0, 5).map((wf) => (
                <div
                  key={wf.workflowId}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-black/[0.04] dark:border-white/[0.04]"
                >
                  <span className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/85 truncate max-w-[200px]">
                    {wf.name || wf.workflowId.slice(0, 8)}
                  </span>
                  <span className="text-[12px] font-logo text-zinc-600 dark:text-white/70 font-medium">
                    ${wf.totalCost.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomaly Alerts */}
      {data?.anomalies && data.anomalies.length > 0 && (
        <Card className="border-red-200/60 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] font-logo font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Spending Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.anomalies.map((a, i) => (
                <div key={i} className="text-[12px] font-logo text-red-600 dark:text-red-400/80">
                  <span className="font-medium">{a.date}</span> &mdash; ${a.spend.toFixed(4)} spent
                  (expected ${a.expected.toFixed(4)}, {a.deviationPct > 0 ? '+' : ''}
                  {a.deviationPct.toFixed(0)}%)
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-10 font-logo text-[13px] bg-[#4A7A68] hover:bg-[#3d6657] text-white dark:bg-[#94B8A6] dark:hover:bg-[#7da08e] dark:text-slate-900"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {saving ? 'Saving...' : 'Save Spend Controls'}
      </Button>
    </div>
  )
}
