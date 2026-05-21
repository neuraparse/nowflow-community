import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('use-block-performance')

interface BlockPerformanceMetrics {
  renderCount: number
  lastRenderTime: number
  averageRenderTime: number
  memoryUsage: number
  isOptimized: boolean
}

interface UseBlockPerformanceOptions {
  enableMetrics?: boolean
  enableMemoryTracking?: boolean
  sampleRate?: number
}

/**
 * Hook for tracking and optimizing block performance
 */
export function useBlockPerformance(blockId: string, options: UseBlockPerformanceOptions = {}) {
  const {
    enableMetrics = process.env.NODE_ENV === 'development',
    enableMemoryTracking = false,
    sampleRate = 1.0,
  } = options

  const metricsRef = useRef<BlockPerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    memoryUsage: 0,
    isOptimized: false,
  })

  const renderStartTimeRef = useRef<number>(0)
  const renderTimesRef = useRef<number[]>([])

  // Track render start
  const trackRenderStart = useCallback(() => {
    if (!enableMetrics || Math.random() > sampleRate) return
    renderStartTimeRef.current = performance.now()
  }, [enableMetrics, sampleRate])

  // Track render end
  const trackRenderEnd = useCallback(() => {
    if (!enableMetrics || renderStartTimeRef.current === 0) return

    const renderTime = performance.now() - renderStartTimeRef.current
    renderTimesRef.current.push(renderTime)

    // Keep only last 100 render times
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift()
    }

    metricsRef.current.renderCount++
    metricsRef.current.lastRenderTime = renderTime
    metricsRef.current.averageRenderTime =
      renderTimesRef.current.reduce((sum, time) => sum + time, 0) / renderTimesRef.current.length

    renderStartTimeRef.current = 0
  }, [enableMetrics])

  // Memory tracking
  const trackMemoryUsage = useCallback(() => {
    if (!enableMemoryTracking || !('memory' in performance)) return

    const memory = (performance as any).memory
    metricsRef.current.memoryUsage = memory.usedJSHeapSize
  }, [enableMemoryTracking])

  // Memoized block data to prevent unnecessary re-renders
  const blockData = useMemo(() => {
    const block = useWorkflowStore.getState().blocks[blockId]
    return block
      ? {
          type: block.type,
          position: block.position,
        }
      : null
  }, [blockId])

  // Memoized sub-block values
  const subBlockValues = useMemo(() => {
    return {}
  }, [blockId])

  // Debounced value updates
  const debouncedUpdateRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const debouncedUpdate = useCallback(
    (key: string, value: any) => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current)
      }

      debouncedUpdateRef.current = setTimeout(() => {
        // Update sub-block value
        logger.debug('Updating sub-block value:', blockId, key, value)
      }, 100)
    },
    [blockId]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current)
      }
    }
  }, [])

  // Performance monitoring effect
  useEffect(() => {
    trackRenderStart()

    return () => {
      trackRenderEnd()
      trackMemoryUsage()
    }
  })

  // Check if block is optimized
  const isOptimized = useMemo(() => {
    const avgRenderTime = metricsRef.current.averageRenderTime
    const renderCount = metricsRef.current.renderCount

    // Consider optimized if average render time is under 16ms (60fps)
    // and we have enough samples
    return renderCount > 10 && avgRenderTime < 16
  }, [metricsRef.current.averageRenderTime, metricsRef.current.renderCount])

  // Performance recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = []
    const metrics = metricsRef.current

    if (metrics.averageRenderTime > 16) {
      recs.push('Consider memoizing expensive calculations')
    }

    if (metrics.renderCount > 100 && metrics.averageRenderTime > 10) {
      recs.push('High render frequency detected - check for unnecessary re-renders')
    }

    if (metrics.memoryUsage > 50 * 1024 * 1024) {
      // 50MB
      recs.push('High memory usage detected - check for memory leaks')
    }

    return recs
  }, [metricsRef.current])

  return {
    // Data
    blockData,
    subBlockValues,

    // Performance metrics
    metrics: metricsRef.current,
    isOptimized,
    recommendations,

    // Optimized update functions
    debouncedUpdate,

    // Tracking functions
    trackRenderStart,
    trackRenderEnd,
    trackMemoryUsage,
  }
}

/**
 * Hook for optimized block connections
 */
export function useOptimizedBlockConnections(blockId: string) {
  const connections = useMemo(() => {
    const edges = useWorkflowStore.getState().edges
    return edges.filter((edge) => edge.source === blockId || edge.target === blockId)
  }, [blockId])

  const incomingConnections = useMemo(
    () => connections.filter((edge) => edge.target === blockId),
    [connections, blockId]
  )

  const outgoingConnections = useMemo(
    () => connections.filter((edge) => edge.source === blockId),
    [connections, blockId]
  )

  return {
    connections,
    incomingConnections,
    outgoingConnections,
    hasConnections: connections.length > 0,
  }
}

/**
 * Hook for virtual scrolling in large workflows
 */
export function useVirtualScrolling(
  containerRef: React.RefObject<HTMLElement>,
  itemHeight: number = 200,
  buffer: number = 5
) {
  const blocks = useWorkflowStore((state) => Object.values(state.blocks))

  const visibleRange = useMemo(() => {
    if (!containerRef.current) return { start: 0, end: blocks.length }

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
    const end = Math.min(
      blocks.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
    )

    return { start, end }
  }, [blocks.length, itemHeight, buffer])

  const visibleBlocks = useMemo(
    () => blocks.slice(visibleRange.start, visibleRange.end),
    [blocks, visibleRange]
  )

  return {
    visibleBlocks,
    visibleRange,
    totalHeight: blocks.length * itemHeight,
  }
}
