import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('edge-performance')
// Modern edge performance optimizations for 60fps smooth animations

export interface EdgePerformanceConfig {
  enableGPUAcceleration: boolean
  useRequestAnimationFrame: boolean
  enableViewportCulling: boolean
  maxVisibleEdges: number
  animationQuality: 'low' | 'medium' | 'high'
  enableBatching: boolean
}

export const defaultPerformanceConfig: EdgePerformanceConfig = {
  enableGPUAcceleration: true,
  useRequestAnimationFrame: true,
  enableViewportCulling: true,
  maxVisibleEdges: 100,
  animationQuality: 'medium',
  enableBatching: true,
}

// GPU compositing hint — will-change alone triggers layer promotion in modern browsers.
export const enableGPUAcceleration = (element: HTMLElement | SVGElement) => {
  if (element.style) {
    element.style.willChange = 'transform'
  }
}

// Optimized animation frame manager
export class EdgeAnimationManager {
  private animationId: number | null = null
  private callbacks: Set<() => void> = new Set()
  private isRunning = false

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.animate()
  }

  stop() {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  addCallback(callback: () => void) {
    this.callbacks.add(callback)
    if (!this.isRunning) this.start()
  }

  removeCallback(callback: () => void) {
    this.callbacks.delete(callback)
    if (this.callbacks.size === 0) this.stop()
  }

  private animate = () => {
    if (!this.isRunning) return

    // Execute all callbacks
    this.callbacks.forEach((callback) => {
      try {
        callback()
      } catch (error) {
        logger.warn('Edge animation callback error:', error)
      }
    })

    this.animationId = requestAnimationFrame(this.animate)
  }
}

// Singleton animation manager
export const edgeAnimationManager = new EdgeAnimationManager()

// Viewport culling for edge visibility
export const isEdgeInViewport = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  viewport: { x: number; y: number; zoom: number },
  viewportSize: { width: number; height: number }
): boolean => {
  const margin = 100 // Extra margin for smooth transitions

  const minX = Math.min(sourceX, targetX)
  const maxX = Math.max(sourceX, targetX)
  const minY = Math.min(sourceY, targetY)
  const maxY = Math.max(sourceY, targetY)

  const viewportLeft = -viewport.x / viewport.zoom - margin
  const viewportRight = (-viewport.x + viewportSize.width) / viewport.zoom + margin
  const viewportTop = -viewport.y / viewport.zoom - margin
  const viewportBottom = (-viewport.y + viewportSize.height) / viewport.zoom + margin

  return !(
    maxX < viewportLeft ||
    minX > viewportRight ||
    maxY < viewportTop ||
    minY > viewportBottom
  )
}

// Edge batching for performance
export class EdgeBatchRenderer {
  private batchQueue: Array<{
    id: string
    render: () => void
    priority: number
  }> = []
  private isProcessing = false

  addToBatch(id: string, render: () => void, priority = 0) {
    // Remove existing entry for the same edge
    this.batchQueue = this.batchQueue.filter((item) => item.id !== id)

    // Add new entry
    this.batchQueue.push({ id, render, priority })

    // Sort by priority (higher priority first)
    this.batchQueue.sort((a, b) => b.priority - a.priority)

    if (!this.isProcessing) {
      this.processBatch()
    }
  }

  private processBatch = () => {
    if (this.batchQueue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    // Process a chunk of items per frame
    const chunkSize = 5
    const chunk = this.batchQueue.splice(0, chunkSize)

    chunk.forEach((item) => {
      try {
        item.render()
      } catch (error) {
        logger.warn(`Edge batch render error for ${item.id}:`, error)
      }
    })

    // Continue processing in next frame
    requestAnimationFrame(this.processBatch)
  }
}

// Singleton batch renderer
export const edgeBatchRenderer = new EdgeBatchRenderer()

// Performance monitoring
export class EdgePerformanceMonitor {
  private frameCount = 0
  private lastTime = performance.now()
  private fps = 0
  private averageFps = 0
  private frameHistory: number[] = []
  private maxFrameHistory = 60

  updateFPS() {
    const now = performance.now()
    const delta = now - this.lastTime

    this.frameCount++
    this.fps = 1000 / delta
    this.frameHistory.push(this.fps)

    if (this.frameHistory.length > this.maxFrameHistory) {
      this.frameHistory.shift()
    }

    this.averageFps = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length
    this.lastTime = now
  }

  getFPS() {
    return Math.round(this.fps)
  }

  getAverageFPS() {
    return Math.round(this.averageFps)
  }

  isPerformant() {
    return this.averageFps > 55 // Consider 55+ FPS as performant
  }

  getPerformanceLevel(): 'low' | 'medium' | 'high' {
    if (this.averageFps > 55) return 'high'
    if (this.averageFps > 30) return 'medium'
    return 'low'
  }
}

// Singleton performance monitor
export const edgePerformanceMonitor = new EdgePerformanceMonitor()

// Optimized path calculation with caching
export class EdgePathCache {
  private cache = new Map<string, string>()
  private maxCacheSize = 1000

  getCachedPath(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    sourcePosition: string,
    targetPosition: string
  ): string | null {
    const key = `${sourceX}-${sourceY}-${targetX}-${targetY}-${sourcePosition}-${targetPosition}`
    return this.cache.get(key) || null
  }

  setCachedPath(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    sourcePosition: string,
    targetPosition: string,
    path: string
  ) {
    const key = `${sourceX}-${sourceY}-${targetX}-${targetY}-${sourcePosition}-${targetPosition}`

    // Implement LRU cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, path)
  }

  clear() {
    this.cache.clear()
  }
}

// Singleton path cache
export const edgePathCache = new EdgePathCache()

// Throttled edge updates
export const createThrottledEdgeUpdate = (
  updateFn: () => void,
  delay = 16 // ~60fps
) => {
  let timeoutId: NodeJS.Timeout | null = null
  let lastExecution = 0

  return () => {
    const now = Date.now()

    if (now - lastExecution >= delay) {
      updateFn()
      lastExecution = now
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(
        () => {
          updateFn()
          lastExecution = Date.now()
        },
        delay - (now - lastExecution)
      )
    }
  }
}

// Memory-efficient edge state management
export const createEdgeStateManager = () => {
  const edgeStates = new Map<
    string,
    {
      isVisible: boolean
      isAnimating: boolean
      lastUpdate: number
    }
  >()

  return {
    setEdgeState: (id: string, state: Partial<{ isVisible: boolean; isAnimating: boolean }>) => {
      const existing = edgeStates.get(id) || { isVisible: true, isAnimating: false, lastUpdate: 0 }
      edgeStates.set(id, {
        ...existing,
        ...state,
        lastUpdate: Date.now(),
      })
    },

    getEdgeState: (id: string) => {
      return edgeStates.get(id) || { isVisible: true, isAnimating: false, lastUpdate: 0 }
    },

    removeEdgeState: (id: string) => {
      edgeStates.delete(id)
    },

    cleanup: (maxAge = 60000) => {
      // 1 minute
      const now = Date.now()
      for (const [id, state] of edgeStates.entries()) {
        if (now - state.lastUpdate > maxAge) {
          edgeStates.delete(id)
        }
      }
    },
  }
}
