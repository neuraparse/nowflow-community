import { useMemo } from 'react'
import { GroupState } from '@/stores/workflows/workflow/types'

/**
 * Performance optimization utilities for group management
 */

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function for frequent operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Memoized group calculations for performance
 */
export function useGroupCalculations(
  groups: Record<string, GroupState>,
  blocks: Record<string, any>
) {
  return useMemo(() => {
    const calculations = {
      totalGroups: Object.keys(groups).length,
      expandedGroups: Object.values(groups).filter((g) => g.isExpanded).length,
      collapsedGroups: Object.values(groups).filter((g) => !g.isExpanded).length,
      totalGroupedBlocks: Object.values(groups).reduce((sum, g) => sum + g.nodeIds.length, 0),
      averageGroupSize: 0,
      largestGroup: null as GroupState | null,
      smallestGroup: null as GroupState | null,
    }

    if (calculations.totalGroups > 0) {
      calculations.averageGroupSize = calculations.totalGroupedBlocks / calculations.totalGroups

      const groupSizes = Object.values(groups).map((g) => ({ group: g, size: g.nodeIds.length }))
      groupSizes.sort((a, b) => b.size - a.size)

      calculations.largestGroup = groupSizes[0]?.group || null
      calculations.smallestGroup = groupSizes[groupSizes.length - 1]?.group || null
    }

    return calculations
  }, [groups, blocks])
}

/**
 * Optimized group filtering for large datasets
 */
export function useFilteredGroups(
  groups: Record<string, GroupState>,
  searchTerm: string = '',
  filterType: 'all' | 'expanded' | 'collapsed' = 'all'
) {
  return useMemo(() => {
    let filteredGroups = Object.values(groups)

    // Filter by expansion state
    if (filterType === 'expanded') {
      filteredGroups = filteredGroups.filter((g) => g.isExpanded)
    } else if (filterType === 'collapsed') {
      filteredGroups = filteredGroups.filter((g) => !g.isExpanded)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filteredGroups = filteredGroups.filter((g) => g.name.toLowerCase().includes(term))
    }

    return filteredGroups
  }, [groups, searchTerm, filterType])
}

/**
 * Batch operations for better performance
 */
export class GroupBatchOperations {
  private operations: Array<() => void> = []
  private isProcessing = false

  add(operation: () => void) {
    this.operations.push(operation)
    if (!this.isProcessing) {
      this.process()
    }
  }

  private async process() {
    this.isProcessing = true

    // Process operations in chunks to avoid blocking the UI
    const chunkSize = 10
    while (this.operations.length > 0) {
      const chunk = this.operations.splice(0, chunkSize)

      // Execute chunk
      chunk.forEach((op) => op())

      // Yield control back to the browser
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    this.isProcessing = false
  }
}

/**
 * Memory-efficient group state management
 */
export function optimizeGroupState(groups: Record<string, GroupState>) {
  // Remove unnecessary properties and optimize data structure
  const optimized: Record<string, GroupState> = {}

  Object.entries(groups).forEach(([id, group]) => {
    optimized[id] = {
      id: group.id,
      name: group.name,
      nodeIds: [...group.nodeIds], // Create new array to avoid mutations
      createdAt: group.createdAt,
      // Only include optional properties if they exist
      ...(group.color && { color: group.color }),
    }
  })

  return optimized
}

/**
 * Intersection observer for lazy loading group content
 */
export function createGroupIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  }

  return new IntersectionObserver(callback, defaultOptions)
}

/**
 * Performance monitoring for group operations
 */
export class GroupPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startTiming(operation: string): () => void {
    const start = performance.now()

    return () => {
      const duration = performance.now() - start

      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, [])
      }

      const times = this.metrics.get(operation)!
      times.push(duration)

      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift()
      }
    }
  }

  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation)
    if (!times || times.length === 0) return 0

    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  getMetrics() {
    const result: Record<string, { average: number; count: number }> = {}

    this.metrics.forEach((times, operation) => {
      result[operation] = {
        average: this.getAverageTime(operation),
        count: times.length,
      }
    })

    return result
  }

  reset() {
    this.metrics.clear()
  }
}

// Global performance monitor instance
export const groupPerformanceMonitor = new GroupPerformanceMonitor()
