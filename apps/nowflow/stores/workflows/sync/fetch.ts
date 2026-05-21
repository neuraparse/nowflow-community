'use client'

/**
 * Fetches workflows from the database and updates the local stores.
 * Handles backwards syncing on initialization, cross-device conflict resolution,
 * and pending deletion/creation reconciliation.
 */
import { suggestWorkflowIcon } from '@/components/workflow-icons'
import { isAbortLikeError } from '@/lib/errors/network'
import { API_ENDPOINTS } from '../../constants'
import { mergeWorkflowStates } from '../conflict-resolution'
import { useWorkflowRegistry } from '../registry/store'
import { WorkflowMetadata } from '../registry/types'
import { hasRecentLocalChange, useSubBlockStore } from '../subblock/store'
import { stripTransientBlockFields } from '../utils'
import { useWorkflowStore } from '../workflow/store'
import { BlockState } from '../workflow/types'
import {
  FETCH_DEBOUNCE_MS,
  FETCH_THROTTLE_MS,
  PENDING_CREATE_TTL_MS,
  PENDING_DELETE_TTL_MS,
} from './constants'
import {
  isFetchInProgress,
  lastDBSyncTimestamp,
  lastFetchTime,
  lastFetchTimestamp,
  lastUserActionTime,
  logger,
  pendingFetchTimer,
  pendingSyncAfterCurrent,
  setHasLoggedPendingSync,
  setIsFetchInProgress,
  setIsLoadingFromDB,
  setLastDBSyncTimestamp,
  setLastFetchTime,
  setLastFetchTimestamp,
  setLoadingFromDBStartTime,
  setLoadingFromDBToken,
  setPendingFetchTimer,
  setPendingSyncAfterCurrent,
  setSkipInitialPoll,
} from './state'

// Use `var` with no initializer so this binding is available even during circular
// module evaluation. `sync-manager` can set it before `fetch.ts` finishes loading
// without tripping a TDZ error or being reset back to `null` later.
// eslint-disable-next-line no-var
var _workflowSync: any
export function _setWorkflowSyncRef(ref: any) {
  _workflowSync = ref
}

/**
 * Fetches workflows from the database and updates the local stores
 * This function handles backwards syncing on initialization
 */
