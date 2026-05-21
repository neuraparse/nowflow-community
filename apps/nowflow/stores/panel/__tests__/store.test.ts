/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelStore } from '@/stores/panel/store'
import type { PanelTab } from '@/stores/panel/types'

// Mock safe-storage before importing the store so the persist middleware
// doesn't touch real localStorage during tests.
vi.mock('@/stores/safe-storage', () => {
  const mem = new Map<string, string>()
  const storage = {
    getItem: (name: string) => {
      const raw = mem.get(name)
      return raw ? JSON.parse(raw) : null
    },
    setItem: (name: string, value: unknown) => {
      mem.set(name, JSON.stringify(value))
    },
    removeItem: (name: string) => {
      mem.delete(name)
    },
  }
  return {
    safeStorage: storage,
    createSafeStorage: () => storage,
    debouncedSafeStorage: storage,
    createDebouncedStorage: () => storage,
  }
})

describe('usePanelStore', () => {
  beforeEach(() => {
    // Reset to a known initial state between tests (preserve action refs via merge).
    usePanelStore.setState({
      isOpen: false,
      activeTab: 'console',
      position: 'bottom',
      dimensions: { width: 1200, height: 300, x: 0, y: 500 },
      isDragging: false,
      isResizing: false,
    })
  })

  describe('initial state', () => {
    it('starts closed on the console tab at the bottom', () => {
      const state = usePanelStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.activeTab).toBe('console')
      expect(state.position).toBe('bottom')
      expect(state.isDragging).toBe(false)
      expect(state.isResizing).toBe(false)
      expect(state.dimensions).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
        x: expect.any(Number),
        y: expect.any(Number),
      })
    })
  })

  describe('togglePanel', () => {
    it('flips isOpen from false to true', () => {
      usePanelStore.getState().togglePanel()
      expect(usePanelStore.getState().isOpen).toBe(true)
    })

    it('flips isOpen back to false on a second call', () => {
      usePanelStore.getState().togglePanel()
      usePanelStore.getState().togglePanel()
      expect(usePanelStore.getState().isOpen).toBe(false)
    })
  })

  describe('setActiveTab', () => {
    const tabs: PanelTab[] = [
      'console',
      'logs',
      'history',
      'versions',
      'hitl',
      'experiments',
      'agent-trace',
      'evals',
    ]

    it.each(tabs)('switches activeTab to %s', (tab) => {
      usePanelStore.getState().setActiveTab(tab)
      expect(usePanelStore.getState().activeTab).toBe(tab)
    })

    it('preserves activeTab across unrelated state changes', () => {
      usePanelStore.getState().setActiveTab('logs')
      usePanelStore.getState().togglePanel()
      expect(usePanelStore.getState().activeTab).toBe('logs')
    })

    it('migrates the legacy chat tab to console', () => {
      usePanelStore.getState().setActiveTab('chat')
      expect(usePanelStore.getState().activeTab).toBe('console')
    })

    it('transitions between multiple tabs in sequence', () => {
      const store = usePanelStore.getState()
      store.setActiveTab('console')
      expect(usePanelStore.getState().activeTab).toBe('console')
      store.setActiveTab('versions')
      expect(usePanelStore.getState().activeTab).toBe('versions')
      store.setActiveTab('evals')
      expect(usePanelStore.getState().activeTab).toBe('evals')
    })
  })

  describe('setPosition', () => {
    it('sets position to right with a right-anchored layout', () => {
      usePanelStore.getState().setPosition('right')
      const { position, dimensions, isDragging, isResizing } = usePanelStore.getState()

      expect(position).toBe('right')
      expect(dimensions.width).toBe(336)
      expect(dimensions.y).toBe(64)
      expect(dimensions.height).toBe(window.innerHeight - 64)
      expect(dimensions.x).toBe(window.innerWidth - 336)
      expect(isDragging).toBe(false)
      expect(isResizing).toBe(false)
    })

    it('sets position to bottom with a bottom-anchored layout', () => {
      usePanelStore.getState().setPosition('right')
      usePanelStore.getState().setPosition('bottom')
      const { position, dimensions } = usePanelStore.getState()

      expect(position).toBe('bottom')
      expect(dimensions.height).toBe(300)
      expect(dimensions.y).toBe(window.innerHeight - 300)
      // width + x should cover from sidebar to the right edge
      expect(dimensions.x + dimensions.width).toBe(window.innerWidth)
    })

    it('sets position to floating and centers the panel', () => {
      usePanelStore.getState().setPosition('floating')
      const { position, dimensions } = usePanelStore.getState()

      expect(position).toBe('floating')
      expect(dimensions.width).toBe(500)
      expect(dimensions.height).toBe(400)
      expect(dimensions.x).toBeGreaterThanOrEqual(100)
      expect(dimensions.y).toBeGreaterThanOrEqual(100)
    })

    it('resets drag/resize flags when position changes', () => {
      usePanelStore.getState().startDragging()
      usePanelStore.getState().startResizing()
      usePanelStore.getState().setPosition('floating')
      const state = usePanelStore.getState()
      expect(state.isDragging).toBe(false)
      expect(state.isResizing).toBe(false)
    })
  })

  describe('setDimensions', () => {
    it('merges a partial dimensions object into existing dimensions', () => {
      usePanelStore.setState({ dimensions: { width: 800, height: 400, x: 10, y: 20 } })
      usePanelStore.getState().setDimensions({ width: 900 })
      expect(usePanelStore.getState().dimensions).toEqual({
        width: 900,
        height: 400,
        x: 10,
        y: 20,
      })
    })

    it('accepts multiple dimension keys at once', () => {
      usePanelStore.setState({ dimensions: { width: 800, height: 400, x: 10, y: 20 } })
      usePanelStore.getState().setDimensions({ x: 50, y: 75 })
      expect(usePanelStore.getState().dimensions).toEqual({
        width: 800,
        height: 400,
        x: 50,
        y: 75,
      })
    })

    it('leaves dimensions untouched when passed an empty object', () => {
      const before = { ...usePanelStore.getState().dimensions }
      usePanelStore.getState().setDimensions({})
      expect(usePanelStore.getState().dimensions).toEqual(before)
    })
  })

  describe('drag state', () => {
    it('startDragging sets isDragging true', () => {
      usePanelStore.getState().startDragging()
      expect(usePanelStore.getState().isDragging).toBe(true)
    })

    it('stopDragging sets isDragging false', () => {
      usePanelStore.getState().startDragging()
      usePanelStore.getState().stopDragging()
      expect(usePanelStore.getState().isDragging).toBe(false)
    })
  })

  describe('resize state', () => {
    it('startResizing sets isResizing true', () => {
      usePanelStore.getState().startResizing()
      expect(usePanelStore.getState().isResizing).toBe(true)
    })

    it('stopResizing sets isResizing false', () => {
      usePanelStore.getState().startResizing()
      usePanelStore.getState().stopResizing()
      expect(usePanelStore.getState().isResizing).toBe(false)
    })

    it('drag and resize flags are independent', () => {
      usePanelStore.getState().startDragging()
      usePanelStore.getState().startResizing()
      expect(usePanelStore.getState().isDragging).toBe(true)
      expect(usePanelStore.getState().isResizing).toBe(true)

      usePanelStore.getState().stopDragging()
      expect(usePanelStore.getState().isDragging).toBe(false)
      expect(usePanelStore.getState().isResizing).toBe(true)
    })
  })
})
