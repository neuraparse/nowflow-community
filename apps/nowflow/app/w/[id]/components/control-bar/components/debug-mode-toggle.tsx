'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowDebugIcon } from '@/components/workflow-control-icons'
import { cn } from '@/lib/utils'
import { useExecutionStore } from '@/stores/execution/store'

interface DebugModeToggleProps {
  isDebugModeEnabled: boolean
  isExecuting: boolean
  isMultiRunning: boolean
  toggleDebugMode: () => void
}

const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

export function DebugModeToggle({
  isDebugModeEnabled,
  isExecuting,
  isMultiRunning,
  toggleDebugMode,
}: DebugModeToggleProps) {
  const handleToggleDebugMode = () => {
    if (isDebugModeEnabled) {
      if (!isExecuting) {
        useExecutionStore.getState().setIsDebugging(false)
        useExecutionStore.getState().setPendingBlocks([])
      }
    }
    toggleDebugMode()
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-control-action="debug"
          data-control-state={isDebugModeEnabled ? 'active' : 'idle'}
          variant="ghost"
          size="icon"
          onClick={handleToggleDebugMode}
          disabled={isExecuting || isMultiRunning}
          className={cn(
            'silver-glass-chip relative h-8 w-8 min-h-8 min-w-8 rounded-[10px] text-foreground/70 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-0 disabled:opacity-40',
            isDebugModeEnabled
              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/[0.08] dark:bg-amber-500/[0.12]'
              : 'hover:bg-amber-500/[0.08] hover:text-amber-600 dark:hover:bg-amber-500/[0.12] dark:hover:text-amber-400'
          )}
          aria-label={`${isDebugModeEnabled ? 'Disable' : 'Enable'} debug mode`}
          aria-pressed={isDebugModeEnabled}
        >
          <WorkflowDebugIcon className="h-4 w-4" aria-hidden="true" />
          {isDebugModeEnabled && (
            <span
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
              aria-hidden="true"
            ></span>
          )}
          <span className="sr-only">Toggle Debug Mode</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={tooltipClass}>
        {isDebugModeEnabled ? 'Disable debug mode' : 'Enable debug mode'}
      </TooltipContent>
    </Tooltip>
  )
}
