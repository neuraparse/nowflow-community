'use client'

import { useMemo } from 'react'
import { Clock, Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LatencyChartProps {
  analytics: Array<{
    date: string
    avgExecutionTime: number
    p95ExecutionTime?: number
    minExecutionTime?: number
    maxExecutionTime?: number
  }>
}

export function LatencyChart({ analytics }: LatencyChartProps) {
  const chartData = useMemo(() => {
    return analytics.map((a) => ({
      date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avg: a.avgExecutionTime || 0,
      p95: a.p95ExecutionTime || (a.avgExecutionTime || 0) * 1.5,
    }))
  }, [analytics])

  const validAnalytics = analytics.filter(
    (a) => a.avgExecutionTime != null && a.avgExecutionTime > 0
  )
  const avgLatency =
    validAnalytics.length > 0
      ? validAnalytics.reduce((sum, a) => sum + (a.avgExecutionTime || 0), 0) /
        validAnalytics.length
      : 0
  const avgP95 =
    validAnalytics.length > 0
      ? validAnalytics.reduce(
          (sum, a) => sum + (a.p95ExecutionTime || (a.avgExecutionTime || 0) * 1.5),
          0
        ) / validAnalytics.length
      : 0
  const latencyValues = validAnalytics.map((a) => a.minExecutionTime || a.avgExecutionTime || 0)
  const minLatency = latencyValues.length > 0 ? Math.min(...latencyValues) : 0
  const maxValues = validAnalytics.map((a) => a.maxExecutionTime || (a.avgExecutionTime || 0) * 2)
  const maxLatency = maxValues.length > 0 ? Math.max(...maxValues) : 0

  const maxValue = Math.max(...chartData.map((d) => Math.max(d.avg, d.p95)), 1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Chart */}
      <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Latency Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-end gap-1">
            {chartData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center group relative">
                <div className="relative w-full flex justify-center gap-0.5">
                  {/* Avg bar */}
                  <div
                    className="w-1/2 max-w-3 bg-blue-500 rounded-t"
                    style={{ height: `${(data.avg / maxValue) * 250}px`, minHeight: '4px' }}
                  />
                  {/* P95 bar */}
                  <div
                    className="w-1/2 max-w-3 bg-orange-500 rounded-t"
                    style={{ height: `${(data.p95 / maxValue) * 250}px`, minHeight: '4px' }}
                  />
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    Avg: {data.avg.toFixed(0)}ms | P95: {data.p95.toFixed(0)}ms
                  </div>
                </div>
                {index % Math.ceil(chartData.length / 10) === 0 && (
                  <span className="text-xs text-zinc-400 dark:text-white/40 mt-2 rotate-45 origin-left">
                    {data.date}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-xs text-zinc-400 dark:text-white/40">Average</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded" />
              <span className="text-xs text-zinc-400 dark:text-white/40">P95</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="space-y-4">
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo">Latency Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-zinc-400 dark:text-white/40">Average Latency</p>
              <p className="text-2xl font-bold font-logo">{avgLatency.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 dark:text-white/40">P95 Latency</p>
              <p className="text-lg font-semibold font-logo">{avgP95.toFixed(0)}ms</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400 dark:text-white/40">Min</p>
                <p className="text-sm font-medium font-logo">{minLatency.toFixed(0)}ms</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 dark:text-white/40">Max</p>
                <p className="text-sm font-medium font-logo">{maxLatency.toFixed(0)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Performance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="8"
                    fill="none"
                    className="stroke-zinc-200 dark:stroke-white/[0.06]"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(1 - avgLatency / 5000) * 352} 352`}
                    className="stroke-green-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold font-logo">
                    {Math.max(0, Math.round((1 - avgLatency / 5000) * 100))}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-white/40 text-center">
              Based on average latency
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
