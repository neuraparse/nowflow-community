'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'

const logger = createLogger('WorkspacePage')

export default function WorkspacePage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { workflows, isLoading: workflowsLoading } = useWorkflowRegistry()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    async function redirectToWorkspace() {
      logger.info('WorkspacePage mounted', {
        isPending,
        hasSession: !!session,
        workflowsLoading,
        workflowCount: Object.keys(workflows).length,
      })

      // Wait for session to load
      if (isPending) {
        logger.debug('Session is still loading...')
        return
      }

      // CRITICAL: Wait for workflows to load from DB
      if (workflowsLoading) {
        logger.debug('Workflows are still loading from DB, waiting...')
        return
      }

      // Prevent multiple redirects
      if (isRedirecting) {
        logger.debug('Already redirecting, skipping...')
        return
      }

      // If not logged in, redirect to login
      if (!session?.user) {
        logger.warn('No session found, redirecting to login')
        setIsRedirecting(true)
        router.push('/login')
        return
      }

      logger.info('Session found, checking workflows from registry', {
        userId: session.user.id,
        userEmail: session.user.email,
        workflowCount: Object.keys(workflows).length,
      })

      try {
        setIsRedirecting(true)

        // First, check if we have a last active workflow ID saved
        const lastActiveWorkflowId = localStorage.getItem('last-active-workflow-id')

        if (lastActiveWorkflowId && workflows[lastActiveWorkflowId]) {
          logger.info('Found last active workflow in registry, redirecting', {
            workflowId: lastActiveWorkflowId,
          })
          router.push(`/w/${lastActiveWorkflowId}`)
          return
        }

        // Use workflows from registry (already loaded from DB)
        const workflowList = Object.values(workflows)

        if (workflowList.length > 0) {
          // Sort by lastModified to get the most recent workflow
          const sortedWorkflows = workflowList.sort((a, b) => {
            const dateA = new Date(a.lastModified || 0).getTime()
            const dateB = new Date(b.lastModified || 0).getTime()
            return dateB - dateA
          })

          const firstWorkflow = sortedWorkflows[0]
          logger.info('Redirecting to most recent workflow from registry', {
            workflowId: firstWorkflow.id,
            workflowName: firstWorkflow.name,
          })
          router.push(`/w/${firstWorkflow.id}`)
        } else {
          // No workflows exist in registry after DB load completed
          // This is a valid state - user will use sidebar "+" button to create first workflow
          logger.info('No workflows found - user needs to create first workflow via sidebar')
          setIsRedirecting(false)
          // Stay on /w page, show empty state
        }
      } catch (error) {
        logger.error('Error in redirect logic', { error })
        setIsRedirecting(false)
      }
    }

    redirectToWorkspace()
  }, [session, isPending, workflows, workflowsLoading, router, isRedirecting])

  // Show loading state or empty state
  if (isPending || workflowsLoading) {
    return (
      <div className="workspace-stage flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full border-4 border-primary/10" />
          </div>
          <div className="text-center">
            <p className="text-lg font-logo font-medium text-zinc-800 dark:text-white">
              {isPending ? 'Loading session...' : 'Loading workflows...'}
            </p>
            <p className="mt-2 text-sm font-logo text-zinc-400 dark:text-white/40">
              Please wait...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state - no workflows
  if (!isRedirecting && Object.keys(workflows).length === 0) {
    return (
      <div className="workspace-stage flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
          <div className="rounded-full bg-primary/10 p-6">
            <svg
              className="h-12 w-12 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-logo font-semibold text-zinc-800 dark:text-white">
              Welcome to NowFlow
            </h2>
            <p className="mt-3 font-logo text-zinc-400 dark:text-white/40">
              You don't have any workflows yet. Click the "+" button in the sidebar to create your
              first workflow.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Redirecting state
  return (
    <div className="workspace-stage flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full border-4 border-primary/10" />
        </div>
        <div className="text-center">
          <p className="text-lg font-logo font-medium text-zinc-800 dark:text-white">
            Redirecting to workspace...
          </p>
          <p className="mt-2 text-sm font-logo text-zinc-400 dark:text-white/40">Please wait...</p>
        </div>
      </div>
    </div>
  )
}
