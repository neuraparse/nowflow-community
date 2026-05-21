import { createJSONStorage, PersistStorage, StateStorage } from 'zustand/middleware'

/**
 * Safe storage adapter for Zustand persist middleware
 * Handles SSR (server-side rendering) and storage unavailability gracefully
 *
 * This prevents the "[zustand persist middleware] Unable to update item" warnings
 * that occur when localStorage is unavailable (SSR, private browsing, etc.)
 */
export const createSafeStorage = (): StateStorage => ({
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(name)
    } catch (error) {
      // Only warn on read errors (less common)
      console.warn(`[zustand persist] Unable to get item '${name}':`, error)
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(name, value)
    } catch {
      // Silently fail on write errors to prevent console spam
      // Storage might be unavailable in some contexts:
      // - Server-side rendering (no window/localStorage)
      // - Private browsing mode (storage disabled)
      // - Storage quota exceeded
      // - Cross-origin restrictions
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(name)
    } catch (error) {
      console.warn(`[zustand persist] Unable to remove item '${name}':`, error)
    }
  },
})

/**
 * Default safe storage instance - raw StateStorage
 * Use this with createJSONStorage() wrapper
 */
const baseSafeStorage = createSafeStorage()

/**
 * Type-safe persist storage for Zustand
 * Use this directly in persist configurations
 */
export const safeStorage = createJSONStorage(() => baseSafeStorage) as PersistStorage<any>

/**
 * Debounced PersistStorage that delays BOTH JSON.stringify AND localStorage.setItem.
 *
 * Why this exists:
 * Zustand's createJSONStorage wrapper calls JSON.stringify() synchronously
 * inside its setItem BEFORE passing to the underlying StateStorage.
 * For large stores (workflowValues with many blocks), this serialization
 * blocks the main thread on every keystroke (~5-50ms per call).
 *
 * This implementation bypasses createJSONStorage entirely and implements
 * PersistStorage directly, moving JSON.stringify into the debounced callback
 * so it only runs once after the user stops typing.
 */
export const createDebouncedStorage = (delayMs: number = 1000): PersistStorage<any> => {
  const timers = new Map<string, NodeJS.Timeout>()

  return {
    getItem: (name: string) => {
      const str = baseSafeStorage.getItem(name) as string | null
      if (!str) return null
      try {
        return JSON.parse(str) as { state: any; version?: number }
      } catch {
        return null
      }
    },
    setItem: (name: string, value: any) => {
      // Debounce the ENTIRE write: JSON.stringify + localStorage.setItem
      // This is the critical fix — neither serialization nor storage runs per-keystroke
      const existing = timers.get(name)
      if (existing) clearTimeout(existing)
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name)
          try {
            baseSafeStorage.setItem(name, JSON.stringify(value))
          } catch {
            // Silently fail (quota exceeded, etc.)
          }
        }, delayMs)
      )
    },
    removeItem: (name: string) => {
      const existing = timers.get(name)
      if (existing) clearTimeout(existing)
      timers.delete(name)
      baseSafeStorage.removeItem(name)
    },
  }
}

/**
 * Debounced safe storage for high-frequency stores (e.g. subblock store).
 * Both JSON.stringify and localStorage writes are batched with a 1s delay
 * to keep the main thread free during typing.
 */
export const debouncedSafeStorage = createDebouncedStorage(1000)
