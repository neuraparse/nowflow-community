'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Wrench,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TraceStep {
  id: string
  blockId: string
  blockType: string
  blockName: string
  status: string
  message: string
  timestamp: string
  duration: number | null
  tokensUsed: number | null
  cost: number | null
  reasoning: string | null
  toolCalls: any[] | null
  input: any | null
  output: any | null
}

interface Trace {
  id: string
  workflowId: string
  status: string
  startedAt: string
  completedAt: string | null
  duration: number | null
  steps: TraceStep[]
  totalTokens: number
  totalCost: number
}

interface AgentTraceProps {
  workflowId: string
  executionId?: string
}

export function AgentTrace({ workflowId, executionId }: AgentTraceProps) {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)

  // Poll only while there are running traces; stop when all are completed/failed
  const hasRunningTrace = traces.some((t) => t.status === 'running' || t.status === 'pending')
  useEffect(() => {
    loadTraces()
    // Only poll if there are running traces (or initial load with no data yet)
    if (!hasRunningTrace && traces.length > 0) return
    const interval = setInterval(loadTraces, 5000)
    return () => clearInterval(interval)
  }, [workflowId, executionId, hasRunningTrace, traces.length])

  const loadTraces = async () => {
    try {
      const params = new URLSearchParams({ workflowId })
      if (executionId) params.set('executionId', executionId)
      const response = await fetch(`/api/agents/trace?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTraces(data.traces || [])
        if (!selectedTrace && data.traces.length > 0) {
          setSelectedTrace(data.traces[0].id)
        }
      }
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoading(false)
    }
  }

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const activeTrace = traces.find((t) => t.id === selectedTrace) || traces[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-white/40" />
      </div>
    )
  }

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-4">
        <Activity className="h-8 w-8 text-zinc-400 dark:text-white/40 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-white/40">No execution traces yet</p>
        <p className="text-xs text-zinc-400 dark:text-white/40 mt-1">
          Run your workflow to see real-time agent reasoning
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Stats */}
      {activeTrace && (
        <div className="silver-glass-pane border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.08]">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-zinc-400 dark:text-white/40" />
              <span className="text-zinc-600 dark:text-white/60">
                {activeTrace.duration
                  ? `${(activeTrace.duration / 1000).toFixed(1)}s`
                  : 'Running...'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-zinc-600 dark:text-white/60">
                {activeTrace.totalTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3 text-emerald-500" />
              <span className="text-zinc-600 dark:text-white/60">
                ${activeTrace.totalCost.toFixed(4)}
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                activeTrace.status === 'completed'
                  ? 'text-emerald-600 border-emerald-300'
                  : activeTrace.status === 'failed'
                    ? 'text-red-600 border-red-300'
                    : 'text-amber-600 border-amber-300'
              }`}
            >
              {activeTrace.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Trace selector */}
      {traces.length > 1 && (
        <div className="border-b border-black/[0.06] px-3 py-1.5 dark:border-white/[0.08]">
          <Select value={selectedTrace || activeTrace?.id || ''} onValueChange={setSelectedTrace}>
            <SelectTrigger className="h-9 w-full rounded-xl text-[12px] font-logo text-zinc-700 dark:text-white/85 focus:ring-0">
              <SelectValue placeholder="Select trace execution" />
            </SelectTrigger>
            <SelectContent>
              {traces.map((trace) => (
                <SelectItem key={trace.id} value={trace.id}>
                  {new Date(trace.startedAt).toLocaleTimeString()} - {trace.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeTrace?.steps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* Timeline connector */}
            {index < activeTrace.steps.length - 1 && (
              <div className="absolute bottom-0 left-[11px] top-7 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
            )}

            <div
              className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
              onClick={() => toggleStep(step.id)}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {step.status === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : step.status === 'info' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Activity className="h-5 w-5 text-blue-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-800 dark:text-white truncate">
                    {step.blockName || step.blockType}
                  </span>
                  {step.duration && (
                    <span className="text-[10px] text-zinc-400 dark:text-white/40">
                      {step.duration}ms
                    </span>
                  )}
                  {expandedSteps.has(step.id) ? (
                    <ChevronDown className="h-3 w-3 text-zinc-400 dark:text-white/40" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-white/40 dark:text-zinc-400 dark:text-white/40 truncate">
                  {step.message}
                </p>

                {/* Expanded details */}
                {expandedSteps.has(step.id) && (
                  <div className="mt-2 space-y-2 text-xs">
                    {step.reasoning && (
                      <div className="silver-glass-pane rounded-2xl border border-purple-200/60 bg-purple-50/85 p-2.5 dark:border-purple-800/40 dark:bg-purple-950/20">
                        <div className="flex items-center gap-1.5 mb-1 text-purple-700 dark:text-purple-300 font-medium">
                          <Brain className="h-3 w-3" />
                          Reasoning
                        </div>
                        <p className="text-purple-600 dark:text-purple-400 whitespace-pre-wrap">
                          {step.reasoning}
                        </p>
                      </div>
                    )}

                    {step.toolCalls && step.toolCalls.length > 0 && (
                      <div className="silver-glass-pane rounded-2xl border border-blue-200/60 bg-blue-50/85 p-2.5 dark:border-blue-800/40 dark:bg-blue-950/20">
                        <div className="flex items-center gap-1.5 mb-1 text-blue-700 dark:text-blue-300 font-medium">
                          <Wrench className="h-3 w-3" />
                          Tool Calls ({step.toolCalls.length})
                        </div>
                        {step.toolCalls.map((call: any, i: number) => (
                          <div key={i} className="text-blue-600 dark:text-blue-400 mt-1">
                            <span className="font-mono">{call.name || call.type}</span>
                            {call.result && (
                              <pre className="mt-0.5 text-[10px] overflow-x-auto">
                                {typeof call.result === 'string'
                                  ? call.result.slice(0, 200)
                                  : JSON.stringify(call.result, null, 2).slice(0, 200)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {step.tokensUsed && (
                      <div className="flex items-center gap-3 text-zinc-400 dark:text-white/40">
                        <span>
                          <Zap className="h-3 w-3 inline mr-0.5" />
                          {step.tokensUsed.toLocaleString()} tokens
                        </span>
                        {step.cost && (
                          <span>
                            <DollarSign className="h-3 w-3 inline mr-0.5" />${step.cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {activeTrace?.steps.length === 0 && (
          <div className="text-center py-6 text-xs text-zinc-400 dark:text-white/40">
            No trace steps recorded for this execution
          </div>
        )}
      </div>
    </div>
  )
}
