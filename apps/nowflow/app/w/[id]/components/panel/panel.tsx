'use client'

import { type CSSProperties, useCallback, useEffect, useRef } from 'react'
import {
  Brain,
  FlaskConical,
  GitBranch,
  GripHorizontal,
  GripVertical,
  TestTube2,
  UserCheck,
} from 'lucide-react'
import { ModernLogsIcon } from '@/components/modern-logs-icons'
import {
  ModernCloseIcon,
  ModernConsoleIcon,
  ModernMinimizeIcon,
  ModernPanelIcon,
} from '@/components/modern-panel-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowHistoryIcon } from '@/components/workflow-control-icons'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { usePanelStore } from '@/stores/panel/store'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { ExperimentPanel } from '../experiments'
import { AgentTrace } from './components/agent-trace/agent-trace'
import { Console } from './components/console/console'
import { EvalsPanel } from './components/evals/evals-panel'
import { History } from './components/history/history'
import { HITLRequestsPanel } from './components/hitl'
import { Logs } from './components/logs/logs'
import { PanelPositionControl } from './components/panel-position-control/panel-position-control'
import { VersionHistoryPanel } from './components/versions'

/**
 * Cross-browser detection helpers
 */
const isIOSSafari =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

const OBSERVATION_TABS = [
  { id: 'console', icon: ModernConsoleIcon, label: 'Console', accent: '#22d3ee' },
  { id: 'logs', icon: ModernLogsIcon, label: 'Logs', accent: '#34d399' },
  { id: 'history', icon: WorkflowHistoryIcon, label: 'History', accent: '#a78bfa' },
  { id: 'versions', icon: GitBranch, label: 'Versions', accent: '#38bdf8' },
  { id: 'hitl', icon: UserCheck, label: 'HITL', accent: '#f59e0b' },
  { id: 'experiments', icon: FlaskConical, label: 'Experiments', accent: '#fb7185' },
  { id: 'agent-trace', icon: Brain, label: 'Trace', accent: '#c084fc' },
  { id: 'evals', icon: TestTube2, label: 'Evals', accent: '#f472b6' },
] as const

