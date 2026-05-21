'use client'

import { AlertTriangleIcon, CheckIcon, ClockIcon, XIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/utils'
import { useExecutionStore } from '@/stores/execution/store'

const logger = createLogger('execution-indicators')

interface ExecutionIndicatorsProps {
  blockId: string
}

export function ExecutionIndicators({ blockId }: ExecutionIndicatorsProps) {
  const { activeBlockIds, completedBlockIds, errorBlockIds, pendingBlocks, executionMetrics } =
    useExecutionStore()

  const isActive = activeBlockIds.has(blockId)
  const isCompleted = completedBlockIds.has(blockId)
  const hasError = errorBlockIds.has(blockId)
  const isPending = pendingBlocks.includes(blockId)
  const metrics = executionMetrics[blockId]

  // If no execution status, don't render anything
  if (!isActive && !isCompleted && !hasError && !isPending) {
    return null
  }

  return (
    <div
      className="absolute top-1 right-1 p-1 z-[9999] pointer-events-none"
      style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Active Indicator */}
      {isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white animate-active-block shadow-lg border-2 border-white"
              style={{
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
                animation: 'active-block-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            >
              <ClockIcon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Executing...</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Completed Indicator */}
      {isCompleted && !hasError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white animate-completed-block shadow-lg border-2 border-white"
              style={{
                boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              <CheckIcon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs">
              <p className="font-semibold">Completed Successfully</p>
              {metrics?.duration && (
                <p className="text-zinc-400 dark:text-white/40">
                  Duration: {formatDuration(metrics.duration)}
                </p>
              )}
              {metrics?.startTime && (
                <p className="text-zinc-400 dark:text-white/40">
                  Started: {new Date(metrics.startTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Error Indicator */}
      {hasError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white animate-error-block shadow-lg border-2 border-white cursor-pointer pointer-events-auto"
              style={{
                boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              <XIcon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[400px]">
            <div className="text-xs space-y-2">
              <p className="font-semibold text-red-400">⚠️ Execution Failed</p>

              {/* Error Message */}
              {metrics?.error?.message && (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-300 dark:text-white">Error:</p>
                  <p className="text-red-400 break-words bg-red-950/30 p-2 rounded border border-red-800/30">
                    {metrics.error.message}
                  </p>
                </div>
              )}

              {/* Last Transition */}
              {metrics?.error?.lastTransition && (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-300 dark:text-white">Last Transition:</p>
                  <p className="text-blue-400 bg-blue-950/30 p-2 rounded border border-blue-800/30">
                    {metrics.error.lastTransition.from} → {metrics.error.lastTransition.to}
                    {metrics.error.lastTransition.handle && (
                      <span className="text-zinc-400 dark:text-white/40">
                        {' '}
                        ({metrics.error.lastTransition.handle})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Last Data */}
              {metrics?.lastOutput && (
                <div className="space-y-1">
                  <p className="font-medium text-zinc-300 dark:text-white">Last Output:</p>
                  <pre className="text-zinc-400 dark:text-white/40 bg-gray-950/30 p-2 rounded border border-gray-800/30 overflow-auto max-h-32 text-[10px]">
                    {JSON.stringify(metrics.lastOutput, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
                {metrics?.duration && (
                  <span className="text-zinc-400 dark:text-white/40">
                    ⏱️ {formatDuration(metrics.duration)}
                  </span>
                )}
                {metrics?.attempts && metrics.attempts > 1 && (
                  <span className="text-amber-400">🔄 {metrics.attempts}x</span>
                )}
                {metrics?.error?.blockType && (
                  <span className="text-zinc-400 dark:text-white/40">
                    📦 {metrics.error.blockType}
                  </span>
                )}
              </div>

              <p className="text-zinc-500 dark:text-white/40 text-[10px] pt-1 border-t border-gray-700">
                Click a console entry to inspect execution details
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Pending Indicator */}
      {isPending && !isActive && !isCompleted && !hasError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white shadow-lg border-2 border-white animate-pulse"
              style={{
                boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              <AlertTriangleIcon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Waiting to execute...</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

// Bottom indicator for showing execution details like duration, error messages, etc.
export function ExecutionBottomIndicator({ blockId }: ExecutionIndicatorsProps) {
  const { executionMetrics, errorBlockIds } = useExecutionStore()
  const metrics = executionMetrics[blockId]
  const hasError = errorBlockIds.has(blockId)

  if (!metrics) return null

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-mono rounded-b-xl',
        hasError
          ? 'bg-red-500/10 text-red-700 dark:text-red-400'
          : 'bg-gray-100/80 text-zinc-600 dark:bg-gray-800/80 dark:text-white/40'
      )}
    >
      {hasError && metrics.error ? (
        <div className="truncate" title={metrics.error.message}>
          Error: {metrics.error.message}
        </div>
      ) : metrics.duration ? (
        <div className="flex justify-between">
          <span>{formatDuration(metrics.duration)}</span>
          {metrics.attempts && metrics.attempts > 1 && (
            <span className="text-amber-600 dark:text-amber-400">{metrics.attempts}x</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
