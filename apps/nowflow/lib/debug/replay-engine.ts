import { createLogger } from '@/lib/logs/console-logger'
import { BlockState, ExecutionContext } from '@/executor/types'
import { ExecutionSnapshotData, getSnapshotAtStep, getSnapshots } from './snapshot-service'

const logger = createLogger('ReplayEngine')

export interface ReplaySession {
  executionId: string
  snapshots: ExecutionSnapshotData[]
  currentIndex: number
  totalSteps: number
  isPlaying: boolean
  playbackSpeed: number
}

export interface ReplayState {
  stepIndex: number
  blockStates: Record<string, BlockState>
  executedBlocks: string[]
  activeExecutionPath: string[]
  currentBlockId: string
  currentBlockName: string | null
  currentBlockType: string | null
  timestamp: Date
  durationMs: number | null
  inputData: any
  outputData: any
  error: string | null
}

/**
 * Creates a replay session for an execution
 */
export async function createReplaySession(executionId: string): Promise<ReplaySession> {
  try {
    const { snapshots, total } = await getSnapshots(executionId)

    if (snapshots.length === 0) {
      throw new Error(`No snapshots found for execution ${executionId}`)
    }

    logger.info('Created replay session', {
      executionId,
      totalSnapshots: total,
    })

    return {
      executionId,
      snapshots,
      currentIndex: 0,
      totalSteps: total,
      isPlaying: false,
      playbackSpeed: 1,
    }
  } catch (error) {
    logger.error('Failed to create replay session', { executionId, error })
    throw error
  }
}

/**
 * Gets the state at the current replay position
 */
export function getCurrentReplayState(session: ReplaySession): ReplayState | null {
  if (session.currentIndex < 0 || session.currentIndex >= session.snapshots.length) {
    return null
  }

  const snapshot = session.snapshots[session.currentIndex]

  return {
    stepIndex: snapshot.stepIndex,
    blockStates: snapshot.blockStates,
    executedBlocks: snapshot.executedBlocks,
    activeExecutionPath: snapshot.activeExecutionPath,
    currentBlockId: snapshot.executedBlockId,
    currentBlockName: snapshot.executedBlockName,
    currentBlockType: snapshot.executedBlockType,
    timestamp: snapshot.timestamp,
    durationMs: snapshot.durationMs,
    inputData: snapshot.inputData,
    outputData: snapshot.outputData,
    error: snapshot.error,
  }
}

/**
 * Steps forward in the replay
 */
export function stepForward(session: ReplaySession): ReplayState | null {
  if (session.currentIndex >= session.snapshots.length - 1) {
    logger.debug('Already at last step')
    return getCurrentReplayState(session)
  }

  session.currentIndex++
  return getCurrentReplayState(session)
}

/**
 * Steps backward in the replay
 */
export function stepBackward(session: ReplaySession): ReplayState | null {
  if (session.currentIndex <= 0) {
    logger.debug('Already at first step')
    return getCurrentReplayState(session)
  }

  session.currentIndex--
  return getCurrentReplayState(session)
}

/**
 * Jumps to a specific step
 */
export function jumpToStep(session: ReplaySession, stepIndex: number): ReplayState | null {
  const targetIndex = session.snapshots.findIndex((s) => s.stepIndex === stepIndex)

  if (targetIndex === -1) {
    logger.warn('Step not found', { stepIndex })
    return null
  }

  session.currentIndex = targetIndex
  return getCurrentReplayState(session)
}

/**
 * Gets the execution timeline
 */
export function getTimeline(session: ReplaySession): Array<{
  stepIndex: number
  blockId: string
  blockName: string | null
  blockType: string | null
  timestamp: Date
  durationMs: number | null
  hasError: boolean
}> {
  return session.snapshots.map((snapshot) => ({
    stepIndex: snapshot.stepIndex,
    blockId: snapshot.executedBlockId,
    blockName: snapshot.executedBlockName,
    blockType: snapshot.executedBlockType,
    timestamp: snapshot.timestamp,
    durationMs: snapshot.durationMs,
    hasError: !!snapshot.error,
  }))
}

/**
 * Gets block state at a specific step
 */
export function getBlockStateAtStep(
  session: ReplaySession,
  blockId: string,
  stepIndex?: number
): BlockState | null {
  const index =
    stepIndex !== undefined
      ? session.snapshots.findIndex((s) => s.stepIndex === stepIndex)
      : session.currentIndex

  if (index === -1 || index >= session.snapshots.length) {
    return null
  }

  const snapshot = session.snapshots[index]
  return snapshot.blockStates[blockId] || null
}

/**
 * Gets the diff between two steps
 */