export async function fetchWorkflowsFromDB(): Promise<void> {
  if (typeof window === 'undefined') return

  // ANTI-FLICKER: Minimal throttle to prevent duplicate fetches only
  const now = Date.now()
  const timeSinceLastFetch = now - lastFetchTime

  if (timeSinceLastFetch < FETCH_THROTTLE_MS) {
    logger.debug(
      `⏸️ Skipping fetch - last fetch was ${timeSinceLastFetch}ms ago (throttle: ${FETCH_THROTTLE_MS}ms)`
    )
    return
  }

  setLastFetchTime(now)

  try {
    // Set loading state in registry
    useWorkflowRegistry.getState().setLoading(true)

    // Set flag to prevent sync back to DB during loading
    setIsLoadingFromDB(true)
    setLoadingFromDBToken('loading')
    setLoadingFromDBStartTime(Date.now())

    // Get active workspace ID to filter workflows
    const activeWorkspaceId = useWorkflowRegistry.getState().activeWorkspaceId

    // Call the API endpoint to get workflows from DB with workspace filter
    const url = new URL(API_ENDPOINTS.SYNC, window.location.origin)
    if (activeWorkspaceId) {
      url.searchParams.append('workspaceId', activeWorkspaceId)
      logger.debug(`Fetching workflows for workspace: ${activeWorkspaceId}`)
    } else {
      logger.debug('Fetching workflows without workspace filter')
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
    })

    if (!response.ok) {
      if (response.status === 401) {
        logger.warn('User not authenticated for workflow fetch')
        return
      }

      // Handle case when workspace not found
      if (response.status === 404) {
        const responseData = await response.json()
        if (responseData.code === 'WORKSPACE_NOT_FOUND' && activeWorkspaceId) {
          logger.warn(`Workspace ${activeWorkspaceId} not found, it may have been deleted`)

          // Fetch user's available workspaces to switch to a valid one
          const workspacesResponse = await fetch('/api/workspaces', { method: 'GET' })
          if (workspacesResponse.ok) {
            const { workspaces } = await workspacesResponse.json()

            if (workspaces && workspaces.length > 0) {
              // Switch to the first available workspace
              const firstWorkspace = workspaces[0]
              logger.debug(`Switching to available workspace: ${firstWorkspace.id}`)
              useWorkflowRegistry.getState().setActiveWorkspace(firstWorkspace.id)
              return
            }
          }
        }
      }

      logger.error('Failed to fetch workflows:', response.statusText)
      return
    }

    // Parse JSON response with error handling
    let responseData
    try {
      responseData = await response.json()
    } catch (jsonError) {
      logger.error('Failed to parse workflow response JSON:', {
        error: jsonError,
        message: jsonError instanceof Error ? jsonError.message : String(jsonError),
        status: response.status,
        statusText: response.statusText,
      })
      return
    }

    const { data } = responseData

    logger.debug('📥 Received workflows from API', {
      count: data?.length || 0,
      workspaceId: activeWorkspaceId,
    })

    const pendingDeletionIds = useWorkflowRegistry.getState().pendingDeletionIds
    const pendingDeletionCount = Object.keys(pendingDeletionIds).length
    const pendingCreationIds = useWorkflowRegistry.getState().pendingCreationIds
    const pendingCreationCount = Object.keys(pendingCreationIds).length
    const pendingCheckTime = Date.now()
    const pendingDeleteCutoff = pendingCheckTime - PENDING_DELETE_TTL_MS
    const pendingCreateCutoff = pendingCheckTime - PENDING_CREATE_TTL_MS

    if (!data || !Array.isArray(data) || data.length === 0) {
      logger.debug(
        `No workflows found in database for ${activeWorkspaceId ? `workspace ${activeWorkspaceId}` : 'user'}`
      )
      const currentWorkflows = useWorkflowRegistry.getState().workflows
      const currentCount = Object.keys(currentWorkflows).length

      if (
        pendingDeletionCount > 0 &&
        Array.isArray(data) &&
        data.length === 0 &&
        currentCount === 0
      ) {
        useWorkflowRegistry.setState({ pendingDeletionIds: {} })
      }

      if (
        pendingCreationCount > 0 &&
        Array.isArray(data) &&
        data.length === 0 &&
        currentCount === 0
      ) {
        useWorkflowRegistry.setState({ pendingCreationIds: {} })
      }

      if (currentCount > 0) {
        logger.warn(
          `⚠️ DB returned empty but we have ${currentCount} local workflows - PRESERVING local data to prevent loss!`
        )
        logger.warn(
          `This could mean: 1) Sync in progress, 2) Network issue, 3) DB query error. ` +
            `NOT clearing local workflows to prevent data loss. User can manually delete if needed.`
        )
        return
      }

      logger.debug('✅ DB and local state both empty - nothing to sync')
      return
    }

    let effectivePendingDeletionIds = pendingDeletionIds
    if (pendingDeletionCount > 0) {
      const dbIds = new Set(data.map((workflow: any) => workflow.id))
      const filteredPending: Record<string, number> = {}

      Object.entries(pendingDeletionIds).forEach(([id, requestedAt]) => {
        if (dbIds.has(id) && requestedAt > pendingDeleteCutoff) {
          filteredPending[id] = requestedAt
        }
      })

      if (Object.keys(filteredPending).length !== pendingDeletionCount) {
        useWorkflowRegistry.setState({ pendingDeletionIds: filteredPending })
      }

      effectivePendingDeletionIds = filteredPending
    }

    let effectivePendingCreationIds = pendingCreationIds
    if (pendingCreationCount > 0) {
      const dbIds = new Set(data.map((workflow: any) => workflow.id))
      const filteredPending: Record<string, number> = {}

      Object.entries(pendingCreationIds).forEach(([id, requestedAt]) => {
        if (dbIds.has(id)) {
          return
        }

        if (requestedAt > pendingCreateCutoff) {
          filteredPending[id] = requestedAt
        }
      })

      if (Object.keys(filteredPending).length !== pendingCreationCount) {
        useWorkflowRegistry.setState({ pendingCreationIds: filteredPending })
      }

      effectivePendingCreationIds = filteredPending
    }

    // Count shared vs owned
    const sharedCount = data.filter((w: any) => w.isShared).length
    const ownedCount = data.filter((w: any) => !w.isShared).length
    logger.debug('📊 Workflow breakdown', {
      total: data.length,
      owned: ownedCount,
      shared: sharedCount,
    })

    // Process workflows and update stores
    const registryWorkflows: Record<string, WorkflowMetadata> = {}
    const workflowStates: Record<string, any> = {}

    // Process each workflow from the database
    data.forEach((workflow: any) => {
      const {
        id,
        name,
        description,
        color,
        state,
        lastSynced,
        isDeployed,
        deployedAt,
        apiKey,
        createdAt,
        marketplaceData,
        workspaceId,
        isShared,
        role,
      } = workflow

      if (effectivePendingDeletionIds[id]) {
        logger.debug(`Skipping workflow ${id} - pending deletion`)
        return
      }

      if (activeWorkspaceId && workspaceId !== activeWorkspaceId && !isShared) {
        logger.warn(
          `Skipping workflow ${id} as it belongs to workspace ${workspaceId}, not the active workspace ${activeWorkspaceId}`
        )
        return
      }

      // Prepare workflow state data
      const workflowState = {
        blocks: stripTransientBlockFields(state.blocks || {}),
        edges: state.edges || [],
        loops: state.loops || {},
        groups: state.groups || {},
        selectedNodeIds: state.selectedNodeIds || [],
        isDeployed: isDeployed || false,
        deployedAt: deployedAt ? new Date(deployedAt) : undefined,
        apiKey,
        lastSaved: Date.now(),
        marketplaceData: marketplaceData || null,
      }

      // Update registry store with workflow metadata AND state
      registryWorkflows[id] = {
        id,
        name,
        description: description || '',
        color: color || '#3972F6',
        icon: workflow.icon || suggestWorkflowIcon(name).id,
        lastModified: createdAt ? new Date(createdAt) : new Date(lastSynced),
        isShared: isShared || false,
        state: workflowState,
        role: role || 'owner',
        marketplaceData: marketplaceData || null,
        workspaceId,
        lastFetchedAt: Date.now(),
      }

      if (isShared) {
        logger.debug(`✨ Shared workflow added to registry`, {
          id,
          name,
          role,
          workflowWorkspace: workspaceId,
          activeWorkspace: activeWorkspaceId || 'none',
          crossWorkspace: activeWorkspaceId && workspaceId !== activeWorkspaceId,
        })
      }

      workflowStates[id] = workflowState

      // Initialize subblock values from the workflow state
      const subblockValues: Record<string, Record<string, any>> = {}

      Object.entries(workflowState.blocks).forEach(([blockId, block]) => {
        const blockState = block as BlockState
        subblockValues[blockId] = {}

        Object.entries(blockState.subBlocks || {}).forEach(([subblockId, subblock]) => {
          subblockValues[blockId][subblockId] = subblock.value
        })
      })

      // Get any additional subblock values from store
      const storedValues = useSubBlockStore.getState().workflowValues[id] || {}
      Object.entries(storedValues).forEach(([blockId, blockValues]) => {
        if (!subblockValues[blockId]) {
          subblockValues[blockId] = {}
        }

        Object.entries(blockValues).forEach(([subblockId, value]) => {
          if (
            subblockValues[blockId][subblockId] === null ||
            subblockValues[blockId][subblockId] === undefined
          ) {
            subblockValues[blockId][subblockId] = value
          }
        })
      })

      // Store the workflow state and subblock values in localStorage
      localStorage.setItem(`workflow-${id}`, JSON.stringify(workflowState))
      localStorage.setItem(`subblock-values-${id}`, JSON.stringify(subblockValues))

      // Mark shared workflows as read-only in localStorage if viewer
      if (isShared && role === 'viewer') {
        localStorage.setItem(`workflow-${id}-readonly`, 'true')
      } else {
        localStorage.removeItem(`workflow-${id}-readonly`)
      }

      // Restore toolParams from database for cross-device API key persistence
      const dbToolParams = (state as any).toolParams || {}

      // Preserve local changes when updating from DB
      useSubBlockStore.setState((currentState) => {
        const existingWorkflowValues = currentState.workflowValues[id] || {}
        const mergedValues: Record<string, Record<string, any>> = {}

        Object.entries(subblockValues).forEach(([blockId, blockValues]) => {
          mergedValues[blockId] = { ...blockValues }
        })

        Object.entries(existingWorkflowValues).forEach(([blockId, blockValues]) => {
          if (!mergedValues[blockId]) {
            mergedValues[blockId] = {}
          }
          Object.entries(blockValues).forEach(([subblockId, localValue]) => {
            if (hasRecentLocalChange(id, blockId, subblockId)) {
              mergedValues[blockId][subblockId] = localValue
              logger.debug(
                `🛡️ Preserving local change for ${blockId}.${subblockId} - user is actively editing`
              )
            }
          })
        })

        return {
          workflowValues: {
            ...currentState.workflowValues,
            [id]: mergedValues,
          },
          toolParams: {
            ...dbToolParams,
            ...currentState.toolParams,
          },
        }
      })
    })

    if (Object.keys(effectivePendingCreationIds).length > 0) {
      const currentWorkflows = useWorkflowRegistry.getState().workflows
      Object.keys(effectivePendingCreationIds).forEach((id) => {
        if (effectivePendingDeletionIds[id]) return
        if (registryWorkflows[id]) return

        const localWorkflow = currentWorkflows[id]
        if (!localWorkflow) return

        if (
          activeWorkspaceId &&
          localWorkflow.workspaceId &&
          localWorkflow.workspaceId !== activeWorkspaceId &&
          !localWorkflow.isShared
        ) {
          return
        }

        registryWorkflows[id] = localWorkflow
      })
    }

    logger.debug(
      `Loaded ${Object.keys(registryWorkflows).length} workflows for ${activeWorkspaceId ? `workspace ${activeWorkspaceId}` : 'user'}`
    )

    // Update registry store with all workflows
    useWorkflowRegistry.setState({ workflows: registryWorkflows })

    // REAL-TIME COLLABORATION: Smart cross-device sync for active workflow
    const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId

    if (activeWorkflowId && registryWorkflows[activeWorkflowId]) {
      logger.debug(
        `🔄 Active workflow ${activeWorkflowId} found in DB - checking for cross-device updates`
      )

      const dbWorkflow = data.find((w: any) => w.id === activeWorkflowId)
      if (!dbWorkflow) {
        logger.warn(`⚠️ Active workflow ${activeWorkflowId} not found in DB response`)
      } else {
        const currentState = useWorkflowStore.getState()
        const localBlocks = currentState.blocks || {}
        const localEdges = currentState.edges || []
        const localGroups = currentState.groups || {}
        const localLoops = currentState.loops || {}
        const localLastSaved = currentState.lastSaved || 0

        const dbState = dbWorkflow.state || {}
        const dbBlocks = dbState.blocks || {}
        const dbEdges = dbState.edges || []
        const dbGroups = dbState.groups || {}
        const dbLoops = dbState.loops || {}
        const dbLastSynced = dbWorkflow.lastSynced ? new Date(dbWorkflow.lastSynced).getTime() : 0

        const timeSinceLastUserAction = Date.now() - lastUserActionTime

        if (dbLastSynced > localLastSaved && dbLastSynced > lastDBSyncTimestamp) {
          logger.debug(
            `🔀 DB has newer changes - performing smart merge (last user action ${Math.round(timeSinceLastUserAction / 1000)}s ago)`
          )

          const mergeResult = mergeWorkflowStates(
            localBlocks,
            localEdges,
            localGroups,
            localLoops,
            dbBlocks,
            dbEdges,
            dbGroups,
            dbLoops,
            lastUserActionTime,
            undefined,
            undefined,
            activeWorkflowId
          )

          logger.debug(
            `✅ Smart merge complete - ${mergeResult.conflicts.length} conflicts resolved`,
            {
              blocks: Object.keys(mergeResult.blocks).length,
              edges: mergeResult.edges.length,
              groups: Object.keys(mergeResult.groups).length,
              loops: Object.keys(mergeResult.loops).length,
              conflicts: mergeResult.conflicts.map((c: any) => ({
                type: c.type,
                id: c.id,
                resolution: c.resolution,
              })),
            }
          )

          useWorkflowStore.setState({
            blocks: mergeResult.blocks,
            edges: mergeResult.edges,
            groups: mergeResult.groups,
            loops: mergeResult.loops,
            lastSaved: dbLastSynced,
          })

          useSubBlockStore.setState((currentSubBlockState) => {
            const mergedSubBlockValues: Record<string, Record<string, any>> = {}

            Object.entries(mergeResult.blocks).forEach(([blockId, block]) => {
              const blockState = block as BlockState
              mergedSubBlockValues[blockId] = {}

              Object.entries(blockState.subBlocks || {}).forEach(([subblockId, subblock]) => {
                if (hasRecentLocalChange(activeWorkflowId, blockId, subblockId)) {
                  const localValue =
                    currentSubBlockState.workflowValues[activeWorkflowId]?.[blockId]?.[subblockId]
                  if (localValue !== undefined) {
                    mergedSubBlockValues[blockId][subblockId] = localValue
                    return
                  }
                }
                mergedSubBlockValues[blockId][subblockId] = subblock.value
              })
            })

            return {
              workflowValues: {
                ...currentSubBlockState.workflowValues,
                [activeWorkflowId]: mergedSubBlockValues,
              },
            }
          })

          useWorkflowRegistry.setState((state) => ({
            workflows: {
              ...state.workflows,
              [activeWorkflowId]: {
                ...state.workflows[activeWorkflowId],
                state: {
                  blocks: mergeResult.blocks,
                  edges: mergeResult.edges,
                  groups: mergeResult.groups,
                  loops: mergeResult.loops,
                  selectedNodeIds: state.workflows[activeWorkflowId]?.state?.selectedNodeIds || [],
                  isDeployed: state.workflows[activeWorkflowId]?.state?.isDeployed || false,
                  deployedAt: state.workflows[activeWorkflowId]?.state?.deployedAt,
                  apiKey: state.workflows[activeWorkflowId]?.state?.apiKey,
                  lastSaved: dbLastSynced,
                  marketplaceData:
                    state.workflows[activeWorkflowId]?.state?.marketplaceData || null,
                },
              },
            },
          }))

          localStorage.setItem(
            `workflow-${activeWorkflowId}`,
            JSON.stringify({
              blocks: mergeResult.blocks,
              edges: mergeResult.edges,
              loops: mergeResult.loops,
              groups: mergeResult.groups,
              selectedNodeIds: [],
              lastSaved: dbLastSynced,
            })
          )

          setLastDBSyncTimestamp(dbLastSynced)
        } else {
          logger.debug(`⏭️ No cross-device changes detected - DB and local are in sync`)
        }
      }
    }

    if (!activeWorkflowId && Object.keys(registryWorkflows).length > 0) {
      const firstWorkflowId = Object.keys(registryWorkflows)[0]

      const workflowState = JSON.parse(localStorage.getItem(`workflow-${firstWorkflowId}`) || '{}')

      if (Object.keys(workflowState).length > 0) {
        useWorkflowStore.setState(workflowState)
        useWorkflowRegistry.setState({ activeWorkflowId: firstWorkflowId })
        logger.debug(`Set first workflow ${firstWorkflowId} as active`)
      }
    }
  } catch (error) {
    if (isAbortLikeError(error)) {
      return
    }

    logger.error('Error fetching workflows from DB:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  } finally {
    // CRITICAL: Clear loading token IMMEDIATELY to unblock user action syncs
    setIsLoadingFromDB(false)
    setLoadingFromDBToken(null)
    setHasLoggedPendingSync(false)

    // IMMEDIATE: Execute any pending syncs that were queued during load
    if (pendingSyncAfterCurrent) {
      setPendingSyncAfterCurrent(false)
      logger.debug('🔄 Executing sync that was queued during DB load (immediate)')
      setTimeout(() => {
        _workflowSync?.syncImmediate()
      }, 10)
    }

    // State settling and UI updates can happen asynchronously
    setTimeout(() => {
      useWorkflowRegistry.getState().setLoading(false)

      const registryWorkflows = useWorkflowRegistry.getState().workflows
      const workflowCount = Object.keys(registryWorkflows).length
      logger.debug(`DB loading complete. Workflows in registry: ${workflowCount}`)

      // Mark that initial fetch completed - skip redundant poll in startAutoPolling()
      setSkipInitialPoll(true)

      const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
      if (workflowCount > 0 && activeWorkflowId && activeDBSyncNeeded()) {
        setTimeout(() => {
          _workflowSync?.sync()
        }, 300)
      }
    }, 100)
  }
}

