'use client'

import { useRef, useState } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { useNotificationStore } from '@/stores/notifications/store'
import { usePanelStore } from '@/stores/panel/store'
import type { UsageData } from '../types'

const logger = createLogger('ControlBar')

interface UseMultipleRunsOptions {
  activeWorkflowId: string | undefined
  isExecuting: boolean
  handleRunWorkflow: (workflowInput?: unknown) => Promise<unknown>
  usageExceeded: boolean
  setUsageExceeded: (exceeded: boolean) => void
  setUsageData: (data: UsageData | null) => void
  checkUserUsage: (userId: string, forceRefresh?: boolean) => Promise<UsageData | null>
  userId: string | undefined
  openSubscriptionSettings: () => void
}

export function useMultipleRuns({
  activeWorkflowId,
  isExecuting,
  handleRunWorkflow,
  usageExceeded,
  setUsageExceeded,
  setUsageData,
  checkUserUsage,
  userId,
  openSubscriptionSettings,
}: UseMultipleRunsOptions) {
  const { addNotification } = useNotificationStore()
  const { setActiveTab } = usePanelStore()

  const [runCount, setRunCount] = useState(1)
  const [completedRuns, setCompletedRuns] = useState(0)
  const [isMultiRunning, setIsMultiRunning] = useState(false)
  const [showRunProgress, setShowRunProgress] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const cancelFlagRef = useRef(false)

  const handleMultipleRuns = async () => {
    if (isExecuting || isMultiRunning || runCount <= 0) return

    if (usageExceeded) {
      openSubscriptionSettings()
      return
    }

    setActiveTab('console')
    setCompletedRuns(0)
    setIsMultiRunning(true)
    setIsCancelling(false)
    cancelFlagRef.current = false
    setShowRunProgress(runCount > 1)

    let workflowError: Error | null = null
    let wasCancelled = false
    let runCounter = 0

    try {
      for (let i = 0; i < runCount; i++) {
        if (cancelFlagRef.current) {
          logger.info('Multi-run cancellation requested by user.')
          wasCancelled = true
          break
        }

        await handleRunWorkflow()
        runCounter = i + 1
        setCompletedRuns(runCounter)

        const shouldCheckUsage = i === 0 || (i + 1) % 5 === 0 || i === runCount - 1

        if (shouldCheckUsage && userId) {
          const usage = await checkUserUsage(userId, i === 0)

          if (usage?.isExceeded) {
            setUsageExceeded(true)
            setUsageData(usage)

            if (i < runCount - 1) {
              addNotification(
                'info',
                `Usage limit reached after ${runCounter} runs. Execution stopped.`,
                activeWorkflowId
              )
              break
            }
          }
        }
      }

      if (!wasCancelled && activeWorkflowId && runCounter > 0) {
        fetch(`/api/workflows/${activeWorkflowId}/stats?runs=${runCounter}`, {
          method: 'POST',
        }).catch((error) => {
          logger.error('Failed to update workflow stats:', { error })
        })
      }
    } catch (error) {
      workflowError = error instanceof Error ? error : new Error('Unknown error')
      logger.error('Error during multiple workflow runs:', { error })
    } finally {
      setIsMultiRunning(false)
      setIsCancelling(false)
      cancelFlagRef.current = false

      if (runCount > 1) {
        setTimeout(() => setShowRunProgress(false), 1000)
      } else {
        setShowRunProgress(false)
      }

      if (wasCancelled) {
        addNotification('info', 'Workflow run cancelled', activeWorkflowId)
      } else if (workflowError) {
        addNotification('error', 'Failed to complete all workflow runs', activeWorkflowId)
      } else if (runCount > 1) {
        addNotification('console', `Completed ${runCounter} workflow runs`, activeWorkflowId)
      }
    }
  }

  const handleCancelMultiRun = () => {
    logger.info('Cancel button clicked - setting ref and state')
    cancelFlagRef.current = true
    setIsCancelling(true)
  }

  return {
    runCount,
    setRunCount,
    completedRuns,
    isMultiRunning,
    showRunProgress,
    isCancelling,
    handleMultipleRuns,
    handleCancelMultiRun,
  }
}
