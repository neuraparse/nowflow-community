// 2025 Ultra-Smooth Performance System for ReactFlow
// Optimized for smooth 60fps even with 2-3 cards
import { useCallback, useEffect, useRef } from 'react'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('UltraSmoothPerformance')

export interface UltraSmoothConfig {
  enableGPUAcceleration: boolean
  useRAF: boolean // RequestAnimationFrame
  throttleDelay: number
  enableTransform3D: boolean
  enableWillChange: boolean
  enableSubpixelRendering: boolean
}

export const ultraSmoothConfig: UltraSmoothConfig = {
  enableGPUAcceleration: false, // Disable aggressive GPU acceleration
  useRAF: true,
  throttleDelay: 16, // 60fps for stable smooth movement
  enableTransform3D: false, // Use 2D transforms for stability
  enableWillChange: false, // Only enable during actual drag
  enableSubpixelRendering: false, // Disable for crisp rendering
}

// GPU compositing hint — will-change alone is sufficient in modern browsers.
// translate3d(0,0,0) and backface-visibility hacks removed (2026 browserslist).
export const enableUltraGPUAcceleration = (element: HTMLElement | SVGElement) => {
  if (!element.style) return
  element.style.willChange = 'transform'
}

// Ultra-smooth RequestAnimationFrame manager with configurable FPS
export class UltraSmoothRAFManager {
  private rafId: number | null = null
  private callbacks: Set<() => void> = new Set()
  private isRunning = false
  private lastTime = 0
  private targetFPS = 60 // Default target FPS

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.animate()
  }

  setTargetFPS(fps: number) {
    this.targetFPS = fps
  }

  stop() {
    this.isRunning = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
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

  private animate = (currentTime: number = performance.now()) => {
    if (!this.isRunning) return

    const deltaTime = currentTime - this.lastTime
    const targetInterval = 1000 / this.targetFPS

    // Only execute if enough time has passed for target FPS
    if (deltaTime >= targetInterval) {
      this.callbacks.forEach((callback) => {
        try {
          callback()
        } catch (error) {
          logger.error('Ultra-smooth RAF callback error:', error)
        }
      })
      this.lastTime = currentTime
    }

    this.rafId = requestAnimationFrame(this.animate)
  }
}

// Singleton ultra-smooth RAF manager
export const ultraSmoothRAF = new UltraSmoothRAFManager()

// Ultra-smooth throttled callback (8ms = ~120fps)
export function useUltraSmoothCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 8
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastExecution = useRef(0)
  const rafRef = useRef<number | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = performance.now()

      // Get current FPS limit from CSS custom property or default
      const maxFPS =
        typeof document !== 'undefined'
          ? parseInt(
              getComputedStyle(document.documentElement).getPropertyValue('--max-fps') || '60'
            )
          : 60

      const targetDelay = 1000 / maxFPS // Calculate delay based on target FPS
      const actualDelay = Math.max(delay, targetDelay) // Use the more restrictive delay

      if (now - lastExecution.current >= actualDelay) {
        // Execute immediately for responsiveness
        if (rafRef.current) cancelAnimationFrame(rafRef.current)

        rafRef.current = requestAnimationFrame(() => {
          callback(...args)
          lastExecution.current = performance.now()
        })
      } else {
        // Queue for next available slot
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(
          () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)

            rafRef.current = requestAnimationFrame(() => {
              callback(...args)
              lastExecution.current = performance.now()
            })
          },
          actualDelay - (now - lastExecution.current)
        )
      }
    }) as T,
    [callback, delay]
  )
}

// Ultra-smooth position updates with sub-pixel precision
export class UltraSmoothPositionManager {
  private positionQueue: Map<string, { x: number; y: number; timestamp: number }> = new Map()
  private isProcessing = false

  queuePositionUpdate(id: string, position: { x: number; y: number }) {
    // Round to whole pixels to prevent jitter
    const roundedPosition = {
      x: Math.round(position.x), // Whole pixel precision for stability
      y: Math.round(position.y),
    }

    this.positionQueue.set(id, {
      ...roundedPosition,
      timestamp: performance.now(),
    })

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  private processQueue = () => {
    if (this.positionQueue.size === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    requestAnimationFrame(() => {
      const updates = Array.from(this.positionQueue.entries())
      this.positionQueue.clear()

      // Process all updates in a single frame
      updates.forEach(([id, position]) => {
        // Apply position update with GPU acceleration
        const element = document.querySelector(`[data-id="${id}"]`) as HTMLElement
        if (element) {
          enableUltraGPUAcceleration(element)
          element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
        }
      })

      // Continue processing if more updates arrived
      if (this.positionQueue.size > 0) {
        this.processQueue()
      } else {
        this.isProcessing = false
      }
    })
  }
}

// Singleton position manager
export const ultraSmoothPositionManager = new UltraSmoothPositionManager()

// Ultra-smooth viewport culling (disabled for small datasets to prevent visibility issues)
export const getUltraSmoothCullingConfig = (nodeCount: number) => {
  return {
    enabled: false, // DISABLED - Causing visibility issues with cards
    margin: 1000, // Very large margin when enabled
    nodeWidth: 300, // Larger node size estimation
    nodeHeight: 200, // Larger node size estimation
    enableLOD: false, // DISABLED - Causing visibility issues
    lodThreshold: 0.1, // Very low threshold when enabled
  }
}

// Ultra-smooth CSS optimizations
export const applyUltraSmoothCSS = () => {
  const style = document.createElement('style')
  style.textContent = `
    /* Minimal baseline styles: no forced transforms by default */
    .react-flow__node {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .react-flow__edge {
      shape-rendering: geometricPrecision;
    }

    /* Apply GPU/compositing hints only while dragging */
    body.node-dragging .react-flow__node.react-flow__node--dragging {
      will-change: transform;
      z-index: 1000;
      contain: layout paint;
      box-shadow: none !important;
      filter: none !important;
      backdrop-filter: none !important;
    }

    /* Disable transitions and animations during drag for smooth movement */
    body.node-dragging .react-flow__node.react-flow__node--dragging * {
      transition: none !important;
      animation: none !important;
    }
  `

  if (!document.head.querySelector('#ultra-smooth-styles')) {
    style.id = 'ultra-smooth-styles'
    document.head.appendChild(style)
  }
}

// Ultra-smooth initialization hook
export const useUltraSmoothInit = () => {
  useEffect(() => {
    // Apply CSS optimizations
    applyUltraSmoothCSS()

    // Start RAF manager
    ultraSmoothRAF.start()

    // Cleanup on unmount
    return () => {
      ultraSmoothRAF.stop()
    }
  }, [])
}

// Ultra-smooth node drag handler
export const useUltraSmoothDragHandler = (
  updatePosition: (id: string, position: { x: number; y: number }) => void
) => {
  return useUltraSmoothCallback((changes: any[]) => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        // Queue position update for ultra-smooth processing
        ultraSmoothPositionManager.queuePositionUpdate(change.id, change.position)

        // Also update the store for persistence
        updatePosition(change.id, change.position)
      }
    })
  }, 4) // 4ms = ~240fps for ultra responsiveness
}
