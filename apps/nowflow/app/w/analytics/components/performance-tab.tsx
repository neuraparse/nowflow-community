'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Clock, Gauge, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PerformanceTabProps {
  analytics: Array<{
    date: string
    avgExecutionTime: number
    p50ExecutionTime?: number | null
    p95ExecutionTime?: number | null
    p99ExecutionTime?: number | null
  }>
  selectedWorkflow: string
  startDate: string
}

interface LatencyData {
  avg: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
  histogram: Array<{ bucket: string; count: number }>
}

interface BlockData {
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
}

export function PerformanceTab({ analytics, selectedWorkflow, startDate }: PerformanceTabProps) {
  const [latencyData, setLatencyData] = useState<LatencyData | null>(null)
  const [blockData, setBlockData] = useState<BlockData | null>(null)
  const [sortField, setSortField] = useState<'avgDuration' | 'totalExecutions' | 'errorRate'>(
    'avgDuration'
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (selectedWorkflow !== 'all') {
      fetch(`/api/analytics/latency?workflowId=${selectedWorkflow}&startDate=${startDate}`)
        .then((r) => r.json())
        .then((r) => {
          if (r.success) setLatencyData(r.data)
        })
        .catch(() => {})
    }

    fetch(`/api/analytics/blocks?workflowId=${selectedWorkflow}&startDate=${startDate}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setBlockData(r.data)
      })
      .catch(() => {})
  }, [selectedWorkflow, startDate])

  // Aggregate percentiles from analytics data for "all" view
  const aggregatedPercentiles = useMemo(() => {
    const valid = analytics.filter((a) => a.avgExecutionTime > 0)
    if (valid.length === 0) return null

    const p50Values = valid.map((a) => a.p50ExecutionTime).filter((v): v is number => v != null)
    const p95Values = valid.map((a) => a.p95ExecutionTime).filter((v): v is number => v != null)
    const p99Values = valid.map((a) => a.p99ExecutionTime).filter((v): v is number => v != null)
    const avgValues = valid.map((a) => a.avgExecutionTime)

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }

    return {
      avg: Math.round(avgValues.reduce((a, b) => a + b, 0) / avgValues.length),
      p50: Math.round(median(p50Values)),
      p95: Math.round(median(p95Values)),
      p99: Math.round(median(p99Values)),
    }
  }, [analytics])

  const displayLatency =
    latencyData ||
    (aggregatedPercentiles
      ? {
          avg: aggregatedPercentiles.avg,
          min: 0,
          max: 0,
          p50: aggregatedPercentiles.p50,
          p95: aggregatedPercentiles.p95,
          p99: aggregatedPercentiles.p99,
          histogram: [],
        }
      : null)

  // Latency trend chart data
  const chartData = useMemo(() => {
    return analytics.map((a) => ({
      date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avg: a.avgExecutionTime || 0,
      p95: a.p95ExecutionTime || 0,
      p99: a.p99ExecutionTime || 0,
    }))
  }, [analytics])

  const maxChartValue = Math.max(...chartData.map((d) => Math.max(d.avg, d.p95, d.p99)), 1)

  // Sorted blocks
  const sortedBlocks = useMemo(() => {
    if (!blockData?.blocks) return []
    return [...blockData.blocks].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [blockData, sortField, sortDir])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <div className="space-y-6">
      {/* Percentile Cards */}
      {displayLatency && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Average', value: displayLatency.avg, color: 'blue' },
            { label: 'P50 (Median)', value: displayLatency.p50, color: 'green' },
            { label: 'P95', value: displayLatency.p95, color: 'orange' },
            { label: 'P99', value: displayLatency.p99, color: 'red' },
          ].map((item) => (
            <Card key={item.label} className="border-black/[0.06] dark:border-white/[0.06]">
              <CardContent className="pt-4">
                <p className="text-xs font-logo text-zinc-400 dark:text-white/40 mb-1">
                  {item.label}
                </p>
                <p
                  className={`text-2xl font-bold font-logo ${
                    item.color === 'blue'
                      ? 'text-blue-600'
                      : item.color === 'green'
                        ? 'text-green-600'
                        : item.color === 'orange'
                          ? 'text-orange-600'
                          : 'text-red-600'
                  }`}
                >
                  {formatMs(item.value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Latency Trend Chart */}
        <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Latency Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex items-end gap-1">
              {chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center group relative">
                  <div className="relative w-full flex justify-center gap-0.5">
                    <div
                      className="w-1/3 max-w-2 bg-blue-500 rounded-t"
                      style={{ height: `${(data.avg / maxChartValue) * 240}px`, minHeight: '2px' }}
                    />
                    <div
                      className="w-1/3 max-w-2 bg-orange-500 rounded-t"
                      style={{ height: `${(data.p95 / maxChartValue) * 240}px`, minHeight: '2px' }}
                    />
                    <div
                      className="w-1/3 max-w-2 bg-red-500 rounded-t"
                      style={{ height: `${(data.p99 / maxChartValue) * 240}px`, minHeight: '2px' }}
                    />
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      Avg: {formatMs(data.avg)} | P95: {formatMs(data.p95)} | P99:{' '}
                      {formatMs(data.p99)}
                    </div>
                  </div>
                  {index % Math.ceil(chartData.length / 8) === 0 && (
                    <span className="text-xs font-logo text-zinc-400 dark:text-white/40 mt-2 rotate-45 origin-left">
                      {data.date}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-xs font-logo text-zinc-400 dark:text-white/40">Average</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded" />
                <span className="text-xs font-logo text-zinc-400 dark:text-white/40">P95</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-xs font-logo text-zinc-400 dark:text-white/40">P99</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histogram */}
        {displayLatency && displayLatency.histogram.length > 0 && (
          <Card className="border-black/[0.06] dark:border-white/[0.06]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Latency Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displayLatency.histogram.map((bucket) => {
                  const maxCount = Math.max(...displayLatency.histogram.map((b) => b.count), 1)
                  return (
                    <div key={bucket.bucket} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-white/40">{bucket.bucket}</span>
                        <span className="font-medium">{bucket.count}</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Score (shown when no histogram) */}
        {displayLatency && displayLatency.histogram.length === 0 && (
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
                      strokeDasharray={`${Math.max(0, 1 - displayLatency.avg / 5000) * 352} 352`}
                      className="stroke-green-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold font-logo">
                      {Math.max(0, Math.round((1 - displayLatency.avg / 5000) * 100))}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs font-logo text-zinc-400 dark:text-white/40 text-center">
                Based on average latency
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {displayLatency.min > 0 && (
                  <div>
                    <p className="text-xs font-logo text-zinc-400 dark:text-white/40">Min</p>
                    <p className="text-sm font-medium">{formatMs(displayLatency.min)}</p>
                  </div>
                )}
                {displayLatency.max > 0 && (
                  <div>
                    <p className="text-xs font-logo text-zinc-400 dark:text-white/40">Max</p>
                    <p className="text-sm font-medium">{formatMs(displayLatency.max)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Block Performance Table */}
      {sortedBlocks.length > 0 && (
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Block Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                    <th className="text-left py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                      Block
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                      Type
                    </th>
                    <th
                      className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                      onClick={() => toggleSort('avgDuration')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Avg Duration
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                      onClick={() => toggleSort('totalExecutions')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Executions
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                      onClick={() => toggleSort('errorRate')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Error Rate
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                      Tokens
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((block) => {
                    const isBottleneck = blockData?.bottlenecks.some(
                      (b) => b.blockId === block.blockId
                    )
                    return (
                      <tr
                        key={block.blockId}
                        className={`border-b border-black/[0.04] dark:border-white/[0.04] ${
                          isBottleneck ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isBottleneck && <AlertTriangle className="h-3 w-3 text-red-500" />}
                            <span className="font-medium font-logo text-zinc-800 dark:text-white">
                              {block.blockName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-xs">
                            {block.blockType}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatMs(block.avgDuration)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {block.totalExecutions.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={
                              block.errorRate > 5
                                ? 'text-red-600 font-medium'
                                : 'text-zinc-500 dark:text-white/40'
                            }
                          >
                            {block.errorRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-500 dark:text-white/40">
                          {block.totalTokens.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
