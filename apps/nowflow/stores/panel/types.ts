export type PanelPosition = 'right' | 'bottom' | 'floating'

export type PanelTab =
  | 'console'
  | 'logs'
  | 'history'
  | 'chat'
  | 'versions'
  | 'hitl'
  | 'experiments'
  | 'agent-trace'
  | 'evals'

export interface PanelDimensions {
  width: number
  height: number
  x: number
  y: number
}

export interface PanelStore {
  isOpen: boolean
  activeTab: PanelTab
  position: PanelPosition
  dimensions: PanelDimensions
  isDragging: boolean
  isResizing: boolean

  togglePanel: () => void
  setActiveTab: (tab: PanelTab) => void
  setPosition: (position: PanelPosition) => void
  setDimensions: (dimensions: Partial<PanelDimensions>) => void
  startDragging: () => void
  stopDragging: () => void
  startResizing: () => void
  stopResizing: () => void
}
