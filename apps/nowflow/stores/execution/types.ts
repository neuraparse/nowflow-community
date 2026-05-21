import { Executor } from '@/executor'
import { ExecutionContext } from '@/executor/types'

export interface BlockExecutionMetrics {
  startTime?: string
  endTime?: string
  duration?: number
  attempts?: number
  success?: boolean
  error?: {
    message: string
    code?: string
    type?: string
    stack?: string
    // Detailed error context
    blockId?: string
    blockName?: string
    blockType?: string
    // Last successful data before error
    lastData?: any
    // Transition information
    lastTransition?: {
      from?: string
      to?: string
      handle?: string
      data?: any
    }
    // Additional context
    context?: Record<string, any>
  }
  // Last output data (even if error occurred)
  lastOutput?: any
  // Last input data
  lastInput?: any
}

export interface ConnectionExecutionState {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  active: boolean
  completed: boolean
  error: boolean
  data?: {
    type?: string
    size?: number
    transferTime?: number
  }
}

export interface ExecutionState {
  activeBlockIds: Set<string>
  completedBlockIds: Set<string>
  errorBlockIds: Set<string>
  pendingBlocks: string[]
  activeConnections: ConnectionExecutionState[]
  executionMetrics: Record<string, BlockExecutionMetrics>
  isExecuting: boolean
  isDebugging: boolean
  executor: Executor | null
  debugContext: ExecutionContext | null
  executionSuccess: boolean | null
  executionError: string | null
  executionStartTime: string | null
  executionEndTime: string | null
  executionDuration: number | null
}

export interface ExecutionActions {
  setActiveBlocks: (blockIds: Set<string>) => void
  setCompletedBlocks: (blockIds: Set<string>) => void
  setErrorBlocks: (blockIds: Set<string>) => void
  setPendingBlocks: (blockIds: string[]) => void
  setActiveConnections: (connections: ConnectionExecutionState[]) => void
  updateConnectionState: (
    source: string,
    target: string,
    state: Partial<ConnectionExecutionState>
  ) => void
  setBlockMetrics: (blockId: string, metrics: BlockExecutionMetrics) => void
  setExecutionStatus: (success: boolean | null, error?: string | null) => void
  setExecutionTiming: (
    startTime: string | null,
    endTime: string | null,
    duration: number | null
  ) => void
  setIsExecuting: (isExecuting: boolean) => void
  setIsDebugging: (isDebugging: boolean) => void
  setExecutor: (executor: Executor | null) => void
  setDebugContext: (context: ExecutionContext | null) => void
  reset: () => void
}

export const initialState: ExecutionState = {
  activeBlockIds: new Set(),
  completedBlockIds: new Set(),
  errorBlockIds: new Set(),
  pendingBlocks: [],
  activeConnections: [],
  executionMetrics: {},
  isExecuting: false,
  isDebugging: false,
  executor: null,
  debugContext: null,
  executionSuccess: null,
  executionError: null,
  executionStartTime: null,
  executionEndTime: null,
  executionDuration: null,
}
