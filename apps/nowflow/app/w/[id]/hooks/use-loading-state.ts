'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'

interface LoadingInfo {
  message: string
  submessage: string
}

/**
 * Computes the workspace loading overlay state and message.
 */
export function useLoadingState({
  isInitialized,
  isLoadingWorkflow,
  isUIReady,
  activeWorkflowId,
}: {
  isInitialized: boolean
  isLoadingWorkflow: boolean
  isUIReady: boolean
  activeWorkflowId: string | null
}) {
  const params = useParams()
  const currentRouteId = params.id as string

  const isWorkflowMismatch =
    activeWorkflowId && activeWorkflowId !== currentRouteId && isLoadingWorkflow

  const showWorkspaceLoading =
    !isInitialized || isLoadingWorkflow || !isUIReady || !activeWorkflowId || !!isWorkflowMismatch

  const loadingInfo: LoadingInfo = useMemo(() => {
    if (!isInitialized) {
      return { message: 'Initializing...', submessage: 'Setting up workspace' }
    }
    if (isWorkflowMismatch) {
      return { message: 'Switching workflow...', submessage: 'Loading the selected workflow' }
    }
    if (isLoadingWorkflow) {
      return { message: 'Loading workflow...', submessage: 'Preparing your workflow' }
    }
    if (!activeWorkflowId) {
      return { message: 'Selecting workflow...', submessage: 'Loading your workflow' }
    }
    if (!isUIReady) {
      return { message: 'Preparing canvas...', submessage: 'Almost ready' }
    }
    return { message: 'Loading...', submessage: 'Please wait' }
  }, [isInitialized, isWorkflowMismatch, isLoadingWorkflow, activeWorkflowId, isUIReady])

  return {
    showWorkspaceLoading,
    showControlBarShell: showWorkspaceLoading,
    loadingInfo,
  }
}
