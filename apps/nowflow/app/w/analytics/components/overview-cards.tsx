'use client'

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OverviewCardsProps {
  summary: {
    totalExecutions: number
    successRate: number
    avgLatency: number
    p95Latency?: number | null
    totalCost: number
    totalInputCost?: number
    totalOutputCost?: number
    totalTokens: number
    totalPromptTokens?: number
    totalCompletionTokens?: number
    errorCount: number
  }
  dailyTrend?: Array<{
    date: string
    executions: number
    cost: number
    tokens: number
    errors: number
  }>
}

export function OverviewCards({ summary, dailyTrend }: OverviewCardsProps) {
  const safeData = {
    totalExecutions: summary?.totalExecutions ?? 0,
    successRate: summary?.successRate ?? 0,
    avgLatency: summary?.avgLatency ?? 0,
    p95Latency: summary?.p95Latency ?? null,
    totalCost: summary?.totalCost ?? 0,
    totalInputCost: summary?.totalInputCost ?? 0,
    totalOutputCost: summary?.totalOutputCost ?? 0,
    totalTokens: summary?.totalTokens ?? 0,
    totalPromptTokens: summary?.totalPromptTokens ?? 0,
    totalCompletionTokens: summary?.totalCompletionTokens ?? 0,
    errorCount: summary?.errorCount ?? 0,
  }

  // Calculate trend from daily data (last half vs first half)
  const calcTrend = (
    getValue: (d: { executions: number; cost: number; tokens: number; errors: number }) => number
  ) => {
    if (!dailyTrend || dailyTrend.length < 2) return null
    const mid = Math.floor(dailyTrend.length / 2)
    const recent = dailyTrend.slice(mid)
    const older = dailyTrend.slice(0, mid)
    const recentAvg = recent.reduce((s, d) => s + getValue(d), 0) / (recent.length || 1)
    const olderAvg = older.reduce((s, d) => s + getValue(d), 0) / (older.length || 1)
    if (olderAvg === 0) return null
    return ((recentAvg - olderAvg) / olderAvg) * 100
  }

  // Sparkline SVG component
  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (data.length < 2) return null
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const width = 80
    const height = 24
    const points = data
      .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
      .join(' ')
    return (
      <svg width={width} height={height} className="mt-1">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  const TrendBadge = ({ value, invertColor }: { value: number | null; invertColor?: boolean }) => {
    if (value === null) return null
    const isUp = value >= 0
    const isGood = invertColor ? !isUp : isUp
    return (
      <span
        className={`inline-flex items-center text-xs font-logo font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}
      >
        {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(0)}%
      </span>
    )
  }

  const executionsTrend = calcTrend((d) => d.executions)
  const costTrend = calcTrend((d) => d.cost)
  const errorTrend = calcTrend((d) => d.errors)

  const cards = [
    {
      title: 'Total Executions',
      value: safeData.totalExecutions.toLocaleString(),
      icon: Activity,
      color: 'blue',
      description: 'Workflow runs',
      trend: executionsTrend,
      sparkData: dailyTrend?.map((d) => d.executions),
      sparkColor: '#3b82f6',
    },
    {
      title: 'Success Rate',
      value: `${safeData.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'green',
      description: 'Successful executions',
      sparkColor: '#22c55e',
    },
    {
      title: 'Avg Latency',
      value: `${safeData.avgLatency.toFixed(0)}ms`,
      icon: Clock,
      color: 'purple',
      description: safeData.p95Latency
        ? `P95: ${safeData.p95Latency.toFixed(0)}ms`
        : 'Execution time',
      sparkColor: '#a855f7',
    },
    {
      title: 'Total Cost',
      value: `$${safeData.totalCost.toFixed(2)}`,
      icon: DollarSign,
      color: 'orange',
      description:
        safeData.totalInputCost > 0
          ? `In: $${safeData.totalInputCost.toFixed(2)} / Out: $${safeData.totalOutputCost.toFixed(2)}`
          : 'API costs',
      trend: costTrend,
      invertTrend: true,
      sparkData: dailyTrend?.map((d) => d.cost),
      sparkColor: '#f97316',
    },
    {
      title: 'Total Tokens',
      value: safeData.totalTokens.toLocaleString(),
      icon: Zap,
      color: 'cyan',
      description:
        safeData.totalPromptTokens > 0
          ? `Prompt: ${safeData.totalPromptTokens.toLocaleString()} / Comp: ${safeData.totalCompletionTokens.toLocaleString()}`
          : 'Tokens used',
      sparkData: dailyTrend?.map((d) => d.tokens),
      sparkColor: '#06b6d4',
    },
    {
      title: 'Errors',
      value: safeData.errorCount.toLocaleString(),
      icon: AlertTriangle,
      color: 'red',
      description: 'Failed executions',
      trend: errorTrend,
      invertTrend: true,
      sparkData: dailyTrend?.map((d) => d.errors),
      sparkColor: '#ef4444',
    },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'hover:border-blue-500/50' },
      green: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'hover:border-green-500/50' },
      purple: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-600',
        border: 'hover:border-purple-500/50',
      },
      orange: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-600',
        border: 'hover:border-orange-500/50',
      },
      cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'hover:border-cyan-500/50' },
      red: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'hover:border-red-500/50' },
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const colors = getColorClasses(card.color)
        const Icon = card.icon

        return (
          <Card
            key={card.title}
            className={`border-black/[0.06] dark:border-white/[0.06] transition-all ${colors.border}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-logo font-medium text-zinc-500 dark:text-white/40">
                {card.title}
              </CardTitle>
              <div className={`p-1.5 rounded-md ${colors.bg}`}>
                <Icon className={`h-4 w-4 ${colors.text}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-xl font-semibold font-logo text-zinc-800 dark:text-white">
                  {card.value}
                </div>
                {card.trend != null && (
                  <TrendBadge value={card.trend} invertColor={card.invertTrend} />
                )}
              </div>
              <p className="text-xs font-logo text-zinc-400 dark:text-white/40 mt-1 truncate">
                {card.description}
              </p>
              {card.sparkData && card.sparkData.length > 1 && (
                <Sparkline data={card.sparkData} color={card.sparkColor || '#3b82f6'} />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
