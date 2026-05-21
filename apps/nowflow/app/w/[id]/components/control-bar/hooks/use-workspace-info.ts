'use client'

import { useEffect, useState } from 'react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ControlBar')

/**
 * Fetch workspace name for a given workspace ID.
 */
export function useWorkspaceInfo(activeWorkspaceId: string | undefined) {
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchWorkspaceInfo() {
      if (!activeWorkspaceId) {
        setWorkspaceName('')
        return
      }

      try {
        const response = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setWorkspaceName(data.workspace?.name || 'Unknown Workspace')
      } catch (error) {
        if (isAbortLikeError(error, abortController.signal)) {
          return
        }
        logger.error('Failed to fetch workspace info:', { error })
        setWorkspaceName('Unknown Workspace')
      }
    }

    fetchWorkspaceInfo()

    return () => {
      abortController.abort()
    }
  }, [activeWorkspaceId])

  return workspaceName
}
