'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Brain, GitBranch, HardDrive, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface QuotaBreakdown {
  quotaType: string
  baseQuota: number
  rolloverAmount: number
  totalAvailable: number
  usage: number
  remaining: number
  planName: string
}

interface QuotaResponse {
  success: boolean
  data: QuotaBreakdown[]
}

const QUOTA_CONFIG: Record<
  string,
  { label: string; icon: typeof Zap; format: (n: number) => string }
> = {
  api_calls: { label: 'API Calls', icon: Zap, format: (n) => n.toLocaleString() },
  storage: { label: 'Storage', icon: HardDrive, format: (n) => `${(n / 1024).toFixed(1)} GB` },
  ai_credits: { label: 'AI Credits', icon: Brain, format: (n) => `$${n.toFixed(2)}` },
  workflows: { label: 'Workflows', icon: GitBranch, format: (n) => n.toLocaleString() },
}

export function QuotaDisplay() {
  const [quotas, setQuotas] = useState<QuotaBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch('/api/billing/quota')
        if (!res.ok) throw new Error('Failed to load quota data')
        const json: QuotaResponse = await res.json()
        if (!json.success) throw new Error('Failed to load quota data')
        setQuotas(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchQuota()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-500/20">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-[13px] font-logo text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quotas.map((quota) => {
        const config = QUOTA_CONFIG[quota.quotaType]
        if (!config) return null
        const Icon = config.icon
        const pct =
          quota.totalAvailable > 0 ? Math.min((quota.usage / quota.totalAvailable) * 100, 100) : 0
        const basePct =
          quota.totalAvailable > 0 ? (quota.baseQuota / quota.totalAvailable) * 100 : 100

        return (
          <Card
            key={quota.quotaType}
            className="border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900"
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85">
                  <div className="h-7 w-7 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.08] flex items-center justify-center">
                    <Icon
                      className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]"
                      strokeWidth={1.5}
                    />
                  </div>
                  {config.label}
                </span>
                <span className="text-[12px] font-logo font-medium text-zinc-500 dark:text-white/50">
                  {pct.toFixed(0)}% used
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stacked usage bar */}
              <div className="relative h-2.5 w-full rounded-full bg-zinc-100 dark:bg-white/[0.06] overflow-hidden">
                {/* Base quota region indicator */}
                {quota.rolloverAmount > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 border-r border-dashed border-zinc-300 dark:border-white/20 z-10"
                    style={{ width: `${basePct}%` }}
                  />
                )}
                {/* Used portion */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-purple-500 dark:bg-purple-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                {/* Rollover region (green tint behind unused rollover area) */}
                {quota.rolloverAmount > 0 && (
                  <div
                    className="absolute inset-y-0 rounded-r-full bg-emerald-400/30 dark:bg-emerald-400/20"
                    style={{ left: `${basePct}%`, width: `${100 - basePct}%` }}
                  />
                )}
              </div>

              {/* Legend dots */}
              <div className="flex items-center gap-3 flex-wrap text-[11px] font-logo text-zinc-400 dark:text-white/40">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-500" />
                  Used
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-200 dark:bg-white/10" />
                  Base
                </span>
                {quota.rolloverAmount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400/50" />
                    Rollover
                  </span>
                )}
              </div>

              {/* Numbers */}
              <p className="text-[12px] font-logo text-zinc-600 dark:text-white/60">
                Used {config.format(quota.usage)} of {config.format(quota.totalAvailable)}
                {quota.rolloverAmount > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {' '}
                    (+{config.format(quota.rolloverAmount)} rollover bonus)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
