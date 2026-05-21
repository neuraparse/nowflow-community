import { create } from 'zustand'
import { ExecutionActions, ExecutionState, initialState } from './types'

export const useExecutionStore = create<ExecutionState & ExecutionActions>()((set) => ({
  ...initialState,

  setActiveBlocks: (blockIds) => set({ activeBlockIds: new Set(blockIds) }),

  setCompletedBlocks: (blockIds) => set({ completedBlockIds: new Set(blockIds) }),

  setErrorBlocks: (blockIds) => set({ errorBlockIds: new Set(blockIds) }),

  setPendingBlocks: (pendingBlocks) => set({ pendingBlocks }),

  setActiveConnections: (connections) => set({ activeConnections: connections }),

  updateConnectionState: (source, target, state) =>
    set((currentState) => {
      const connections = [...currentState.activeConnections]
      const connectionIndex = connections.findIndex(
        (conn) => conn.source === source && conn.target === target
      )

      if (connectionIndex >= 0) {
        // Update existing connection
        connections[connectionIndex] = {
          ...connections[connectionIndex],
          ...state,
        }
      } else {
        // Add new connection
        connections.push({
          source,
          target,
          active: state.active || false,
          completed: state.completed || false,
          error: state.error || false,
          ...state,
        })
      }

      return { activeConnections: connections }
    }),

  setBlockMetrics: (blockId, metrics) =>
    set((currentState) => ({
      executionMetrics: {
        ...currentState.executionMetrics,
        [blockId]: {
          ...(currentState.executionMetrics[blockId] || {}),
          ...metrics,
        },
      },
    })),

  setExecutionStatus: (success, error) =>
    set({
      executionSuccess: success,
      executionError: error || null,
    }),

  setExecutionTiming: (startTime, endTime, duration) =>
    set({
      executionStartTime: startTime,
      executionEndTime: endTime,
      executionDuration: duration,
    }),

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  setIsDebugging: (isDebugging) => set({ isDebugging }),

  setExecutor: (executor) => set({ executor }),

  setDebugContext: (debugContext) => set({ debugContext }),

  reset: () => set(initialState),
}))
