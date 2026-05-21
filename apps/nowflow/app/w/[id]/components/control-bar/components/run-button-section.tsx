'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowCancelIcon } from '@/components/workflow-control-icons'
import { getKeyboardShortcutText } from '../../../hooks/use-keyboard-shortcuts'
import type { UsageData } from '../types'
import { DebugControls, RunProgressIndicator } from './debug-controls'
import { RunButton } from './run-button'

interface RunButtonSectionProps {
  isDebugModeEnabled: boolean
  isExecuting: boolean
  isMultiRunning: boolean
  isCancelling: boolean
  isDebugging: boolean
  runCount: number
  usageExceeded: boolean
  usageData: UsageData | null
  showRunProgress: boolean
  completedRuns: number
  pendingBlocks: string[]
  onRun: () => void
  onSetRunCount: (count: number) => void
  onOpenSubscriptionSettings: () => void
  onCancelMultiRun: () => void
  onStepDebug: () => void
  onResumeDebug: () => void
  onCancelDebug: () => void
}

export function RunButtonSection({
  isDebugModeEnabled,
  isExecuting,
  isMultiRunning,
  isCancelling,
  isDebugging,
  runCount,
  usageExceeded,
  usageData,
  showRunProgress,
  completedRuns,
  pendingBlocks,
  onRun,
  onSetRunCount,
  onOpenSubscriptionSettings,
  onCancelMultiRun,
  onStepDebug,
  onResumeDebug,
  onCancelDebug,
}: RunButtonSectionProps) {
  const renderDebugControls = () => {
    if (!isDebugModeEnabled || !isDebugging) return null

    return (
      <DebugControls
        pendingCount={pendingBlocks.length}
        onStepDebug={onStepDebug}
        onResumeDebug={onResumeDebug}
        onCancelDebug={onCancelDebug}
      />
    )
  }

  return (
    <div className="flex items-center">
      {showRunProgress && isMultiRunning && (
        <RunProgressIndicator completedRuns={completedRuns} runCount={runCount} />
      )}

      {renderDebugControls()}

      <RunButton
        isDebugModeEnabled={isDebugModeEnabled}
        isExecuting={isExecuting}
        isMultiRunning={isMultiRunning}
        isCancelling={isCancelling}
        isDebugging={isDebugging}
        runCount={runCount}
        usageExceeded={usageExceeded}
        colorTheme="emerald"
        usageData={
          usageData
            ? {
                currentUsage: usageData.currentUsage,
                limit: usageData.limit,
                percentUsed: usageData.percentUsed,
                isWarning: usageData.isWarning,
              }
            : undefined
        }
        onRun={onRun}
        onMultipleRuns={onRun}
        onOpenSubscriptionSettings={onOpenSubscriptionSettings}
        onSetRunCount={onSetRunCount}
        getKeyboardShortcutText={getKeyboardShortcutText}
      />

      {isMultiRunning && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-control-action="cancel"
              variant="outline"
              size="icon"
              onClick={onCancelMultiRun}
              disabled={isCancelling}
              className="silver-glass-button ml-2 h-10 w-10 rounded-2xl border-red-500/15 text-red-600 transition-all duration-300 hover:bg-red-50/80 hover:text-red-600 hover:shadow-[0_0_0_4px_rgba(239,68,68,0.08)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-400/20 dark:text-red-300 dark:hover:bg-red-950/20 dark:hover:text-red-300"
              aria-label={`Cancel ${runCount > 1 ? 'runs' : 'run'}`}
            >
              <WorkflowCancelIcon className="h-4 w-4" />
              <span className="sr-only">Cancel Runs</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="bg-[#1b1b1b] text-white border-none text-[11px] font-logo"
          >
            {runCount > 1 ? 'Cancel Runs' : 'Cancel Run'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
