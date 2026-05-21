'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Clock, TrendingUp, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ToolsTabProps {
  selectedWorkflow: string
  startDate: string
}

interface ToolData {
  name: string
  totalCalls: number
  avgDuration: number
  errorCount: number
  errorRate: number
  totalTokens: number
}

interface ToolAnalytics {
  tools: ToolData[]
  slowestTools: Array<{ name: string; avgDuration: number }>
  mostUsedTools: Array<{ name: string; totalCalls: number }>
  errorProneTools: Array<{ name: string; errorRate: number; errorCount: number }>
}

export function ToolsTab({ selectedWorkflow, startDate }: ToolsTabProps) {
  const [data, setData] = useState<ToolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<'totalCalls' | 'avgDuration' | 'errorRate'>(
    'totalCalls'
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/tools?workflowId=${selectedWorkflow}&startDate=${startDate}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setData(r.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedWorkflow, startDate])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedTools = data?.tools
    ? [...data.tools].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      })
    : []

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!data || data.tools.length === 0) {
    return (
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardContent className="py-12 text-center">
          <Wrench className="h-8 w-8 text-zinc-400 dark:text-white/40 mx-auto mb-3" />
          <p className="text-sm font-logo text-zinc-400 dark:text-white/40">
            No tool call data available yet
          </p>
          <p className="text-xs font-logo text-zinc-400 dark:text-white/40 mt-1">
            Tool analytics will appear after workflow executions with agent blocks
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Most Used Tools */}
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Most Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.mostUsedTools.map((tool, i) => {
                const maxCalls = data.mostUsedTools[0]?.totalCalls || 1
                return (
                  <div key={tool.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-white/40 truncate max-w-[140px]">
                        {tool.name}
                      </span>
                      <span className="font-medium font-logo">{tool.totalCalls}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${(tool.totalCalls / maxCalls) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Slowest Tools */}
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Slowest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.slowestTools.map((tool, i) => {
                const maxDuration = data.slowestTools[0]?.avgDuration || 1
                return (
                  <div key={tool.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-white/40 truncate max-w-[140px]">
                        {tool.name}
                      </span>
                      <span className="font-medium font-logo">{formatMs(tool.avgDuration)}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-full h-1.5">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{ width: `${(tool.avgDuration / maxDuration) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {data.slowestTools.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-white/40 text-center py-2">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Prone Tools */}
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error Prone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.errorProneTools.map((tool) => (
                <div key={tool.name} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-white/40 truncate max-w-[140px]">
                    {tool.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    >
                      {tool.errorRate.toFixed(1)}%
                    </Badge>
                    <span className="text-xs text-zinc-400 dark:text-white/40">
                      {tool.errorCount} errors
                    </span>
                  </div>
                </div>
              ))}
              {data.errorProneTools.length === 0 && (
                <p className="text-xs text-green-600 text-center py-2">No tool errors detected</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Tool Table */}
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            All Tools ({sortedTools.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                  <th className="text-left py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                    Tool Name
                  </th>
                  <th
                    className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                    onClick={() => toggleSort('totalCalls')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Calls <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th
                    className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                    onClick={() => toggleSort('avgDuration')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Avg Duration <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th
                    className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40 cursor-pointer hover:text-zinc-800 dark:hover:text-white"
                    onClick={() => toggleSort('errorRate')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Error Rate <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                    Tokens
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTools.map((tool) => (
                  <tr
                    key={tool.name}
                    className="border-b border-black/[0.04] dark:border-white/[0.04]"
                  >
                    <td className="py-2 px-3 font-medium font-logo text-zinc-800 dark:text-white">
                      {tool.name}
                    </td>
                    <td className="py-2 px-3 text-right">{tool.totalCalls.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatMs(tool.avgDuration)}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={
                          tool.errorRate > 5
                            ? 'text-red-600 font-medium'
                            : 'text-zinc-500 dark:text-white/40'
                        }
                      >
                        {tool.errorRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-500 dark:text-white/40">
                      {tool.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
