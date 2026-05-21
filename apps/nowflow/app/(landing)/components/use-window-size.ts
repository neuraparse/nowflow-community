import { useSyncExternalStore } from 'react'

interface WindowSize {
  width: number | undefined
  height: number | undefined
}

const defaultWindowSize: WindowSize = {
  width: undefined,
  height: undefined,
}

let windowSize = defaultWindowSize
let rafId = 0
let teardown: (() => void) | null = null

const listeners = new Set<() => void>()

const emitChange = () => {
  listeners.forEach((listener) => listener())
}

const updateWindowSize = () => {
  rafId = 0

  const nextWindowSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  if (nextWindowSize.width === windowSize.width && nextWindowSize.height === windowSize.height) {
    return
  }

  windowSize = nextWindowSize
  emitChange()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  if (typeof window !== 'undefined' && !teardown) {
    updateWindowSize()

    const handleResize = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateWindowSize)
    }

    window.addEventListener('resize', handleResize, { passive: true })
    teardown = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('resize', handleResize)
      teardown = null
    }
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && teardown) {
      teardown()
    }
  }
}

const getSnapshot = () => windowSize

const getServerSnapshot = () => defaultWindowSize

export function useWindowSize(): WindowSize {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
