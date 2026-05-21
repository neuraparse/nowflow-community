'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowDebugIcon, WorkflowRunIcon } from '@/components/workflow-control-icons'
import { cn } from '@/lib/utils'

type ColorTheme = 'slate' | 'blue' | 'emerald' | 'purple' | 'rose' | 'orange'

interface RunButtonProps {
  isDebugModeEnabled: boolean
  isExecuting: boolean
  isMultiRunning: boolean
  isCancelling: boolean
  isDebugging: boolean
  runCount: number
  usageExceeded: boolean
  colorTheme?: ColorTheme
  usageData?: {
    currentUsage: number
    limit: number
    percentUsed?: number
    isWarning?: boolean
  }
  onRun: () => void
  onMultipleRuns: () => void
  onOpenSubscriptionSettings: () => void
  onSetRunCount: (count: number) => void
  getKeyboardShortcutText: (key: string, showCtrl?: boolean) => string
}

export function RunButton({
  isDebugModeEnabled,
  isExecuting,
  isMultiRunning,
  isCancelling,
  isDebugging,
  usageExceeded,
  usageData,
  onRun,
  onMultipleRuns,
  onOpenSubscriptionSettings,
  getKeyboardShortcutText,
}: RunButtonProps) {
  const handleClick = usageExceeded
    ? onOpenSubscriptionSettings
    : isDebugModeEnabled
      ? onRun
      : onMultipleRuns

  const isDisabled = isExecuting || isMultiRunning || isCancelling

  const showUsageWarning = !usageExceeded && Boolean(usageData?.isWarning)
  const showUsageNotice = usageExceeded || showUsageWarning

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '$0.00'

    return `$${value.toFixed(2)}`
  }

  const getButtonText = () => {
    if (isCancelling) return 'Cancelling...'
    if (isMultiRunning) return 'Running'
    if (isExecuting) return isDebugging ? 'Debugging' : 'Running'
    if (isDebugModeEnabled) return 'Debug'
    return 'Run'
  }

  const getButtonIcon = () => {
    if (isExecuting || isMultiRunning || isCancelling) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    }

    return isDebugModeEnabled ? (
      <WorkflowDebugIcon className="h-3.5 w-3.5" />
    ) : (
      <WorkflowRunIcon className="h-3.5 w-3.5" />
    )
  }

  return (
    <div className="flex">
      {/* Main Run Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-control-action="run"
            data-control-mode={isDebugModeEnabled ? 'debug' : 'run'}
            data-control-state={
              isCancelling ? 'cancelling' : isExecuting || isMultiRunning ? 'running' : 'idle'
            }
            className={cn(
              'workflow-editor-run-button relative overflow-hidden',
              // Professional minimalist design
              isDebugModeEnabled
                ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'
                : 'bg-[#1b1b1b] hover:bg-[#2a2a2a] dark:bg-white/90 dark:hover:bg-white/80',
              // Clean styling
              isDebugModeEnabled ? 'text-white dark:text-white' : 'text-white dark:text-[#1b1b1b]',
              'font-logo font-medium',
              'h-8 rounded-[7px] px-3.5 py-1.5',
              // Subtle effects
              'border border-transparent',
              'shadow-sm hover:shadow-md',
              'transition-all duration-200 ease-out',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
            onClick={handleClick}
            disabled={isDisabled}
          >
            {/* Subtle running indicator */}
            {(isExecuting || isMultiRunning) && (
              <span
                className={cn(
                  'absolute inset-0 h-full w-full rounded-[7px]',
                  isDebugModeEnabled ? 'bg-amber-500/20' : 'bg-white/20 dark:bg-black/20',
                  'animate-pulse'
                )}
              />
            )}

            <div className="relative z-10 flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                {getButtonIcon()}
              </span>
              <span className="text-[12px] font-logo font-semibold">{getButtonText()}</span>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className={cn(
            'bg-[#1b1b1b] text-white border-none text-[11px] font-logo',
            showUsageNotice &&
              'max-w-[min(calc(100vw-2rem),18rem)] whitespace-normal break-words [overflow-wrap:anywhere] p-3 text-left leading-snug shadow-lg'
          )}
        >
          {usageExceeded ? (
            <div className="space-y-1">
              <p className="font-medium text-red-400">Usage limit exceeded</p>
              <p className="text-[10px] leading-snug text-white/70">
                You've used {formatCurrency(usageData?.currentUsage)} of{' '}
                {formatCurrency(usageData?.limit)}. Upgrade your plan to continue running workflows.
              </p>
            </div>
          ) : showUsageWarning ? (
            <div className="space-y-1">
              <p className="font-medium text-amber-300">Usage limit warning</p>
              <p className="text-[10px] leading-snug text-white/70">
                You've used {usageData?.percentUsed ?? 0}% of your workflow run budget. You can keep
                running this workflow, but you may need to upgrade soon.
              </p>
            </div>
          ) : (
            <>
              {isDebugModeEnabled ? 'Debug Mode' : 'Run Workflow'}
              <span className="text-white/50 ml-1">{getKeyboardShortcutText('Enter', true)}</span>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
