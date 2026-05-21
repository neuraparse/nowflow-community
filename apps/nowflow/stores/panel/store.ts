import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'
import { PanelDimensions, PanelPosition, PanelStore, PanelTab } from './types'

// Helper function to safely access window dimensions
const getWindowDimension = (dimension: 'width' | 'height', defaultValue: number): number => {
  if (typeof window === 'undefined') return defaultValue
  return dimension === 'width' ? window.innerWidth : window.innerHeight
}

// Helper function to safely access localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
}

// Helper function to get sidebar width
const getSidebarWidth = (): number => {
  // Get sidebar mode from localStorage (persist key from useSidebarStore)
  const sidebarState = safeLocalStorage.getItem('sidebar-state')
  // Keep legacy workspace offsets so the panel lines up with the original layout grid.
  const EXPANDED = 256
  const COLLAPSED = 64
  if (!sidebarState) return EXPANDED

  try {
    const { state } = JSON.parse(sidebarState)
    const { mode, isExpanded } = state
    return mode === 'expanded' && isExpanded ? EXPANDED : COLLAPSED
  } catch {
    return EXPANDED // Default to expanded width if error
  }
}

const isPanelPosition = (value: unknown): value is PanelPosition =>
  value === 'right' || value === 'bottom' || value === 'floating'

const renderedPanelTabs = new Set<PanelTab>([
  'console',
  'logs',
  'history',
  'versions',
  'hitl',
  'experiments',
  'agent-trace',
  'evals',
])

const normalizePanelTab = (value: unknown): PanelTab =>
  renderedPanelTabs.has(value as PanelTab) ? (value as PanelTab) : 'console'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const normalizePersistedState = (persistedState: any) => {
  if (!persistedState) return persistedState

  const currentWindowWidth = getWindowDimension('width', 1200)
  const currentWindowHeight = getWindowDimension('height', 800)
  const sidebarWidth = getSidebarWidth()
  const position: PanelPosition = isPanelPosition(persistedState.position)
    ? persistedState.position
    : 'bottom'
  const currentDimensions = persistedState.dimensions ?? DEFAULT_DIMENSIONS[position]

  let dimensions: PanelDimensions

  if (position === 'right') {
    const maxWidth = Math.max(320, Math.min(420, currentWindowWidth - sidebarWidth - 24))
    const width = clamp(
      typeof currentDimensions?.width === 'number' ? currentDimensions.width : 336,
      320,
      maxWidth
    )

    dimensions = {
      width,
      height: currentWindowHeight - 64,
      x: currentWindowWidth - width,
      y: 64,
    }
  } else if (position === 'bottom') {
    const height = clamp(
      typeof currentDimensions?.height === 'number' ? currentDimensions.height : 300,
      220,
      Math.max(220, currentWindowHeight - 140)
    )

    dimensions = {
      width: currentWindowWidth - sidebarWidth,
      height,
      x: sidebarWidth,
      y: currentWindowHeight - height,
    }
  } else {
    const width = clamp(
      typeof currentDimensions?.width === 'number' ? currentDimensions.width : 500,
      360,
      Math.max(360, currentWindowWidth - sidebarWidth - 32)
    )
    const height = clamp(
      typeof currentDimensions?.height === 'number' ? currentDimensions.height : 400,
      260,
      Math.max(260, currentWindowHeight - 96)
    )

    dimensions = {
      width,
      height,
      x: clamp(
        typeof currentDimensions?.x === 'number'
          ? currentDimensions.x
          : (currentWindowWidth - width) / 2,
        sidebarWidth + 8,
        currentWindowWidth - width - 8
      ),
      y: clamp(
        typeof currentDimensions?.y === 'number'
          ? currentDimensions.y
          : (currentWindowHeight - height) / 2,
        64,
        currentWindowHeight - height - 8
      ),
    }
  }

  return {
    ...persistedState,
    activeTab: normalizePanelTab(persistedState.activeTab),
    position,
    dimensions,
    isDragging: false,
    isResizing: false,
  }
}

// Default dimensions for different panel positions - Compact modern design
const DEFAULT_DIMENSIONS: Record<PanelPosition, PanelDimensions> = {
  right: {
    width: 320,
    height: getWindowDimension('height', 800) - 64, // 64px for header
    x: getWindowDimension('width', 1200) - 320,
    y: 64, // Below header
  },
  bottom: {
    width: getWindowDimension('width', 1200) - getSidebarWidth(), // Adjust width based on sidebar
    height: 240, // Reduced from 300 to 240 for more compact design
    x: getSidebarWidth(), // Align with sidebar
    y: getWindowDimension('height', 800) - 240,
  },
  floating: {
    width: 480, // Reduced from 500
    height: 360, // Reduced from 400
    x: Math.max(100, (getWindowDimension('width', 1200) - 480) / 2),
    y: Math.max(100, (getWindowDimension('height', 800) - 360) / 2),
  },
}

export const usePanelStore = create<PanelStore>()(
  devtools(
    persist(
      (set) => ({
        isOpen: false, // Start collapsed by default
        activeTab: 'console',
        position: 'bottom', // Set default position to bottom
        dimensions: DEFAULT_DIMENSIONS.bottom, // Set default dimensions for bottom position
        isDragging: false,
        isResizing: false,

        togglePanel: () => {
          set((state) => ({ isOpen: !state.isOpen }))
        },

        setActiveTab: (tab: PanelTab) => {
          set({ activeTab: normalizePanelTab(tab) })
        },

        setPosition: (position: PanelPosition) => {
          // When changing position, we need to ensure the panel is properly positioned
          // based on current window dimensions and sidebar width
          const currentWindowWidth = getWindowDimension('width', 1200)
          const currentWindowHeight = getWindowDimension('height', 800)
          const currentSidebarWidth = getSidebarWidth()

          let newDimensions: PanelDimensions

          if (position === 'right') {
            newDimensions = {
              width: 336,
              height: currentWindowHeight - 64,
              x: currentWindowWidth - 336,
              y: 64,
            }
          } else if (position === 'bottom') {
            newDimensions = {
              width: currentWindowWidth - currentSidebarWidth,
              height: 300,
              x: currentSidebarWidth,
              y: currentWindowHeight - 300,
            }
          } else {
            // floating
            newDimensions = {
              width: 500,
              height: 400,
              x: Math.max(100, (currentWindowWidth - 500) / 2),
              y: Math.max(100, (currentWindowHeight - 400) / 2),
            }
          }

          set(() => ({
            position,
            dimensions: newDimensions,
            // Reset dragging and resizing states when changing position
            isDragging: false,
            isResizing: false,
          }))
        },

        setDimensions: (dimensions: Partial<PanelDimensions>) => {
          set((state) => ({
            dimensions: {
              ...state.dimensions,
              ...dimensions,
            },
          }))
        },

        startDragging: () => {
          set({ isDragging: true })
        },

        stopDragging: () => {
          set({ isDragging: false })
        },

        startResizing: () => {
          set({ isResizing: true })
        },

        stopResizing: () => {
          set({ isResizing: false })
        },
      }),
      {
        name: 'panel-store',
        storage: safeStorage,
        version: 1,
        migrate: (persistedState) => normalizePersistedState(persistedState),
      }
    )
  )
)
