import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('performance-monitor')
/**
 * Performance monitoring utilities for workflow optimization
 */

interface PerformanceMetrics {
  renderTime: number
  componentCount: number
  memoryUsage?: number
  timestamp: number
}

class WorkflowPerformanceTracker {
  private metrics: PerformanceMetrics[] = []
  private renderStartTime: number = 0
  private isMonitoring: boolean = false

  startRender() {
    if (!this.isMonitoring) return
    this.renderStartTime = performance.now()
  }

  endRender(componentCount: number = 0) {
    if (!this.isMonitoring || !this.renderStartTime) return

    const renderTime = performance.now() - this.renderStartTime
    const metric: PerformanceMetrics = {
      renderTime,
      componentCount,
      timestamp: Date.now(),
    }

    // Add memory usage if available
    if ('memory' in performance) {
      metric.memoryUsage = (performance as any).memory.usedJSHeapSize
    }

    this.metrics.push(metric)

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      logger.warn(
        `Slow render detected: ${renderTime.toFixed(2)}ms with ${componentCount} components`
      )
    }

    this.renderStartTime = 0
  }

  getAverageRenderTime(): number {
    if (this.metrics.length === 0) return 0
    const total = this.metrics.reduce((sum, metric) => sum + metric.renderTime, 0)
    return total / this.metrics.length
  }

  getSlowRenders(threshold: number = 16): PerformanceMetrics[] {
    return this.metrics.filter((metric) => metric.renderTime > threshold)
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  clearMetrics() {
    this.metrics = []
  }

  enableMonitoring() {
    this.isMonitoring = true
  }

  disableMonitoring() {
    this.isMonitoring = false
  }

  isEnabled(): boolean {
    return this.isMonitoring
  }

  // Measure function execution time
  measureFunction<T>(name: string, fn: () => T): T {
    if (!this.isMonitoring) return fn()

    const start = performance.now()
    const result = fn()
    const end = performance.now()

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`${name} took ${(end - start).toFixed(2)}ms`)
    }

    return result
  }

  // Measure async function execution time
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isMonitoring) return fn()

    const start = performance.now()
    const result = await fn()
    const end = performance.now()

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`${name} took ${(end - start).toFixed(2)}ms`)
    }

    return result
  }
}

// Global instance
export const performanceMonitor = new WorkflowPerformanceTracker()

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return {
    startRender: () => performanceMonitor.startRender(),
    endRender: (componentCount?: number) => performanceMonitor.endRender(componentCount),
    getAverageRenderTime: () => performanceMonitor.getAverageRenderTime(),
    getSlowRenders: (threshold?: number) => performanceMonitor.getSlowRenders(threshold),
    measureFunction: <T>(name: string, fn: () => T) => performanceMonitor.measureFunction(name, fn),
    measureAsyncFunction: <T>(name: string, fn: () => Promise<T>) =>
      performanceMonitor.measureAsyncFunction(name, fn),
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Batch updates utility
export class BatchUpdater {
  private updates: (() => void)[] = []
  private isScheduled: boolean = false

  add(update: () => void) {
    this.updates.push(update)
    this.schedule()
  }

  private schedule() {
    if (this.isScheduled) return

    this.isScheduled = true

    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      this.flush()
    })
  }

  private flush() {
    const updates = [...this.updates]
    this.updates = []
    this.isScheduled = false

    updates.forEach((update) => update())
  }
}

// Global batch updater instance
export const batchUpdater = new BatchUpdater()

// Enable monitoring in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.enableMonitoring()
}
