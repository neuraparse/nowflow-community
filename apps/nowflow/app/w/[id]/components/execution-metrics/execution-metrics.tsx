'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'
import { useExecutionStore } from '@/stores/execution/store'
import { usePanelStore } from '@/stores/panel/store'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

export function ExecutionMetrics() {
  const {
    isExecuting,
    activeBlockIds,
    completedBlockIds,
    errorBlockIds,
    executionSuccess,
    executionError,
    executionStartTime,
    executionDuration,
  } = useExecutionStore()

  const totalBlocks = useWorkflowStore((state) => Object.keys(state.blocks).length)
  const isRightSidebarOpen = useWorkflowStore((state) => state.isRightSidebarOpen)
  const { isOpen: isPanelOpen, position: panelPosition, dimensions } = usePanelStore()
  const { mode, isExpanded } = useSidebarStore()

  const [elapsedTime, setElapsedTime] = useState<number | null>(null)

  useEffect(() => {
    if (!isExecuting || !executionStartTime) {
      setElapsedTime(null)
      return
    }

    const startTime = new Date(executionStartTime).getTime()
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)

    return () => clearInterval(timer)
  }, [isExecuting, executionStartTime])

  const completedCount = completedBlockIds.size
  const errorCount = errorBlockIds.size
  const activeCount = activeBlockIds.size
  const trackedCount = Math.min(activeCount + completedCount + errorCount, totalBlocks)
  const trackedLabel =
    totalBlocks > 0 ? `${trackedCount} / ${totalBlocks} blocks tracked` : 'No blocks wired'
  const progress = Math.round(((completedCount + errorCount) / Math.max(totalBlocks, 1)) * 100)
  const timeToDisplay = executionDuration || elapsedTime || 0

  const status = useMemo(() => {
    if (isExecuting) {
      return {
        label: 'Running',
        accentClass: 'workflow-editor-task-engine-status--running',
        icon: <Clock className="h-3.5 w-3.5" />,
      }
    }

    if (executionSuccess === true) {
      return {
        label: 'Completed',
        accentClass: 'workflow-editor-task-engine-status--success',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      }
    }

    if (executionSuccess === false) {
      return {
        label: 'Failed',
        accentClass: 'workflow-editor-task-engine-status--error',
        icon: <XCircle className="h-3.5 w-3.5" />,
      }
    }

    return {
      label: 'Idle',
      accentClass: 'workflow-editor-task-engine-status--idle',
      icon: <Clock className="h-3.5 w-3.5" />,
    }
  }, [executionSuccess, isExecuting])

  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'
  const sidebarWidth = isSidebarCollapsed ? 64 : 256
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
  const dockedPanelWidth =
    panelPosition === 'bottom' && isPanelOpen
      ? Math.min(
          Math.max(Math.min(dimensions.width, 760), 520),
          Math.min(
            820,
            Math.max(520, viewportWidth - sidebarWidth - (isRightSidebarOpen ? 452 : 24) - 28)
          )
        )
      : null

  const panelAnchoredLeft =
    dockedPanelWidth !== null ? sidebarWidth + 12 + dockedPanelWidth + 28 : null
  const maxLeft = viewportWidth - (isRightSidebarOpen ? 452 : 28) - 320
  const engineLeft =
    panelAnchoredLeft !== null
      ? Math.min(panelAnchoredLeft, Math.max(sidebarWidth + 24, maxLeft))
      : null

  if (!isExecuting) return null

  return (
    <div
      className="workflow-editor-task-engine fixed z-40"
      style={
        engineLeft !== null
          ? { left: `${engineLeft}px`, bottom: '18px' }
          : { right: `${isRightSidebarOpen ? 452 : 24}px`, bottom: '18px' }
      }
    >
      <div className="workflow-editor-task-engine-header">
        <span className="workflow-editor-task-engine-kicker">Local Task Engine</span>
        <span className="workflow-editor-task-engine-runtime">
          {timeToDisplay > 0 ? formatDuration(timeToDisplay) : 'Standby'}
        </span>
      </div>

      <div className="workflow-editor-task-engine-frame">
        <div className="workflow-editor-task-engine-label-row">
          <span>Engine Status</span>
          <span className={cn('workflow-editor-task-engine-status', status.accentClass)}>
            {status.icon}
            {status.label}
          </span>
        </div>

        <div className="workflow-editor-task-engine-progress">
          <div
            className="workflow-editor-task-engine-progress-bar"
            style={{ width: `${isExecuting || executionSuccess !== null ? progress : 0}%` }}
          />
        </div>

        <div className="workflow-editor-task-engine-grid">
          <div className="workflow-editor-task-engine-metric">
            <span className="workflow-editor-task-engine-metric-label">Active</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="workflow-editor-task-engine-metric">
            <span className="workflow-editor-task-engine-metric-label">Done</span>
            <strong>{completedCount}</strong>
          </div>
          <div className="workflow-editor-task-engine-metric">
            <span className="workflow-editor-task-engine-metric-label">Failed</span>
            <strong>{errorCount}</strong>
          </div>
        </div>

        {executionError ? (
          <div className="workflow-editor-task-engine-alert">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{executionError}</span>
          </div>
        ) : (
          <div className="workflow-editor-task-engine-footer">
            <span>{trackedLabel}</span>
            <span>{status.label.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  )
}
