'use client'

import { ArrowRight, Play, SkipForward, StepForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface DebugControlsProps {
  pendingCount: number
  onStepDebug: () => void
  onResumeDebug: () => void
  onCancelDebug: () => void
}

const debugButtonClass =
  'h-8 w-8 min-h-8 min-w-8 rounded-[10px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-30'
const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

export function DebugControls({
  pendingCount,
  onStepDebug,
  onResumeDebug,
  onCancelDebug,
}: DebugControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {/* Step Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onStepDebug}
            disabled={pendingCount === 0}
            className={cn(
              debugButtonClass,
              'hover:bg-amber-100/50 dark:hover:bg-amber-900/20',
              'text-amber-600 dark:text-amber-400'
            )}
            aria-label={`Step debug, ${pendingCount} pending`}
          >
            <StepForward className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Step ({pendingCount} pending)
        </TooltipContent>
      </Tooltip>

      {/* Resume Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onResumeDebug}
            disabled={pendingCount === 0}
            className={cn(
              debugButtonClass,
              'hover:bg-amber-100/50 dark:hover:bg-amber-900/20',
              'text-amber-600 dark:text-amber-400'
            )}
            aria-label={`Resume debug, ${pendingCount} pending`}
          >
            <SkipForward className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Resume All
        </TooltipContent>
      </Tooltip>

      {/* Cancel Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancelDebug}
            className={cn(
              'h-8 w-8 min-h-8 min-w-8 rounded-[10px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-0',
              'hover:bg-red-100/50 dark:hover:bg-red-900/20',
              'text-red-600 dark:text-red-400'
            )}
            aria-label="Cancel debug run"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Cancel Debug
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function DebugModeIndicator() {
  return (
    <div className="flex items-center gap-1 bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 backdrop-blur-sm rounded-md px-2 py-1 shadow-sm border border-amber-200/50 dark:border-amber-800/30">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
      <span className="text-xs font-logo font-medium text-amber-700 dark:text-amber-400">
        Debug
      </span>
    </div>
  )
}

export function RunProgressIndicator({
  completedRuns,
  runCount,
}: {
  completedRuns: number
  runCount: number
}) {
  const progress = Math.round((completedRuns / runCount) * 100)

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-primary-50/80 to-primary-100/50 dark:from-primary-950/30 dark:to-primary-900/20 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-primary-200/50 dark:border-primary-800/30">
      <div className="flex flex-col gap-1.5 min-w-[100px]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-logo font-medium text-primary-700 dark:text-primary-400">
            Progress
          </span>
          <span className="text-xs font-logo font-medium text-primary-700 dark:text-primary-400">
            {progress}%
          </span>
        </div>

        <div className="w-full h-1.5 bg-white/50 dark:bg-background/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="h-8 border-l border-primary-200/50 dark:border-primary-800/30 mx-1"></div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <Play className="h-3 w-3 text-primary-600 dark:text-primary-400" strokeWidth={1.5} />
          <span className="text-xs font-logo font-medium text-primary-700 dark:text-primary-400">
            Running
          </span>
        </div>
        <span className="text-xs font-logo text-primary-600/80 dark:text-primary-500/80 mt-0.5">
          {completedRuns}/{runCount} runs completed
        </span>
      </div>

      <div className="flex items-center ml-auto">
        <div className="flex items-center gap-1 bg-primary-100/50 dark:bg-primary-900/20 rounded-lg px-2 py-1 border border-primary-200/50 dark:border-primary-800/30">
          <ArrowRight
            className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400"
            strokeWidth={1.5}
          />
          <span className="text-xs font-logo font-medium text-primary-700 dark:text-primary-400">
            {completedRuns === runCount ? 'Completed' : 'In Progress'}
          </span>
        </div>
      </div>
    </div>
  )
}
