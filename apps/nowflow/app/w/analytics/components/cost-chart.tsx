'use client'

import { useMemo } from 'react'
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CostChartProps {
  analytics: Array<{
    date: string
    totalCost: number
    inputCost?: number
    outputCost?: number
    totalPromptTokens?: number
    totalCompletionTokens?: number
    modelUsage?: Record<string, { cost: number; tokens: number }>
  }>
}

export function CostChart({ analytics }: CostChartProps) {
  const hasInputOutput = analytics.some((a) => (a.inputCost || 0) > 0 || (a.outputCost || 0) > 0)

  const chartData = useMemo(() => {
    return analytics.map((a) => ({
      date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: a.totalCost || 0,
      inputCost: a.inputCost || 0,
      outputCost: a.outputCost || 0,
    }))
  }, [analytics])

  const totalCost = analytics.reduce((sum, a) => sum + (a.totalCost || 0), 0)
  const totalInputCost = analytics.reduce((sum, a) => sum + (a.inputCost || 0), 0)
  const totalOutputCost = analytics.reduce((sum, a) => sum + (a.outputCost || 0), 0)
  const totalPromptTokens = analytics.reduce((sum, a) => sum + (a.totalPromptTokens || 0), 0)
  const totalCompletionTokens = analytics.reduce(
    (sum, a) => sum + (a.totalCompletionTokens || 0),
    0
  )
  const avgDailyCost = totalCost / (analytics.length || 1)

  // Calculate trend
  const recentCosts = analytics.slice(-7)
  const olderCosts = analytics.slice(-14, -7)
  const recentAvg =
    recentCosts.reduce((sum, a) => sum + (a.totalCost || 0), 0) / (recentCosts.length || 1)
  const olderAvg =
    olderCosts.reduce((sum, a) => sum + (a.totalCost || 0), 0) / (olderCosts.length || 1)
  const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0

  // Model breakdown
  const modelBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    analytics.forEach((a) => {
      if (a.modelUsage && typeof a.modelUsage === 'object') {
        Object.entries(a.modelUsage).forEach(([model, data]) => {
          if (data && typeof data === 'object' && 'cost' in data) {
            breakdown[model] = (breakdown[model] || 0) + (data.cost || 0)
          }
        })
      }
    })
    return Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [analytics])

  const maxCost = Math.max(...chartData.map((d) => d.cost), 0.001)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Chart */}
      <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Over Time {hasInputOutput && '(Input / Output)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-end gap-1">
            {chartData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full flex justify-center">
                  {hasInputOutput ? (
                    <div
                      className="w-full max-w-8 flex flex-col-reverse rounded-t overflow-hidden"
                      style={{ height: `${(data.cost / maxCost) * 250}px`, minHeight: '4px' }}
                    >
                      <div
                        className="bg-blue-500"
                        style={{
                          height: data.cost > 0 ? `${(data.inputCost / data.cost) * 100}%` : '0',
                        }}
                      />
                      <div
                        className="bg-orange-500"
                        style={{
                          height: data.cost > 0 ? `${(data.outputCost / data.cost) * 100}%` : '0',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full max-w-8 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{ height: `${(data.cost / maxCost) * 250}px`, minHeight: '4px' }}
                    />
                  )}
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {hasInputOutput
                      ? `In: $${data.inputCost.toFixed(3)} | Out: $${data.outputCost.toFixed(3)}`
                      : `$${data.cost.toFixed(3)}`}
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
          {hasInputOutput && (
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-xs text-zinc-400 dark:text-white/40">Input Cost</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded" />
                <span className="text-xs text-zinc-400 dark:text-white/40">Output Cost</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="space-y-4">
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo">Cost Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-zinc-400 dark:text-white/40">Total Cost</p>
              <p className="text-2xl font-bold font-logo">${totalCost.toFixed(2)}</p>
            </div>
            {hasInputOutput && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 dark:text-white/40">Input Cost</p>
                  <p className="text-sm font-semibold font-logo text-blue-600">
                    ${totalInputCost.toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 dark:text-white/40">Output Cost</p>
                  <p className="text-sm font-semibold font-logo text-orange-600">
                    ${totalOutputCost.toFixed(3)}
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-400 dark:text-white/40">Avg Daily Cost</p>
              <p className="text-lg font-semibold font-logo">${avgDailyCost.toFixed(3)}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-400 dark:text-white/40">Trend (7d)</p>
              <div
                className={`flex items-center gap-1 ${trend >= 0 ? 'text-red-600' : 'text-green-600'}`}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm font-medium font-logo">{Math.abs(trend).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Breakdown */}
        {(totalPromptTokens > 0 || totalCompletionTokens > 0) && (
          <Card className="border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-logo">Token Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Prompt Tokens</span>
                <span className="text-sm font-medium font-logo">
                  {totalPromptTokens.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${(totalPromptTokens / (totalPromptTokens + totalCompletionTokens || 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Completion Tokens</span>
                <span className="text-sm font-medium font-logo">
                  {totalCompletionTokens.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{
                    width: `${(totalCompletionTokens / (totalPromptTokens + totalCompletionTokens || 1)) * 100}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modelBreakdown.length > 0 ? (
                modelBreakdown.map(([model, cost]) => {
                  const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0
                  return (
                    <div key={model} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40 truncate max-w-[120px]">
                          {model}
                        </span>
                        <span className="font-medium font-logo">
                          ${cost.toFixed(3)} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-zinc-400 dark:text-white/40">No model data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
