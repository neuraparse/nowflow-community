import { createLogger } from '@/lib/logs/console-logger'
import { BlockState, ExecutionContext, NormalizedBlockOutput } from '@/executor/types'

const logger = createLogger('HITLExecutionState')

/**
 * Serialized execution state for storage in database
 */
export interface SerializedExecutionState {
  workflowId: string
  executionId?: string
  userId?: string
  sessionId?: string
  sessionToken?: string
  memoryEnabled?: boolean
  sessionMetadata?: Record<string, any>
  apiBaseUrl?: string

  blockStates: Record<string, BlockState>
  blockLogs: any[]
  metadata: any
  environmentVariables: Record<string, string>

  decisions: {
    router: Record<string, string>
    condition: Record<string, string>
  }

  loopIterations: Record<string, number>
  loopItems: Record<string, any>
  completedLoops: string[]
  executedBlocks: string[]
  activeExecutionPath: string[]

  stream?: boolean
  selectedOutputIds?: string[]
  edges?: any[]

  // Workflow state for resume
  workflowState?: any
}

/**
 * Serialize execution context to JSON-compatible format
 */
export function serializeExecutionContext(context: ExecutionContext): SerializedExecutionState {
  // Convert Maps to objects
  const blockStates: Record<string, BlockState> = {}
  context.blockStates.forEach((state, blockId) => {
    blockStates[blockId] = state
  })

  const routerDecisions: Record<string, string> = {}
  context.decisions.router.forEach((target, source) => {
    routerDecisions[source] = target
  })

  const conditionDecisions: Record<string, string> = {}
  context.decisions.condition.forEach((conditionId, blockId) => {
    conditionDecisions[blockId] = conditionId
  })

  const loopIterations: Record<string, number> = {}
  context.loopIterations.forEach((count, loopId) => {
    loopIterations[loopId] = count
  })

  const loopItems: Record<string, any> = {}
  context.loopItems.forEach((item, loopId) => {
    loopItems[loopId] = item
  })

  return {
    workflowId: context.workflowId,
    executionId: context.executionId,
    userId: context.userId,
    sessionId: context.sessionId,
    sessionToken: context.sessionToken,
    memoryEnabled: context.memoryEnabled,
    sessionMetadata: context.sessionMetadata,
    apiBaseUrl: context.apiBaseUrl,

    blockStates,
    blockLogs: context.blockLogs,
    metadata: context.metadata,
    environmentVariables: context.environmentVariables,

    decisions: {
      router: routerDecisions,
      condition: conditionDecisions,
    },

    loopIterations,
    loopItems,
    completedLoops: Array.from(context.completedLoops),
    executedBlocks: Array.from(context.executedBlocks),
    activeExecutionPath: Array.from(context.activeExecutionPath),

    stream: context.stream,
    selectedOutputIds: context.selectedOutputIds,
    edges: context.edges,
  }
}

/**
 * Deserialize stored state back to execution context format
 */
export function deserializeExecutionContext(
  state: SerializedExecutionState
): Partial<ExecutionContext> {
  // Convert objects back to Maps
  const blockStates = new Map<string, BlockState>()
  Object.entries(state.blockStates || {}).forEach(([blockId, blockState]) => {
    blockStates.set(blockId, blockState)
  })

  const routerDecisions = new Map<string, string>()
  Object.entries(state.decisions?.router || {}).forEach(([source, target]) => {
    routerDecisions.set(source, target)
  })

  const conditionDecisions = new Map<string, string>()
  Object.entries(state.decisions?.condition || {}).forEach(([blockId, conditionId]) => {
    conditionDecisions.set(blockId, conditionId)
  })

  const loopIterations = new Map<string, number>()
  Object.entries(state.loopIterations || {}).forEach(([loopId, count]) => {
    loopIterations.set(loopId, count)
  })

  const loopItems = new Map<string, any>()
  Object.entries(state.loopItems || {}).forEach(([loopId, item]) => {
    loopItems.set(loopId, item)
  })

  return {
    workflowId: state.workflowId,
    executionId: state.executionId,
    userId: state.userId,
    sessionId: state.sessionId,
    sessionToken: state.sessionToken,
    memoryEnabled: state.memoryEnabled,
    sessionMetadata: state.sessionMetadata,
    apiBaseUrl: state.apiBaseUrl,

    blockStates,
    blockLogs: state.blockLogs || [],
    metadata: state.metadata || { duration: 0 },
    environmentVariables: state.environmentVariables || {},

    decisions: {
      router: routerDecisions,
      condition: conditionDecisions,
    },

    loopIterations,
    loopItems,
    completedLoops: new Set(state.completedLoops || []),
    executedBlocks: new Set(state.executedBlocks || []),
    activeExecutionPath: new Set(state.activeExecutionPath || []),

    stream: state.stream,
    selectedOutputIds: state.selectedOutputIds,
    edges: state.edges,
  }
}

/**
 * Save paused execution state via API
 */
export async function savePausedExecutionState(
  hitlRequestId: string,
  workflowId: string,
  executionId: string,
  context: ExecutionContext,
  baseUrl?: string
): Promise<void> {
  try {
    const serializedState = serializeExecutionContext(context)

    const url = baseUrl
      ? `${baseUrl}/api/hitl/pause`
      : typeof window !== 'undefined'
        ? `${window.location.origin}/api/hitl/pause`
        : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/hitl/pause`

    logger.info('Saving paused execution state', {
      hitlRequestId,
      workflowId,
      executionId,
      url,
      blockStatesCount: Object.keys(serializedState.blockStates).length,
      executedBlocksCount: serializedState.executedBlocks.length,
    })

    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || process.env.AUTH_SECRET
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (internalToken) {
      fetchHeaders['x-internal-service-token'] = internalToken
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        hitlRequestId,
        workflowId,
        executionId,
        executionState: serializedState,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Failed to save paused state: ${response.status}`)
    }

    const data = await response.json()
    logger.info('Paused execution state saved', { hitlRequestId, success: data.success })
  } catch (error) {
    logger.error('Failed to save paused execution state', {
      hitlRequestId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Load paused execution state via API
 */
export async function loadPausedExecutionState(
  hitlRequestId: string,
  baseUrl?: string
): Promise<SerializedExecutionState | null> {
  try {
    const url = baseUrl
      ? `${baseUrl}/api/hitl/pause?hitlRequestId=${hitlRequestId}`
      : typeof window !== 'undefined'
        ? `${window.location.origin}/api/hitl/pause?hitlRequestId=${hitlRequestId}`
        : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/hitl/pause?hitlRequestId=${hitlRequestId}`

    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || process.env.AUTH_SECRET
    const fetchHeaders: Record<string, string> = {}
    if (internalToken) {
      fetchHeaders['x-internal-service-token'] = internalToken
    }

    const response = await fetch(url, { method: 'GET', headers: fetchHeaders })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Failed to load paused state: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success || !data.data) {
      return null
    }

    return data.data.executionState as SerializedExecutionState
  } catch (error) {
    logger.error('Failed to load paused execution state', {
      hitlRequestId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
