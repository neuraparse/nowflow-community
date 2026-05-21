'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createLogger } from '@/lib/logs/console-logger'
import { useNotificationStore } from '@/stores/notifications/store'
import { useVariablesStore } from '@/stores/panel/variables/store'
import { initializeSyncManagers, isSyncInitialized } from '@/stores/sync-registry'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { workflowSync } from '@/stores/workflows/sync'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { useWorkflowStream } from '@/hooks/use-workflow-stream'

const logger = createLogger('WorkflowInit')

/**
 * Manages the workflow initialization lifecycle:
 * - Client-side hydration mounting
 * - Sync system initialization
 * - Active workflow selection and navigation
 * - ReactFlow init tracking
 * - Fit-view on first load
 * - SSE stream connection
 */
export function useWorkflowInit() {
  const [isMounted, setIsMounted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isUIReady, setIsUIReady] = useState(false)

  const params = useParams()
  const router = useRouter()
  const { setActiveWorkflow, activeWorkflowId } = useWorkflowRegistry()
  const { markAllAsRead } = useNotificationStore()
  const { resetLoaded: resetVariablesLoaded } = useVariablesStore()
  const isLoadingWorkflow = useWorkflowRegistry((state) => state.isLoadingWorkflow)

  // Track if ReactFlow has initialized
  const hasReactFlowInitialized = useRef(false)
  // Track if we've already fit view for this workflow (only once per workflow)
  const hasFitViewForWorkflow = useRef<string | null>(null)
  // Track if we've already processed this workflow
  const lastProcessedIdRef = useRef<string | null>(null)

  // Hydration fix: Set mounted state after client-side hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // SSE-based real-time workflow updates
  const handleSSEUpdate = useCallback((data: any) => {
    logger.info('FRONTEND: Workflow SSE update received', {
      count: data.updates.length,
      timestamp: data.timestamp,
      updates: data.updates.map((u: any) => u.workflowId),
    })
    workflowSync.notifySSEUpdate()
  }, [])

  const { isConnected: isSSEConnected } = useWorkflowStream({
    enabled: isMounted && isInitialized,
    onUpdate: handleSSEUpdate,
  })

  // Initialize sync system
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initSync = async () => {
        await initializeSyncManagers()
        setIsInitialized(true)
      }

      if (isSyncInitialized()) {
        setIsInitialized(true)
      } else {
        initSync()
      }
    }
  }, [])

  // Reset UI ready state when workflow changes
  useEffect(() => {
    setIsUIReady(false)
    hasReactFlowInitialized.current = false

    const fallbackTimer = setTimeout(() => {
      if (!hasReactFlowInitialized.current) {
        console.warn('[Workflow] ReactFlow onInit timeout - forcing UI ready')
        setIsUIReady(true)
      }
    }, 1000)

    return () => clearTimeout(fallbackTimer)
  }, [params.id, activeWorkflowId])

  // ReactFlow onInit callback
  const onInit = useCallback(() => {
    hasReactFlowInitialized.current = true
    requestAnimationFrame(() => {
      console.debug('[Workflow] ReactFlow initialized - UI ready')
      setIsUIReady(true)
    })
  }, [])

  // Init workflow - validate and navigate
  useEffect(() => {
    if (!isInitialized || !isMounted) return

    const currentId = params.id as string
    const { workflows: currentWorkflows, activeWorkflowId } = useWorkflowRegistry.getState()
    const workflowIds = Object.keys(currentWorkflows)

    if (activeWorkflowId === currentId && lastProcessedIdRef.current === currentId) {
      logger.debug(`Already on workflow ${currentId} and processed`)
      return
    }

    const validateAndNavigate = async () => {
      if (workflowIds.length === 0) {
        logger.info('No workflows found, redirecting to /w')
        router.replace('/w')
        return
      }

      if (!currentWorkflows[currentId]) {
        logger.info(`Workflow ${currentId} not found, redirecting to ${workflowIds[0]}`)
        router.replace(`/w/${workflowIds[0]}`)
        return
      }

      if (activeWorkflowId !== currentId) {
        logger.info(`Switching to workflow ${currentId}`)
        resetVariablesLoaded()
        await setActiveWorkflow(currentId)
      }

      lastProcessedIdRef.current = currentId
      markAllAsRead(currentId)
    }

    validateAndNavigate()
  }, [
    params.id,
    isInitialized,
    isMounted,
    router,
    setActiveWorkflow,
    markAllAsRead,
    resetVariablesLoaded,
  ])

  return {
    isMounted,
    isInitialized,
    isUIReady,
    isLoadingWorkflow,
    activeWorkflowId,
    onInit,
    hasFitViewForWorkflow,
  }
}