export function getStepDiff(
  session: ReplaySession,
  fromStep: number,
  toStep: number
): {
  blocksExecuted: string[]
  stateChanges: Array<{
    blockId: string
    from: BlockState | null
    to: BlockState | null
  }>
} {
  const fromIndex = session.snapshots.findIndex((s) => s.stepIndex === fromStep)
  const toIndex = session.snapshots.findIndex((s) => s.stepIndex === toStep)

  if (fromIndex === -1 || toIndex === -1) {
    return { blocksExecuted: [], stateChanges: [] }
  }

  const fromSnapshot = session.snapshots[fromIndex]
  const toSnapshot = session.snapshots[toIndex]

  // Get blocks executed between steps
  const blocksExecuted = toSnapshot.executedBlocks.filter(
    (b) => !fromSnapshot.executedBlocks.includes(b)
  )

  // Get state changes
  const stateChanges: Array<{
    blockId: string
    from: BlockState | null
    to: BlockState | null
  }> = []

  const allBlockIds = new Set([
    ...Object.keys(fromSnapshot.blockStates),
    ...Object.keys(toSnapshot.blockStates),
  ])

  allBlockIds.forEach((blockId) => {
    const fromState = fromSnapshot.blockStates[blockId]
    const toState = toSnapshot.blockStates[blockId]

    if (JSON.stringify(fromState) !== JSON.stringify(toState)) {
      stateChanges.push({
        blockId,
        from: fromState || null,
        to: toState || null,
      })
    }
  })

  return { blocksExecuted, stateChanges }
}

/**
 * Searches snapshots for a specific condition
 */
export function searchSnapshots(
  session: ReplaySession,
  predicate: (snapshot: ExecutionSnapshotData) => boolean
): ExecutionSnapshotData[] {
  return session.snapshots.filter(predicate)
}

/**
 * Finds the step where an error occurred
 */
export function findErrorStep(session: ReplaySession): number | null {
  const errorSnapshot = session.snapshots.find((s) => s.error)
  return errorSnapshot?.stepIndex ?? null
}

/**
 * Gets execution statistics
 */
export function getExecutionStats(session: ReplaySession): {
  totalSteps: number
  totalDurationMs: number
  blocksExecuted: number
  errorsCount: number
  avgStepDurationMs: number
  slowestStep: { stepIndex: number; durationMs: number } | null
} {
  const stats = {
    totalSteps: session.snapshots.length,
    totalDurationMs: 0,
    blocksExecuted: 0,
    errorsCount: 0,
    avgStepDurationMs: 0,
    slowestStep: null as { stepIndex: number; durationMs: number } | null,
  }

  let maxDuration = 0
  const executedBlocks = new Set<string>()

  session.snapshots.forEach((snapshot) => {
    if (snapshot.durationMs) {
      stats.totalDurationMs += snapshot.durationMs
      if (snapshot.durationMs > maxDuration) {
        maxDuration = snapshot.durationMs
        stats.slowestStep = {
          stepIndex: snapshot.stepIndex,
          durationMs: snapshot.durationMs,
        }
      }
    }

    executedBlocks.add(snapshot.executedBlockId)

    if (snapshot.error) {
      stats.errorsCount++
    }
  })

  stats.blocksExecuted = executedBlocks.size
  stats.avgStepDurationMs =
    stats.totalSteps > 0 ? Math.round(stats.totalDurationMs / stats.totalSteps) : 0

  return stats
}

/**
 * Exports replay data for external analysis
 */
export function exportReplayData(session: ReplaySession): {
  executionId: string
  totalSteps: number
  timeline: any[]
  stats: any
  snapshots: any[]
} {
  return {
    executionId: session.executionId,
    totalSteps: session.totalSteps,
    timeline: getTimeline(session),
    stats: getExecutionStats(session),
    snapshots: session.snapshots.map((s) => ({
      stepIndex: s.stepIndex,
      blockId: s.executedBlockId,
      blockName: s.executedBlockName,
      blockType: s.executedBlockType,
      timestamp: s.timestamp,
      durationMs: s.durationMs,
      hasError: !!s.error,
      error: s.error,
      outputPreview: s.outputData ? JSON.stringify(s.outputData).substring(0, 200) : null,
    })),
  }
}

/**
 * Rebuilds execution context from a snapshot
 */
export function rebuildContextFromSnapshot(
  snapshot: ExecutionSnapshotData,
  workflowId: string
): Partial<ExecutionContext> {
  return {
    workflowId,
    executionId: snapshot.executionId,
    blockStates: new Map(Object.entries(snapshot.blockStates)),
    environmentVariables: snapshot.environmentVariables,
    decisions: {
      router: new Map(Object.entries(snapshot.decisions.router)),
      condition: new Map(Object.entries(snapshot.decisions.condition)),
    },
    loopIterations: new Map(Object.entries(snapshot.loopIterations)),
    executedBlocks: new Set(snapshot.executedBlocks),
    activeExecutionPath: new Set(snapshot.activeExecutionPath),
    blockLogs: [],
    metadata: {
      duration: 0,
    },
    loopItems: new Map(),
    completedLoops: new Set(),
  }
}