/**
 * Helper to determine if an active DB sync is actually needed
 */
function activeDBSyncNeeded(): boolean {
  const lastSynced = localStorage.getItem('last_db_sync_timestamp')
  const currentTime = Date.now()

  if (!lastSynced) {
    localStorage.setItem('last_db_sync_timestamp', currentTime.toString())
    return true
  }

  const timeSinceLastSync = currentTime - parseInt(lastSynced)
  if (timeSinceLastSync < 600000) {
    return false
  }

  return false
}

/**
 * Throttled version of fetchWorkflowsFromDB to prevent database spam
 */
export const throttledFetchWorkflows = () => {
  if (isFetchInProgress) {
    logger.debug('⏭️ Fetch already in progress, skipping duplicate request')
    return
  }

  const now = Date.now()
  const timeSinceLastFetch = now - lastFetchTimestamp

  if (timeSinceLastFetch < FETCH_THROTTLE_MS) {
    const waitTime = FETCH_THROTTLE_MS - timeSinceLastFetch
    logger.debug(
      `⏰ Throttled: Last fetch was ${Math.round(timeSinceLastFetch / 1000)}s ago, waiting ${Math.round(waitTime / 1000)}s`
    )
    return
  }

  if (pendingFetchTimer) {
    clearTimeout(pendingFetchTimer)
  }

  setPendingFetchTimer(
    setTimeout(async () => {
      try {
        setIsFetchInProgress(true)
        setLastFetchTimestamp(Date.now())
        logger.debug('🔄 Fetching workflows from DB (throttled)')
        await fetchWorkflowsFromDB()
      } catch (error) {
        logger.error('❌ Error fetching workflows:', error)
      } finally {
        setIsFetchInProgress(false)
      }
    }, FETCH_DEBOUNCE_MS)
  )
}