export function Panel() {
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const activePointerId = useRef<number | null>(null)
  const initialViewportHeight = useRef<number>(0)

  // Panel state from store
  const isOpen = usePanelStore((state) => state.isOpen)
  const togglePanel = usePanelStore((state) => state.togglePanel)
  const activeTab = usePanelStore((state) => state.activeTab)
  const setActiveTab = usePanelStore((state) => state.setActiveTab)
  const position = usePanelStore((state) => state.position)
  const dimensions = usePanelStore((state) => state.dimensions)
  const setDimensions = usePanelStore((state) => state.setDimensions)
  const startDragging = usePanelStore((state) => state.startDragging)
  const stopDragging = usePanelStore((state) => state.stopDragging)
  const startResizing = usePanelStore((state) => state.startResizing)
  const stopResizing = usePanelStore((state) => state.stopResizing)

  // Other stores
  const { activeWorkflowId } = useWorkflowRegistry()
  const isRightSidebarOpen = useWorkflowStore((state) => state.isRightSidebarOpen)
  const renderedActiveTab = OBSERVATION_TABS.some(({ id }) => id === activeTab)
    ? activeTab
    : 'console'

  useEffect(() => {
    if (renderedActiveTab !== activeTab) {
      setActiveTab(renderedActiveTab)
    }
  }, [activeTab, renderedActiveTab, setActiveTab])

  const { isExpanded: isSidebarExpanded } = useSidebarStore()
  const sidebarWidth = isSidebarExpanded ? 256 : 64 // Keep legacy offsets aligned with the original workspace docking.

  /**
   * Get coordinates from pointer/touch/mouse event (cross-browser)
   */
  const getEventCoordinates = useCallback(
    (
      e:
        | PointerEvent
        | TouchEvent
        | MouseEvent
        | React.PointerEvent
        | React.TouchEvent
        | React.MouseEvent
    ): { x: number; y: number } => {
      if ('touches' in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
      if ('clientX' in e) {
        return { x: e.clientX, y: e.clientY }
      }
      return { x: 0, y: 0 }
    },
    []
  )

  // Handle dragging the panel - Cross-browser with Pointer Events (2025 best practices)
  const handleDragStart = useCallback(
    (
      e:
        | React.PointerEvent<HTMLElement>
        | React.MouseEvent<HTMLElement>
        | React.TouchEvent<HTMLElement>
    ) => {
      // Only allow dragging in floating mode
      if (position !== 'floating') return

      // Make sure we're dragging from the header or drag handle
      const target = e.target as HTMLElement
      const isDragHandle = dragHandleRef.current?.contains(target)
      const isHeader = target.closest('.panel-header')

      if (!isDragHandle && !isHeader) return

      // Prevent default browser behavior
      e.preventDefault()
      e.stopPropagation()

      // Store pointer ID for pointer capture (cross-browser tracking)
      if ('pointerId' in e) {
        activePointerId.current = e.pointerId
        // Capture pointer to receive events even outside the element
        if (panelRef.current) {
          try {
            panelRef.current.setPointerCapture(e.pointerId)
          } catch {
            // Fallback for browsers that don't support pointer capture
          }
        }
      }

      // Store initial viewport height for iOS Safari resize detection
      initialViewportHeight.current = window.innerHeight

      // Capture initial positions
      const coords = getEventCoordinates(e)
      const startX = coords.x
      const startY = coords.y
      const startPanelX = dimensions.x
      const startPanelY = dimensions.y

      // Set visual feedback that we're dragging
      if (panelRef.current) {
        panelRef.current.style.opacity = '0.95'
        panelRef.current.style.transition = 'none'
        panelRef.current.classList.add('is-dragging')
        document.body.style.cursor = 'grabbing'
        document.body.classList.add('is-dragging')
      }

      // Start dragging in the store
      startDragging()

      // Pointer/Mouse move handler - attached to document for reliability
      function onPointerMove(moveEvent: PointerEvent | MouseEvent) {
        moveEvent.preventDefault()

        // iOS Safari: Check if this is a resize event (address bar show/hide)
        if (isIOSSafari && Math.abs(window.innerHeight - initialViewportHeight.current) > 50) {
          return // Ignore - likely from address bar animation
        }

        const coords =
          'clientX' in moveEvent ? { x: moveEvent.clientX, y: moveEvent.clientY } : { x: 0, y: 0 }

        // Calculate how far the pointer has moved
        const dx = coords.x - startX
        const dy = coords.y - startY

        // Calculate new position with bounds checking
        const maxX = window.innerWidth - dimensions.width
        const maxY = window.innerHeight - dimensions.height

        // Ensure at least 50px of the panel remains on screen
        const newX = Math.max(-dimensions.width + 50, Math.min(startPanelX + dx, maxX))
        const newY = Math.max(0, Math.min(startPanelY + dy, maxY))

        // Update dimensions in the store using requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
          setDimensions({
            x: newX,
            y: newY,
          })
        })
      }

      // Touch move handler for Safari/iOS
      function onTouchMove(moveEvent: TouchEvent) {
        moveEvent.preventDefault()

        if (moveEvent.touches.length === 0) return

        const coords = { x: moveEvent.touches[0].clientX, y: moveEvent.touches[0].clientY }
        const dx = coords.x - startX
        const dy = coords.y - startY

        const maxX = window.innerWidth - dimensions.width
        const maxY = window.innerHeight - dimensions.height

        const newX = Math.max(-dimensions.width + 50, Math.min(startPanelX + dx, maxX))
        const newY = Math.max(0, Math.min(startPanelY + dy, maxY))

        requestAnimationFrame(() => {
          setDimensions({
            x: newX,
            y: newY,
          })
        })
      }

      // Pointer/Mouse up handler
      function onPointerUp() {
        // Release pointer capture
        if (activePointerId.current !== null && panelRef.current) {
          try {
            panelRef.current.releasePointerCapture(activePointerId.current)
          } catch {
            // Ignore if already released
          }
          activePointerId.current = null
        }

        // Restore visual state
        if (panelRef.current) {
          panelRef.current.style.opacity = '1'
          panelRef.current.style.transition = 'opacity 0.2s ease'
          panelRef.current.classList.remove('is-dragging')
          document.body.style.cursor = ''
          document.body.classList.remove('is-dragging')
        }

        // Stop dragging in the store
        stopDragging()

        // Remove event listeners
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerUp)
        document.removeEventListener('mousemove', onPointerMove as EventListener)
        document.removeEventListener('mouseup', onPointerUp)
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onPointerUp)
        document.removeEventListener('touchcancel', onPointerUp)
      }

      // Add event listeners to document (pointer events for cross-browser support)
      document.addEventListener('pointermove', onPointerMove, { passive: false })
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerUp)

      // Fallback for older browsers / touch
      document.addEventListener('mousemove', onPointerMove as EventListener, { passive: false })
      document.addEventListener('mouseup', onPointerUp)
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onPointerUp)
      document.addEventListener('touchcancel', onPointerUp)
    },
    [position, dimensions, startDragging, stopDragging, setDimensions, getEventCoordinates]
  )

  // Handle resizing the panel - Cross-browser with Pointer Events (2025 best practices)
  const handleResizeStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
      // Prevent default browser behavior
      e.preventDefault()
      e.stopPropagation()

      // Store pointer ID for pointer capture
      if ('pointerId' in e) {
        activePointerId.current = e.pointerId
        if (resizeHandleRef.current) {
          try {
            resizeHandleRef.current.setPointerCapture(e.pointerId)
          } catch {
            // Fallback for browsers that don't support pointer capture
          }
        }
      }

      // Start resizing in the store
      startResizing()

      // Capture initial values
      const coords = getEventCoordinates(e)
      const startX = coords.x
      const startY = coords.y
      const startWidth = dimensions.width
      const startHeight = dimensions.height
      const startPanelX = dimensions.x
      const startPanelY = dimensions.y

      // Set visual feedback
      if (panelRef.current) {
        panelRef.current.style.transition = 'none'
        panelRef.current.classList.add('is-resizing')
        document.body.style.cursor =
          position === 'right' ? 'ew-resize' : position === 'bottom' ? 'ns-resize' : 'nwse-resize'
        document.body.classList.add('is-dragging')
      }

      // Pointer/Mouse move handler
      function onPointerMove(moveEvent: PointerEvent | MouseEvent) {
        moveEvent.preventDefault()

        const coords =
          'clientX' in moveEvent ? { x: moveEvent.clientX, y: moveEvent.clientY } : { x: 0, y: 0 }

        // Calculate how far the pointer has moved
        const dx = coords.x - startX
        const dy = coords.y - startY

        // Apply resizing based on panel position using requestAnimationFrame
        requestAnimationFrame(() => {
          if (position === 'right') {
            // Resize from left edge
            const newWidth = Math.max(300, Math.min(startWidth - dx, window.innerWidth * 0.8))
            setDimensions({ width: newWidth })
          } else if (position === 'bottom') {
            // Resize from top edge
            const newHeight = Math.max(200, Math.min(startHeight - dy, window.innerHeight * 0.8))
            setDimensions({ height: newHeight })
          } else if (position === 'floating') {
            // Resize from bottom-right corner
            const newWidth = Math.max(
              300,
              Math.min(startWidth + dx, window.innerWidth - startPanelX)
            )
            const newHeight = Math.max(
              200,
              Math.min(startHeight + dy, window.innerHeight - startPanelY)
            )

            setDimensions({
              width: newWidth,
              height: newHeight,
            })
          }
        })
      }

      // Touch move handler for Safari/iOS
      function onTouchMove(moveEvent: TouchEvent) {
        moveEvent.preventDefault()

        if (moveEvent.touches.length === 0) return

        const coords = { x: moveEvent.touches[0].clientX, y: moveEvent.touches[0].clientY }
        const dx = coords.x - startX
        const dy = coords.y - startY

        requestAnimationFrame(() => {
          if (position === 'right') {
            const newWidth = Math.max(300, Math.min(startWidth - dx, window.innerWidth * 0.8))
            setDimensions({ width: newWidth })
          } else if (position === 'bottom') {
            const newHeight = Math.max(200, Math.min(startHeight - dy, window.innerHeight * 0.8))
            setDimensions({ height: newHeight })
          } else if (position === 'floating') {
            const newWidth = Math.max(
              300,
              Math.min(startWidth + dx, window.innerWidth - startPanelX)
            )
            const newHeight = Math.max(
              200,
              Math.min(startHeight + dy, window.innerHeight - startPanelY)
            )
            setDimensions({
              width: newWidth,
              height: newHeight,
            })
          }
        })
      }

      // Pointer/Mouse up handler
      function onPointerUp() {
        // Release pointer capture
        if (activePointerId.current !== null && resizeHandleRef.current) {
          try {
            resizeHandleRef.current.releasePointerCapture(activePointerId.current)
          } catch {
            // Ignore if already released
          }
          activePointerId.current = null
        }

        // Restore visual state
        if (panelRef.current) {
          panelRef.current.style.transition = 'opacity 0.2s ease'
          panelRef.current.classList.remove('is-resizing')
          document.body.style.cursor = ''
          document.body.classList.remove('is-dragging')
        }

        // Stop resizing in the store
        stopResizing()

        // Remove event listeners
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerUp)
        document.removeEventListener('mousemove', onPointerMove as EventListener)
        document.removeEventListener('mouseup', onPointerUp)
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onPointerUp)
        document.removeEventListener('touchcancel', onPointerUp)
      }

      // Add event listeners to document (pointer events for cross-browser support)
      document.addEventListener('pointermove', onPointerMove, { passive: false })
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerUp)

      // Fallback for older browsers / touch
      document.addEventListener('mousemove', onPointerMove as EventListener, { passive: false })
      document.addEventListener('mouseup', onPointerUp)
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onPointerUp)
      document.addEventListener('touchcancel', onPointerUp)
    },
    [position, dimensions, startResizing, stopResizing, setDimensions, getEventCoordinates]
  )

  // Get panel style based on position - Glassmorphic with spacing (matching sidebar/control-bar)
  const getPanelStyle = () => {
    const { width, height, x, y } = dimensions

    // Reserve space on the right edge: right-sidebar (420 + 12 gap) otherwise Copilot FAB (68 + 16 gap)
    const rightReserve = isRightSidebarOpen ? 440 : 88

    if (position === 'right') {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
      const availableWidth = Math.max(280, viewportWidth - sidebarWidth - rightReserve - 20)
      const dockWidth = Math.min(Math.max(width, 280), availableWidth)

      return {
        width: `${dockWidth}px`,
        maxWidth: `calc(100vw - ${sidebarWidth + rightReserve + 20}px)`,
        height: 'calc(100dvh - 5rem)', // More spacing from top
        top: '64px',
        right: `${rightReserve}px`,
        bottom: 'auto',
        left: 'auto',
        borderRadius: '10px',
      }
    } else if (position === 'bottom') {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
      const availableWidth = Math.max(280, viewportWidth - sidebarWidth - rightReserve - 28)
      const dockWidth = Math.min(Math.max(Math.min(width, 1400), 280), availableWidth)
      const dockHeight = Math.min(Math.max(height, 260), 360)

      return {
        width: `${dockWidth}px`,
        maxWidth: `calc(100vw - ${sidebarWidth + rightReserve + 28}px)`,
        height: `${dockHeight}px`,
        top: 'auto',
        right: 'auto',
        bottom: '16px',
        left: `${sidebarWidth + 12}px`,
        borderRadius: '2px',
      }
    } else {
      return {
        width: `${width}px`,
        height: `${height}px`,
        top: `${y}px`,
        left: `${Math.max(x, sidebarWidth + 8)}px`, // Spacing from sidebar
        right: 'auto',
        bottom: 'auto',
        borderRadius: '10px',
      }
    }
  }

  // Get resize handle position and cursor - improved for better usability
  const getResizeHandleStyle = () => {
    if (position === 'right') {
      return {
        left: '0',
        top: '0',
        bottom: '0',
        width: '12px',
        height: '100%',
        cursor: 'ew-resize',
      }
    } else if (position === 'bottom') {
      return {
        left: '0',
        top: '0',
        right: '0',
        width: '100%',
        height: '12px',
        cursor: 'ns-resize',
      }
    } else {
      return {
        right: '0',
        bottom: '0',
        width: '24px',
        height: '24px',
        cursor: 'nwse-resize',
        borderRadius: '4px 0 0 0',
      }
    }
  }

  // Get the appropriate resize icon
  const ResizeIcon = position === 'bottom' ? GripHorizontal : GripVertical

  // If panel is not open, show the toggle button positioned adjacent to sidebar at bottom - Compact Glassmorphic
  if (!isOpen) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={togglePanel}
            className={cn(
              workflowEditorTheme.panelToggle,
              workflowEditorTheme.shell,
              'workflow-editor-panel workflow-editor-observation-toggle fixed z-10 flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground'
            )}
            style={{
              left: `${sidebarWidth + 6}px`,
              bottom: '1rem',
            }}
            variant="ghost"
          >
            <span
              className={cn(
                workflowEditorTheme.panelElevated,
                'flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted'
              )}
            >
              <ModernPanelIcon className={cn('h-4 w-4', workflowEditorTheme.muted)} />
            </span>
            <span className={cn('text-[12px] font-medium', workflowEditorTheme.muted)}>Panel</span>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="sr-only">Open Panel</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] font-logo">
          Open Panel
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <div
        ref={panelRef}
        className={`workflow-editor-panel workflow-editor-panel-shell workflow-editor-panel--${position} workflow-editor-observation-panel fixed ${position === 'floating' ? 'z-10' : 'z-[5]'} flex flex-col ${position === 'floating' ? 'transition-all duration-200 ease-out' : 'transition-all duration-200'} overflow-hidden rounded-lg border border-border bg-card`}
        data-panel-position={position}
        style={{
          ...getPanelStyle(),
          boxShadow: 'var(--enterprise-shadow-md)',
        }}
      >
        {/* Resize Handle - Minimal */}
        <div
          ref={resizeHandleRef}
          className="resize-handle absolute z-50 transition-all duration-200 hover:bg-black/[0.04] active:bg-black/[0.06] dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]"
          style={{ ...getResizeHandleStyle(), touchAction: 'none' }}
          onPointerDown={handleResizeStart}
          onMouseDown={handleResizeStart as React.MouseEventHandler}
          onTouchStart={handleResizeStart as React.TouchEventHandler}
        >
          {position === 'floating' && (
            <div className="absolute bottom-1 right-1 rounded-md border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-accent">
              <ResizeIcon className="h-4 w-4" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Drag Handle for Floating Panel - Minimal */}
        {position === 'floating' && (
          <div
            ref={dragHandleRef}
            className={cn(
              workflowEditorTheme.panelStrip,
              'drag-handle workflow-editor-observation-drag absolute left-0 right-0 top-0 z-50 flex h-8 cursor-move items-center justify-center rounded-none border-b border-border bg-muted/40 transition-colors'
            )}
            style={{ touchAction: 'none' }}
            onPointerDown={handleDragStart}
            onMouseDown={handleDragStart as React.MouseEventHandler}
            onTouchStart={handleDragStart as React.TouchEventHandler}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-black/15 dark:bg-white/20 rounded-full" />
              <div className="w-6 h-0.5 bg-black/15 dark:bg-white/20 rounded-full" />
            </div>
          </div>
        )}

        {/* Panel Header */}
        <div
          className={cn(
            workflowEditorTheme.panelStrip,
            'panel-header workflow-editor-observation-tabs flex h-10 flex-none items-center justify-between gap-2 border-b border-border bg-card px-2',
            position === 'floating' ? 'mt-8 rounded-none' : 'rounded-none'
          )}
          style={{ touchAction: position === 'floating' ? 'none' : 'auto', pointerEvents: 'auto' }}
        >
          <div
            className="workflow-editor-observation-tablist flex min-w-0 flex-1 gap-1 overflow-x-auto no-scrollbar"
            role="tablist"
            aria-label="Panel sections"
          >
            {OBSERVATION_TABS.map(({ id, icon: Icon, label, accent }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  workflowEditorTheme.tab,
                  renderedActiveTab === id && workflowEditorTheme.tabActive,
                  'workflow-editor-observation-tab flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition-colors'
                )}
                data-active={renderedActiveTab === id}
                data-panel-tab={id}
                role="tab"
                aria-selected={renderedActiveTab === id}
                style={{ '--workflow-panel-tab-accent': accent } as CSSProperties}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="workflow-editor-observation-controls flex shrink-0 items-center gap-1">
            <div
              className={cn(
                workflowEditorTheme.panelElevated,
                workflowEditorTheme.surface,
                'workflow-editor-panel-position-rail flex items-center justify-center rounded-md border border-border bg-muted px-1 py-1'
              )}
            >
              <PanelPositionControl />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    workflowEditorTheme.iconButton,
                    workflowEditorTheme.dangerButton,
                    'workflow-editor-panel-close h-7 w-7 rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                  )}
                  onClick={togglePanel}
                >
                  {position === 'floating' ? (
                    <ModernMinimizeIcon className="h-3.5 w-3.5" />
                  ) : (
                    <ModernCloseIcon className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">
                    {position === 'floating' ? 'Minimize Panel' : 'Close Panel'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px] font-logo">
                {position === 'floating' ? 'Minimize Panel' : 'Close Panel'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Panel Content */}
        <div
          className={cn(
            workflowEditorTheme.panelBody,
            'workflow-editor-observation-body relative flex-1 overflow-hidden'
          )}
        >
          {renderedActiveTab === 'console' && <Console panelWidth={dimensions.width} />}
          {renderedActiveTab === 'logs' && <Logs panelWidth={dimensions.width} />}
          {renderedActiveTab === 'history' && <History panelWidth={dimensions.width} />}
          {renderedActiveTab === 'versions' &&
            (activeWorkflowId ? (
              <VersionHistoryPanel workflowId={activeWorkflowId} />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center h-full text-[12px] font-logo',
                  workflowEditorTheme.muted
                )}
              >
                Select a workflow to view version history
              </div>
            ))}
          {renderedActiveTab === 'hitl' && (
            <HITLRequestsPanel
              workflowId={activeWorkflowId || undefined}
              panelWidth={dimensions.width}
            />
          )}
          {renderedActiveTab === 'experiments' &&
            (activeWorkflowId ? (
              <ExperimentPanel workflowId={activeWorkflowId} panelWidth={dimensions.width} />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center h-full text-[12px] font-logo',
                  workflowEditorTheme.muted
                )}
              >
                Select a workflow to manage experiments
              </div>
            ))}
          {renderedActiveTab === 'agent-trace' &&
            (activeWorkflowId ? (
              <AgentTrace workflowId={activeWorkflowId} />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center h-full text-[12px] font-logo',
                  workflowEditorTheme.muted
                )}
              >
                Select a workflow to view agent traces
              </div>
            ))}
          {renderedActiveTab === 'evals' &&
            (activeWorkflowId ? (
              <EvalsPanel workflowId={activeWorkflowId} />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center h-full text-[12px] font-logo',
                  workflowEditorTheme.muted
                )}
              >
                Select a workflow to manage evaluations
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
