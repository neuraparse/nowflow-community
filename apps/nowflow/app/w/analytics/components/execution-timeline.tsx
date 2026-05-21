'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Loader2, X, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TraceSpan {
  id?: string
  name: string
  blockId?: string
  blockType?: string
  startTime?: number
  endTime?: number
  duration?: number
  status?: string
  error?: string
  children?: TraceSpan[]
  toolCalls?: Array<{
    name: string
    duration?: number
    startTime?: number
    endTime?: number
    status?: string
  }>
}

interface ExecutionTimelineProps {
  executionId: string
  onClose: () => void
}

export function ExecutionTimeline({ executionId, onClose }: ExecutionTimelineProps) {
  const [spans, setSpans] = useState<TraceSpan[]>([])
  const [loading, setLoading] = useState(true)
  const [totalDuration, setTotalDuration] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/traces/${executionId}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          setSpans(r.data.spans || [])
          setTotalDuration(r.data.totalDuration || 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [executionId])

  // Flatten and normalize spans for timeline
  const timelineRows = useMemo(() => {
    const rows: Array<{
      name: string
      type: string
      start: number
      end: number
      duration: number
      status: string
      error?: string
      depth: number
      isToolCall: boolean
    }> = []

    const processSpan = (span: TraceSpan, depth: number) => {
      const start = span.startTime || 0
      const dur =
        span.duration || (span.endTime && span.startTime ? span.endTime - span.startTime : 0)
      const end = span.endTime || start + dur

      rows.push({
        name: span.name || 'Unknown',
        type: span.blockType || 'block',
        start,
        end,
        duration: dur,
        status: span.status || (span.error ? 'error' : 'success'),
        error: span.error,
        depth,
        isToolCall: false,
      })

      // Add tool calls as children
      if (span.toolCalls) {
        span.toolCalls.forEach((tc) => {
          const tcStart = tc.startTime || start
          const tcDur = tc.duration || 0
          rows.push({
            name: tc.name,
            type: 'tool',
            start: tcStart,
            end: tcStart + tcDur,
            duration: tcDur,
            status: tc.status || 'success',
            depth: depth + 1,
            isToolCall: true,
          })
        })
      }

      // Process children
      if (span.children) {
        span.children.forEach((child) => processSpan(child, depth + 1))
      }
    }

    spans.forEach((span) => processSpan(span, 0))
    return rows
  }, [spans])

  const timeRange = useMemo(() => {
    if (timelineRows.length === 0) return { min: 0, max: totalDuration || 1000 }
    const starts = timelineRows.map((r) => r.start).filter((s) => s > 0)
    const ends = timelineRows.map((r) => r.end).filter((e) => e > 0)
    const min = starts.length > 0 ? Math.min(...starts) : 0
    const max = ends.length > 0 ? Math.max(...ends) : totalDuration || 1000
    return { min, max: max || min + 1000 }
  }, [timelineRows, totalDuration])

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getStatusIcon = (status: string) => {
    if (status === 'error' || status === 'failed')
      return <XCircle className="h-3 w-3 text-red-500" />
    if (status === 'running') return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
    return <CheckCircle className="h-3 w-3 text-green-500" />
  }

  const getBarColor = (status: string, isToolCall: boolean) => {
    if (status === 'error' || status === 'failed') return 'bg-red-500'
    if (status === 'running') return 'bg-blue-500'
    return isToolCall ? 'bg-purple-500' : 'bg-green-500'
  }

  return (
    <Card className="border-black/[0.06] dark:border-white/[0.06]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold font-logo flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Execution Timeline
          <Badge variant="outline" className="text-xs">
            {executionId.slice(0, 8)}
          </Badge>
          {totalDuration > 0 && (
            <span className="text-xs text-zinc-400 dark:text-white/40 font-normal">
              {formatMs(totalDuration)}
            </span>
          )}
        </CardTitle>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
        >
          <X className="h-4 w-4 text-zinc-400 dark:text-white/40" />
        </button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : timelineRows.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-white/40 text-center py-8">
            No trace data available for this execution
          </p>
        ) : (
          <div className="space-y-1">
            {/* Time axis */}
            <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-white/40 mb-2 pl-[200px]">
              <span>0ms</span>
              <span>{formatMs((timeRange.max - timeRange.min) / 4)}</span>
              <span>{formatMs((timeRange.max - timeRange.min) / 2)}</span>
              <span>{formatMs(((timeRange.max - timeRange.min) * 3) / 4)}</span>
              <span>{formatMs(timeRange.max - timeRange.min)}</span>
            </div>

            {timelineRows.map((row, i) => {
              const rangeMs = timeRange.max - timeRange.min || 1
              const leftPercent = ((row.start - timeRange.min) / rangeMs) * 100
              const widthPercent = Math.max((row.duration / rangeMs) * 100, 0.5)

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 group hover:bg-zinc-50 dark:hover:bg-white/[0.02] rounded py-0.5"
                >
                  {/* Label */}
                  <div
                    className="w-[200px] shrink-0 flex items-center gap-1.5 truncate"
                    style={{ paddingLeft: `${row.depth * 16}px` }}
                  >
                    {getStatusIcon(row.status)}
                    <span
                      className={`text-xs truncate ${
                        row.isToolCall
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-zinc-600 dark:text-white/60 font-medium'
                      }`}
                    >
                      {row.name}
                    </span>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-5">
                    <div className="absolute inset-0 bg-zinc-100 dark:bg-white/[0.06] rounded" />
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded ${getBarColor(row.status, row.isToolCall)} opacity-80 hover:opacity-100 transition-opacity`}
                      style={{
                        left: `${Math.min(leftPercent, 99)}%`,
                        width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                        minWidth: '2px',
                      }}
                    />
                    {/* Tooltip */}
                    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center">
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none"
                        style={{ left: `${Math.min(leftPercent + widthPercent / 2, 85)}%` }}
                      >
                        {row.name}: {formatMs(row.duration)}
                        {row.error && ` (Error)`}
                      </div>
                    </div>
                  </div>

                  {/* Duration label */}
                  <span className="text-xs text-zinc-400 dark:text-white/40 w-16 text-right shrink-0 font-mono">
                    {formatMs(row.duration)}
                  </span>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded bg-green-500" />
                <span className="text-xs text-zinc-400 dark:text-white/40">Block</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded bg-purple-500" />
                <span className="text-xs text-zinc-400 dark:text-white/40">Tool Call</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded bg-red-500" />
                <span className="text-xs text-zinc-400 dark:text-white/40">Error</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
