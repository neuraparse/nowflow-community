'use client'

import { useMemo } from 'react'
import { Clock, Globe, MessageSquare, MousePointer, Webhook, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TriggersTabProps {
  triggerBreakdown: Record<string, number>
  dailyTrend: Array<{
    date: string
    executions: number
  }>
  analytics: Array<{
    date: string
    triggerBreakdown?: Record<string, number>
  }>
}

const TRIGGER_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  manual: {
    label: 'Manual',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10 text-blue-600',
    icon: MousePointer,
  },
  api: {
    label: 'API',
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10 text-green-600',
    icon: Globe,
  },
  webhook: {
    label: 'Webhook',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-500/10 text-purple-600',
    icon: Webhook,
  },
  schedule: {
    label: 'Schedule',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/10 text-orange-600',
    icon: Clock,
  },
  chat: {
    label: 'Chat',
    color: 'bg-cyan-500',
    bgColor: 'bg-cyan-500/10 text-cyan-600',
    icon: MessageSquare,
  },
}

export function TriggersTab({ triggerBreakdown, dailyTrend, analytics }: TriggersTabProps) {
  const total = Object.values(triggerBreakdown).reduce((sum, v) => sum + v, 0)

  const triggers = useMemo(() => {
    return Object.entries(triggerBreakdown)
      .map(([key, count]) => ({
        key,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        config: TRIGGER_CONFIG[key] || {
          label: key,
          color: 'bg-zinc-500',
          bgColor: 'bg-zinc-500/10 text-zinc-500',
          icon: Zap,
        },
      }))
      .sort((a, b) => b.count - a.count)
  }, [triggerBreakdown, total])

  // Build daily trigger trend
  const dailyTriggerData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}

    analytics.forEach((a) => {
      const dateStr = new Date(a.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      if (!data[dateStr]) data[dateStr] = {}
      if (a.triggerBreakdown) {
        Object.entries(a.triggerBreakdown).forEach(([trigger, count]) => {
          data[dateStr][trigger] = (data[dateStr][trigger] || 0) + count
        })
      }
    })

    return Object.entries(data).map(([date, triggers]) => ({ date, ...triggers }))
  }, [analytics])

  const triggerTypes = useMemo(() => {
    const types = new Set<string>()
    dailyTriggerData.forEach((d) => {
      Object.keys(d).forEach((k) => {
        if (k !== 'date') types.add(k)
      })
    })
    return Array.from(types)
  }, [dailyTriggerData])

  const maxDailyTotal = Math.max(
    ...dailyTriggerData.map((d) =>
      Object.entries(d)
        .filter(([k]) => k !== 'date')
        .reduce((sum, [, v]) => sum + (Number(v) || 0), 0)
    ),
    1
  )

  if (total === 0) {
    return (
      <Card className="border-black/[0.06] dark:border-white/[0.06]">
        <CardContent className="py-12 text-center">
          <Zap className="h-8 w-8 text-zinc-400 dark:text-white/40 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 dark:text-white/40">No trigger data available yet</p>
          <p className="text-xs text-zinc-400 dark:text-white/40 mt-1">
            Run workflows to see trigger breakdown
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Trigger Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(TRIGGER_CONFIG).map(([key, config]) => {
          const count = triggerBreakdown[key] || 0
          const percentage = total > 0 ? (count / total) * 100 : 0
          const Icon = config.icon
          return (
            <Card key={key} className="border-black/[0.06] dark:border-white/[0.06]">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium font-logo text-zinc-500 dark:text-white/40">
                    {config.label}
                  </span>
                </div>
                <p className="text-xl font-bold font-logo text-zinc-800 dark:text-white">
                  {count.toLocaleString()}
                </p>
                <p className="text-xs text-zinc-400 dark:text-white/40">{percentage.toFixed(1)}%</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut Chart */}
        <Card className="border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {(() => {
                    let currentAngle = 0
                    return triggers.map((trigger, i) => {
                      const angle = (trigger.percentage / 100) * 360
                      const radius = 60
                      const circumference = 2 * Math.PI * radius
                      const dashArray = (angle / 360) * circumference
                      const dashOffset = -(currentAngle / 360) * circumference

                      currentAngle += angle

                      return (
                        <circle
                          key={trigger.key}
                          cx="80"
                          cy="80"
                          r={radius}
                          strokeWidth="20"
                          fill="none"
                          className={trigger.config.color.replace('bg-', 'stroke-')}
                          strokeDasharray={`${dashArray} ${circumference}`}
                          strokeDashoffset={dashOffset}
                        />
                      )
                    })
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold font-logo text-zinc-800 dark:text-white">
                    {total.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-white/40">Total</span>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="space-y-2 mt-2">
              {triggers.map((trigger) => (
                <div key={trigger.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${trigger.config.color}`} />
                    <span className="text-zinc-500 dark:text-white/40">{trigger.config.label}</span>
                  </div>
                  <span className="font-medium font-logo">{trigger.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stacked Bar Trend */}
        <Card className="lg:col-span-2 border-black/[0.06] dark:border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Trigger Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex items-end gap-1">
              {dailyTriggerData.map((day, index) => {
                const dayTotal = Object.entries(day)
                  .filter(([k]) => k !== 'date')
                  .reduce((sum, [, v]) => sum + (Number(v) || 0), 0)

                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full flex justify-center">
                      <div
                        className="w-full max-w-8 flex flex-col-reverse rounded-t overflow-hidden"
                        style={{
                          height: `${(dayTotal / maxDailyTotal) * 240}px`,
                          minHeight: '4px',
                        }}
                      >
                        {triggerTypes.map((type) => {
                          const value = ((day as Record<string, unknown>)[type] as number) || 0
                          const config = TRIGGER_CONFIG[type]
                          if (!config || value === 0) return null
                          return (
                            <div
                              key={type}
                              className={config.color}
                              style={{ height: `${(value / dayTotal) * 100}%` }}
                            />
                          )
                        })}
                      </div>
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {dayTotal} executions
                      </div>
                    </div>
                    {index % Math.ceil(dailyTriggerData.length / 8) === 0 && (
                      <span className="text-xs text-zinc-400 dark:text-white/40 mt-2 rotate-45 origin-left">
                        {day.date as string}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
              {triggerTypes.map((type) => {
                const config = TRIGGER_CONFIG[type]
                if (!config) return null
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${config.color}`} />
                    <span className="text-xs text-zinc-400 dark:text-white/40">{config.label}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
