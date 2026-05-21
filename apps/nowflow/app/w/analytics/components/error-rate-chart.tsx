'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorRateChartProps {
  analytics: Array<{
    date: string
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    errorCount: number
  }>
  selectedWorkflow?: string
  startDate?: string
}

interface ErrorAnalysis {
  totalErrors: number
  errorRate: number
  topErrors: Array<{ error: string; count: number; percentage: number }>
  errorsByDay: Array<{ date: string; count: number }>
}

export function ErrorRateChart({ analytics, selectedWorkflow, startDate }: ErrorRateChartProps) {
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysis | null>(null)

  useEffect(() => {
    if (selectedWorkflow && selectedWorkflow !== 'all' && startDate) {
      fetch(`/api/analytics/errors?workflowId=${selectedWorkflow}&startDate=${startDate}`)
        .then((r) => r.json())
        .then((r) => {
          if (r.success) setErrorAnalysis(r.data)
        })
        .catch(() => {})
    }
  }, [selectedWorkflow, startDate])

  const chartData = useMemo(() => {
    return analytics.map((a) => {
      const total = a.totalExecutions || 1
      const errorRate = ((a.failedExecutions || 0) / total) * 100
      return {
        date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        errorRate,
        errors: a.failedExecutions || 0,
        success: a.successfulExecutions || 0,
        total: a.totalExecutions || 0,
      }
    })
  }, [analytics])

  const totalExecutions = analytics.reduce((sum, a) => sum + (a.totalExecutions || 0), 0)
  const totalSuccess = analytics.reduce((sum, a) => sum + (a.successfulExecutions || 0), 0)
  const totalErrors = analytics.reduce((sum, a) => sum + (a.failedExecutions || 0), 0)
  const avgErrorRate = totalExecutions > 0 ? (totalErrors / totalExecutions) * 100 : 0
  const successRate = totalExecutions > 0 ? (totalSuccess / totalExecutions) * 100 : 100

  const maxErrorRate = Math.max(...chartData.map((d) => d.errorRate), 5)

  // Categorize errors
  const errorCategories = useMemo(() => {
    if (!errorAnalysis?.topErrors) return []
    const categories: Record<string, { count: number; errors: string[] }> = {}

    errorAnalysis.topErrors.forEach((e) => {
      let category = 'Other'
      const msg = e.error.toLowerCase()
      if (msg.includes('timeout') || msg.includes('timed out')) category = 'Timeout'
      else if (msg.includes('rate limit') || msg.includes('429')) category = 'Rate Limit'
      else if (
        msg.includes('api') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('500')
      )
        category = 'API Error'
      else if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required'))
        category = 'Validation'
      else if (
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('econnrefused')
      )
        category = 'Network'

      if (!categories[category]) categories[category] = { count: 0, errors: [] }
      categories[category].count += e.count
      categories[category].errors.push(e.error)
    })

    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
  }, [errorAnalysis])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error Rate Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end gap-1">
              {chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full flex justify-center">
                    <div
                      className={`w-full max-w-8 rounded-t ${
                        data.errorRate > 10
                          ? 'bg-red-500'
                          : data.errorRate > 5
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        height: `${(data.errorRate / maxErrorRate) * 250}px`,
                        minHeight: '4px',
                      }}
                    />
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {data.errorRate.toFixed(1)}% ({data.errors}/{data.total})
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
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-logo">Error Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 dark:text-white/40">Error Rate</p>
                  <p className="text-2xl font-bold font-logo">{avgErrorRate.toFixed(1)}%</p>
                </div>
                <Badge
                  className={
                    avgErrorRate > 10
                      ? 'bg-red-500/10 text-red-600'
                      : avgErrorRate > 5
                        ? 'bg-orange-500/10 text-orange-600'
                        : 'bg-green-500/10 text-green-600'
                  }
                >
                  {avgErrorRate > 10 ? 'High' : avgErrorRate > 5 ? 'Medium' : 'Low'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-400 dark:text-white/40">Total Errors</p>
                <p className="text-lg font-semibold font-logo text-red-600">
                  {totalErrors.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 dark:text-white/40">Success Rate</p>
                <p className="text-lg font-semibold font-logo text-green-600">
                  {successRate.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-logo">Execution Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Successful</span>
                  </div>
                  <span className="text-sm font-medium font-logo">
                    {totalSuccess.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${successRate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm">Failed</span>
                  </div>
                  <span className="text-sm font-medium font-logo">
                    {totalErrors.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${avgErrorRate}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Errors Table + Error Categories */}
      {errorAnalysis && errorAnalysis.topErrors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Errors */}
          <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Top Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {errorAnalysis.topErrors.map((error, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded-lg bg-[#fafafa] dark:bg-slate-900"
                  >
                    <span className="text-xs font-mono bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded shrink-0">
                      {error.count}x
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-600 dark:text-white/60 break-all line-clamp-2">
                        {error.error}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-zinc-100 dark:bg-white/[0.06] rounded-full h-1">
                          <div
                            className="bg-red-500 h-1 rounded-full"
                            style={{ width: `${error.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 dark:text-white/40 shrink-0">
                          {error.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Error Categories */}
          {errorCategories.length > 0 && (
            <Card className="border-black/[0.06] dark:border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-sm font-semibold font-logo">Error Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorCategories.map((cat) => {
                    const maxCount = errorCategories[0]?.count || 1
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500 dark:text-white/40 font-medium font-logo">
                            {cat.name}
                          </span>
                          <span className="font-medium">{cat.count}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              cat.name === 'Timeout'
                                ? 'bg-orange-500'
                                : cat.name === 'Rate Limit'
                                  ? 'bg-yellow-500'
                                  : cat.name === 'API Error'
                                    ? 'bg-red-500'
                                    : cat.name === 'Validation'
                                      ? 'bg-purple-500'
                                      : cat.name === 'Network'
                                        ? 'bg-blue-500'
                                        : 'bg-slate-500'
                            }`}
                            style={{ width: `${(cat.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
