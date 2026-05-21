'use client'

import React, {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useParams } from 'next/navigation'
import {
  ConnectionLineType,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useShallow } from 'zustand/react/shallow'
import { CollaborationCursors } from '@/components/collaboration/collaboration-cursors'
import { ModernWorkflowIcon } from '@/components/modern-control-bar-icons'
import { LoadingAgent } from '@/components/ui/loading-agent'
import { WorkspaceLoading } from '@/components/ui/workspace-loading'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { cn, generateUUID } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useExecutionStore } from '@/stores/execution/store'
import { useGeneralStore } from '@/stores/settings/general/store'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { workflowSync } from '@/stores/workflows/sync'
import { useWorkflowStyleStore } from '@/stores/workflows/workflow-style/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { useRealtimeCollaboration } from '@/hooks/use-realtime-collaboration'
import { NotificationList } from '@/app/w/[id]/components/notifications/notifications'
import { getBlock } from '@/blocks'
import { useOptimizedEdges } from './components/performance/memoization-hooks'
import { useUltraSmoothInit } from './components/performance/ultra-smooth-performance'
import { WorkflowPerformanceMonitor } from './components/performance/workflow-performance-monitor'
import { RightSidebar } from './components/right-sidebar/right-sidebar'
import { SelectionToolbar } from './components/selection-toolbar/selection-toolbar'
import { Toolbar } from './components/toolbar/toolbar'
import { WorkflowContextMenu } from './components/workflow-context-menu/workflow-context-menu'
import { HeroConnectionLine } from './components/workflow-edge/hero-connection-line'
// Group utils no longer needed — zone-based grouping doesn't hide/redirect edges
import { createLoopNode, getRelativeLoopPosition } from './components/workflow-loop/workflow-loop'
import {
  useBlockConfigCollaborationSync,
  useSubBlockCollaborationSync,
} from './hooks/use-collaboration-sync'
import { useGpuOptimization } from './hooks/use-gpu-optimization'
// Import node and edge types from separate file to prevent HMR issues
// Using singleton pattern to ensure stable references across hot reloads
import { useLiveValidation } from './hooks/use-live-validation'
import { useLoadingState } from './hooks/use-loading-state'
import { useContextMenuEvents, useSubBlockValueEvents } from './hooks/use-workflow-events'
import { useWorkflowInit } from './hooks/use-workflow-init'
import { useWorkflowKeyboardShortcuts } from './hooks/use-workflow-keyboard-shortcuts'
import { getEdgeTypes, getNodeTypes } from './workflow-types'

// Lazy load heavy components for better performance
const ControlBar = React.lazy(() =>
  import('./components/control-bar/control-bar').then((module) => ({ default: module.ControlBar }))
)
const ErrorBoundary = React.lazy(() =>
  import('./components/error/index').then((module) => ({ default: module.ErrorBoundary }))
)
const ExecutionMetrics = React.lazy(() =>
  import('./components/execution-metrics/execution-metrics').then((module) => ({
    default: module.ExecutionMetrics,
  }))
)
const Panel = React.lazy(() =>
  import('./components/panel/panel').then((module) => ({ default: module.Panel }))
)

function ControlBarShell({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div
      className={`fixed top-0 right-0 z-30 flex items-center justify-center px-4 pt-3 pb-2 pointer-events-none ${
        isCollapsed ? 'left-16' : 'left-64'
      }`}
      aria-hidden="true"
    >
      <div className="workflow-editor-toolbar workflow-editor-top-strip pointer-events-auto grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 opacity-80">
        <div
          className={cn(
            workflowEditorTheme.shell,
            'workflow-editor-info workflow-editor-top-identity flex items-center gap-2.5 px-3 py-2 rounded-[8px]'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                workflowEditorTheme.surface,
                workflowEditorTheme.accent,
                'workflow-editor-top-identity-icon flex h-6 w-6 items-center justify-center rounded-[6px]'
              )}
            >
              <ModernWorkflowIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  'workflow-editor-top-identity-title text-xs font-medium',
                  workflowEditorTheme.title
                )}
              >
                Loading workspace...
              </span>
              <span className={cn('flex items-center gap-2 text-xs', workflowEditorTheme.muted)}>
                <LoadingAgent size="sm" />
                Preparing controls
              </span>
            </div>
          </div>
        </div>
        <div className="workflow-editor-top-stats hidden items-center gap-2 lg:flex">
          <div className="workflow-editor-top-stat">
            <span className="workflow-editor-top-stat-label">Blocks</span>
            <span className="workflow-editor-top-stat-value">--</span>
          </div>
          <div className="workflow-editor-top-stat">
            <span className="workflow-editor-top-stat-label">Links</span>
            <span className="workflow-editor-top-stat-value">--</span>
          </div>
          <div className="workflow-editor-top-stat">
            <span className="workflow-editor-top-stat-label">Active</span>
            <span className="workflow-editor-top-stat-value">--</span>
          </div>
        </div>
        <div className="workflow-editor-top-actions ml-auto flex items-center gap-2 pr-3">
          <div
            className={cn(
              workflowEditorTheme.shell,
              'workflow-editor-island workflow-editor-top-action-group flex items-center gap-1.5 px-2 py-1.5 rounded-[8px]'
            )}
          >
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
          </div>
          <div
            className={cn(
              workflowEditorTheme.shell,
              'workflow-editor-island workflow-editor-top-action-group flex items-center gap-1.5 px-2 py-1.5 rounded-[8px]'
            )}
          >
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
          </div>
          <div
            className={cn(
              workflowEditorTheme.shell,
              'workflow-editor-island workflow-editor-top-action-group flex items-center gap-1.5 px-2 py-1.5 rounded-[8px]'
            )}
          >
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
            <div className={cn(workflowEditorTheme.surface, 'h-8 w-8 rounded-[6px]')} />
          </div>
        </div>
      </div>
    </div>
  )
}

// CRITICAL: Logger must be defined outside component to be accessible in all scopes
const logger = createLogger('Workflow')

// ── Module-scope constants — never change, no useMemo overhead ──────────────
const DEFAULT_EDGE_OPTIONS = { type: 'heroEdge', animated: false } as const
const PRO_OPTIONS = { hideAttribution: true } as const
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const
const SNAP_GRID: [number, number] = [1, 1]

function WorkflowContent() {
  // Ultra-smooth performance initialization
  useUltraSmoothInit()

  // Live validation — flags missing fields in the background
  useLiveValidation()

  // Session for collaboration identity
  const { data: session } = useSession()

  // Get stable node and edge types using singleton pattern
  const nodeTypes = getNodeTypes()
  const edgeTypes = getEdgeTypes()

  // Global workflow style
  const globalNodeStyle = useWorkflowStyleStore((state) => state.globalNodeStyle)

  // State
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  // Clipboard for copy/paste (transient — no persistence needed)
  const [clipboard, setClipboard] = useState<Array<{
    block: {
      id: string
      type: string
      name: string
      position: { x: number; y: number }
      [key: string]: any
    }
    subBlockValues: Record<string, any>
  }> | null>(null)
  const { mode, isExpanded } = useSidebarStore()

  // ── Workflow initialization (mounting, sync, navigation, SSE) ──
  const {
    isMounted,
    isInitialized,
    isUIReady,
    isLoadingWorkflow,
    activeWorkflowId,
    onInit,
    hasFitViewForWorkflow,
  } = useWorkflowInit()

  // In hover mode, act as if sidebar is always collapsed for layout purposes
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  // Hooks
  const params = useParams()
  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow()

  // Real-time collaboration via Yjs
  const {
    collaborators,
    isConnected,
    syncNodePosition,
    syncNodeDrag,
    syncNodeAdd,
    syncNodeRemove,
    syncEdgeAdd,
    syncEdgeRemove,
    syncNodeDataChange,
    syncBlockConfig,
    syncCursor,
    syncSelection,
  } = useRealtimeCollaboration(
    activeWorkflowId,
    session?.user?.id || '',
    session?.user?.name || 'User'
  )

  // Use optimized selectors to prevent unnecessary re-renders
  const blocks = useWorkflowStore((state) => state.blocks)
  const edges = useWorkflowStore((state) => state.edges)
  const loops = useWorkflowStore((state) => state.loops)
  const groups = useWorkflowStore((state) => state.groups)
  const selectedNodeIds = useWorkflowStore((state) => state.selectedNodeIds)

  // Actions (these don't change often, so we can select them together)
  const {
    addBlock,
    updateBlockPosition,
    addEdge,
    removeEdge,
    clearSelection,
    updateEdgeStyle,
    updateEdgeThickness,
    updateEdgeAnimation,
    updateEdgeColor,
    setDragging,
    markDurableChange,
  } = useWorkflowStore(
    useShallow((state) => ({
      addBlock: state.addBlock,
      updateBlockPosition: state.updateBlockPosition,
      addEdge: state.addEdge,
      removeEdge: state.removeEdge,
      clearSelection: state.clearSelection,
      updateEdgeStyle: state.updateEdgeStyle,
      updateEdgeThickness: state.updateEdgeThickness,
      updateEdgeAnimation: state.updateEdgeAnimation,
      updateEdgeColor: state.updateEdgeColor,
      setDragging: state.setDragging,
      markDurableChange: state.markDurableChange,
    }))
  )

  const setSubBlockValue = useSubBlockStore((s) => s.setValue)

  // Execution and debug mode state
  const activeBlockIds = useExecutionStore((s) => s.activeBlockIds)
  const pendingBlocks = useExecutionStore((s) => s.pendingBlocks)
  const isDebugModeEnabled = useGeneralStore((s) => s.isDebugModeEnabled)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    targetType: 'canvas' | 'block' | 'group'
    targetId?: string
  } | null>(null)

  // Right sidebar state - must be called before any conditional returns
  const isRightSidebarOpen = useWorkflowStore((state) => state.isRightSidebarOpen)

  // ── Collaboration sync hooks ──
  useSubBlockCollaborationSync(activeWorkflowId, syncNodeDataChange)
  useBlockConfigCollaborationSync(syncBlockConfig)

  // Fit view ONLY ONCE when workflow first loads (not on every change)
  useEffect(() => {
    if (
      isUIReady &&
      Object.keys(blocks).length > 0 &&
      activeWorkflowId &&
      hasFitViewForWorkflow.current !== activeWorkflowId
    ) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 })
        console.debug('[Workflow] Fit view to blocks (first load)')
        hasFitViewForWorkflow.current = activeWorkflowId
      }, 150)

      return () => clearTimeout(timer)
    }
  }, [activeWorkflowId, isUIReady, blocks, fitView, hasFitViewForWorkflow])

  // Handle drops
  const findClosestOutput = useCallback((newNodePosition: { x: number; y: number }) => {
    const allCandidates = Object.entries(useWorkflowStore.getState().blocks)
      .filter(
        ([_, block]) =>
          block.enabled && !getBlock(block.type)?.isUtility && block.type !== 'sticky-note'
      )
      .map(([id, block]) => ({
        id,
        type: block.type,
        position: block.position,
        distance: Math.sqrt(
          Math.pow(block.position.x - newNodePosition.x, 2) +
            Math.pow(block.position.y - newNodePosition.y, 2)
        ),
      }))
      .sort((a, b) => a.distance - b.distance)

    const nonStarter = allCandidates.find((b) => b.type !== 'starter')
    return nonStarter ?? allCandidates[0] ?? null
  }, [])

  // Find the closest NON-utility block (for utility block auto-connect)
  const findClosestNonUtilityBlock = useCallback((position: { x: number; y: number }) => {
    return (
      Object.entries(useWorkflowStore.getState().blocks)
        .filter(([_, b]) => b.enabled && !getBlock(b.type)?.isUtility)
        .map(([id, b]) => ({
          id,
          type: b.type,
          position: b.position,
          distance: Math.hypot(b.position.x - position.x, b.position.y - position.y),
        }))
        .sort((a, b) => a.distance - b.distance)[0] ?? null
    )
  }, [])

  // Determine the appropriate source handle based on block type
  const determineSourceHandle = useCallback((block: { id: string; type: string }) => {
    let sourceHandle = 'source'

    if (block.type === 'condition') {
      const conditionHandles = document.querySelectorAll(
        `[data-nodeid^="${block.id}"][data-handleid^="condition-"]`
      )
      if (conditionHandles.length > 0) {
        const handleId = conditionHandles[0].getAttribute('data-handleid')
        if (handleId) {
          sourceHandle = handleId
        }
      }
    }

    return sourceHandle
  }, [])

  // Listen for toolbar block click events
  useEffect(() => {
    const handleAddBlockFromToolbar = (event: CustomEvent) => {
      const { type } = event.detail

      if (!type) return
      if (type === 'connectionBlock') return

      const blockConfig = getBlock(type)
      if (!blockConfig) {
        logger.error('Invalid block type:', { type })
        return
      }

      // Always read fresh state
      const currentBlocks = useWorkflowStore.getState().blocks

      const allPositions = Object.values(currentBlocks).map((b) => b.position)

      const existingBlocks = Object.entries(currentBlocks)
        .filter(
          ([_, block]) =>
            block.enabled && !getBlock(block.type)?.isUtility && block.type !== 'sticky-note'
        )
        .map(([id, block]) => ({
          id,
          type: block.type,
          position: block.position,
        }))

      const nonStarterBlocks = existingBlocks.filter((b) => b.type !== 'starter')
      const connectCandidates = nonStarterBlocks.length > 0 ? nonStarterBlocks : existingBlocks
      const lastRegularBlock = (() => {
        if (connectCandidates.length === 0) return null
        const maxY = Math.max(...connectCandidates.map((b) => b.position.y))
        const bottomRow = connectCandidates.filter((b) => Math.abs(b.position.y - maxY) < 50)
        return bottomRow.reduce((prev, cur) => (cur.position.x > prev.position.x ? cur : prev))
      })()

      const collides = (cx: number, cy: number, rx: number, ry: number) =>
        allPositions.some((p) => Math.abs(p.x - cx) < rx && Math.abs(p.y - cy) < ry)

      const findFreeSlotX = (
        startX: number,
        targetY: number,
        stepX: number,
        rx: number,
        ry: number,
        maxSteps = 20
      ): number => {
        let x = startX
        for (let i = 0; i < maxSteps; i++) {
          if (!collides(x, targetY, rx, ry)) return x
          x += stepX
        }
        return x
      }

      let newPosition: { x: number; y: number }

      if (existingBlocks.length === 0) {
        newPosition = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      } else if (blockConfig.isUtility) {
        const UTILITY_BELOW = 180
        const UTILITY_STEP = 220
        const RX = 170
        const RY = 75

        const host = lastRegularBlock ?? existingBlocks[existingBlocks.length - 1]
        const targetY = host.position.y + UTILITY_BELOW
        const freeX = findFreeSlotX(host.position.x, targetY, UTILITY_STEP, RX, RY)
        newPosition = { x: freeX, y: targetY }
      } else {
        const BLOCK_STEP_X = 350
        const BLOCKS_PER_ROW = 4
        const ROW_GAP_Y = 300
        const RX = 260
        const RY = 100

        const bottommostRegY = Math.max(...existingBlocks.map((b) => b.position.y))
        const bottomRowBlocks = existingBlocks.filter(
          (b) => Math.abs(b.position.y - bottommostRegY) < 50
        )
        const rightmostInRow = bottomRowBlocks.reduce((prev, cur) =>
          cur.position.x > prev.position.x ? cur : prev
        )
        const leftmostRegX = Math.min(...existingBlocks.map((b) => b.position.x))

        if (bottomRowBlocks.length < BLOCKS_PER_ROW) {
          const startX = rightmostInRow.position.x + BLOCK_STEP_X
          const freeX = findFreeSlotX(startX, bottommostRegY, BLOCK_STEP_X, RX, RY)
          newPosition = { x: freeX, y: bottommostRegY }
        } else {
          const deepestY = Math.max(...allPositions.map((p) => p.y))
          const newRowY = deepestY + ROW_GAP_Y
          const freeX = findFreeSlotX(leftmostRegX, newRowY, BLOCK_STEP_X, RX, RY)
          newPosition = { x: freeX, y: newRowY }
        }
      }

      const id = generateUUID()
      const name = `${blockConfig.name} ${
        Object.values(currentBlocks).filter((b) => b.type === type).length + 1
      }`

      addBlock(id, type, name, newPosition)

      const isAutoConnectEnabled = useGeneralStore.getState().isAutoConnectEnabled
      if (isAutoConnectEnabled && type !== 'starter' && existingBlocks.length > 0) {
        if (blockConfig.isUtility) {
          if (lastRegularBlock) {
            addEdge({
              id: generateUUID(),
              source: id,
              target: lastRegularBlock.id,
              sourceHandle: 'utility-source',
              targetHandle: 'utility-target',
              type: 'heroEdge',
            })
          }
        } else {
          if (lastRegularBlock) {
            const sourceHandle = determineSourceHandle(lastRegularBlock)
            addEdge({
              id: generateUUID(),
              source: lastRegularBlock.id,
              target: id,
              sourceHandle,
              targetHandle: 'target',
              type: 'heroEdge',
            })
          }
        }
      }

      window.dispatchEvent(new CustomEvent('utility-drag-end'))
    }

    window.addEventListener('add-block-from-toolbar', handleAddBlockFromToolbar as EventListener)

    return () => {
      window.removeEventListener(
        'add-block-from-toolbar',
        handleAddBlockFromToolbar as EventListener
      )
    }
  }, [screenToFlowPosition, addBlock, addEdge, determineSourceHandle])

  // Update the onDrop handler
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      try {
        const dragData = event.dataTransfer.getData('application/json')
        if (!dragData) {
          return
        }

        const data = JSON.parse(dragData)
        if (data.type === 'connectionBlock') return

        const reactFlowBounds = event.currentTarget.getBoundingClientRect()
        const position = screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        })

        const blockConfig = getBlock(data.type)
        if (!blockConfig) {
          logger.error('Invalid block type:', { data })
          return
        }

        const id = generateUUID()
        const name = `${blockConfig.name} ${
          Object.values(useWorkflowStore.getState().blocks).filter((b) => b.type === data.type)
            .length + 1
        }`

        addBlock(id, data.type, name, position)

        const isAutoConnectEnabled = useGeneralStore.getState().isAutoConnectEnabled
        if (isAutoConnectEnabled && data.type !== 'starter') {
          if (blockConfig.isUtility) {
            const host = findClosestNonUtilityBlock(position)
            if (host) {
              addEdge({
                id: crypto.randomUUID(),
                source: id,
                target: host.id,
                sourceHandle: 'utility-source',
                targetHandle: 'utility-target',
                type: 'heroEdge',
              })
            }
          } else {
            const closestBlock = findClosestOutput(position)
            if (closestBlock) {
              const sourceHandle = determineSourceHandle(closestBlock)
              addEdge({
                id: crypto.randomUUID(),
                source: closestBlock.id,
                target: id,
                sourceHandle,
                targetHandle: 'target',
                type: 'heroEdge',
              })
            }
          }
        }

        window.dispatchEvent(new CustomEvent('utility-drag-end'))
      } catch (err) {
        const dragData = event.dataTransfer.getData('application/json')
        if (dragData) {
          logger.error('Error dropping block:', { err })
        }
      }
    },
    [
      screenToFlowPosition,
      addBlock,
      addEdge,
      findClosestOutput,
      findClosestNonUtilityBlock,
      determineSourceHandle,
    ]
  )

  // ── Stable key for active helper targets — avoids rawNodes recompute on edge selection ──
  const activeHelperTargetsKey = useMemo(() => {
    const targets: string[] = []
    edges.forEach((e) => {
      if (e.targetHandle === 'utility-target' && activeBlockIds.has(e.source)) {
        targets.push(e.target)
      }
    })
    return targets.sort().join(',')
  }, [edges, activeBlockIds])

  // Cache measured node dimensions so rawNodes can use actual sizes (not estimates)
  const measuredDimsRef = useRef(new Map<string, { width: number; height: number }>())

  // Transform blocks and loops into ReactFlow nodes with optimization
  const rawNodes = useMemo(() => {
    const nodeArray: any[] = []

    // ── Pre-compute lookup Maps — O(n) instead of O(n^2) per-block searches ──
    const blockToLoopId = new Map<string, string>()
    Object.entries(loops).forEach(([loopId, loop]) => {
      loop.nodes.forEach((nodeId) => blockToLoopId.set(nodeId, loopId))
    })

    const activeHelperTargets = new Set(
      activeHelperTargetsKey ? activeHelperTargetsKey.split(',') : []
    )

    // ── Group visual overlay nodes (detached — NOT parent-child) ─────────────
    const GROUP_PADDING = { TOP: 50, RIGHT: 50, BOTTOM: 60, LEFT: 50 }

    Object.entries(groups).forEach(([groupId, group]) => {
      const memberBlocks = group.nodeIds.map((nid) => blocks[nid]).filter((b) => b && b.position)

      if (memberBlocks.length === 0) return

      const BLOCK_W = 220
      const BLOCK_H = 55
      const cachedDims = measuredDimsRef.current
      const bound = memberBlocks.reduce(
        (acc, block) => {
          const measured = cachedDims.get(block.id)
          const bw = measured?.width || (block.isWide ? 480 : BLOCK_W)
          const bh = measured?.height || block.height || BLOCK_H
          const left = block.position.x - bw / 2
          const top = block.position.y - bh / 2
          const right = block.position.x + bw / 2
          const bottom = block.position.y + bh / 2
          acc.minX = Math.min(acc.minX, left)
          acc.minY = Math.min(acc.minY, top)
          acc.maxX = Math.max(acc.maxX, right)
          acc.maxY = Math.max(acc.maxY, bottom)
          return acc
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      )

      const containerLeft = bound.minX - GROUP_PADDING.LEFT
      const containerTop = bound.minY - GROUP_PADDING.TOP
      const containerRight = bound.maxX + GROUP_PADDING.RIGHT
      const containerBottom = bound.maxY + GROUP_PADDING.BOTTOM
      const groupWidth = containerRight - containerLeft
      const groupHeight = containerBottom - containerTop
      const groupPos = {
        x: containerLeft + groupWidth / 2,
        y: containerTop + groupHeight / 2,
      }

      const color = group.color || '#8B5CF6'

      nodeArray.push({
        id: `group-${groupId}`,
        type: 'groupZone',
        position: groupPos,
        className: 'workflow-group-container',
        selectable: false,
        draggable: true,
        style: {
          width: groupWidth,
          height: groupHeight,
          borderRadius: '16px',
          border: `1.5px solid ${color}40`,
          background: `${color}0D`,
          zIndex: -1,
        },
        data: { group, bounds: { width: groupWidth, height: groupHeight } },
      })
    })

    // ── Loop nodes ───────────────────────────────────────────────────────────
    Object.entries(loops).forEach(([loopId, loop]) => {
      const loopNodes = createLoopNode({ loopId, loop, blocks })
      if (loopNodes) nodeArray.push(...loopNodes)
    })

    const loopNodePositions = new Map<string, { x: number; y: number }>()
    nodeArray.forEach((n) => {
      if (
        n.id?.startsWith('loop-') &&
        !n.id.startsWith('loop-label-') &&
        !n.id.startsWith('loop-input-')
      ) {
        const width =
          typeof n.style?.width === 'number'
            ? n.style.width
            : Number.parseFloat(String(n.style?.width ?? 0))
        const height =
          typeof n.style?.height === 'number'
            ? n.style.height
            : Number.parseFloat(String(n.style?.height ?? 0))

        // Parent/child coordinates still need the loop container's top-left corner,
        // even though the group node itself is positioned by its center.
        loopNodePositions.set(n.id.slice(5), {
          x: n.position.x - width / 2,
          y: n.position.y - height / 2,
        })
      }
    })

    // ── Block nodes ──────────────────────────────────────────────────────────
    Object.entries(blocks).forEach(([blockId, block]) => {
      if (!block.type || !block.name) {
        logger.warn(`Skipping invalid block: ${blockId}`, { block })
        return
      }

      // Convert legacy 'output' type blocks to 'function'
      if (block.type === 'output') {
        block.type = 'function'
        block.subBlocks = {
          code: {
            id: 'code',
            type: 'code',
            value:
              'function processData(input) {\n  // Simply return the input as the final output\n  return input;\n}',
          },
        }
      }

      const blockConfig = getBlock(block.type)
      if (!blockConfig) {
        logger.error(`No configuration found for block type: ${block.type}`, { block })
        return
      }

      const loopId = blockToLoopId.get(block.id)
      let position = block.position

      let parentId: string | undefined
      if (loopId) {
        const loopPos = loopNodePositions.get(loopId)
        if (loopPos) position = getRelativeLoopPosition(block.position, loopPos)
        parentId = `loop-${loopId}`
      }

      nodeArray.push({
        id: block.id,
        type: 'heroStyleBlock',
        position,
        parentId,
        expandParent: !!loopId,
        dragHandle: '.workflow-drag-handle',
        data: {
          type: block.type,
          config: blockConfig,
          name: block.name,
          isActive: activeBlockIds.has(block.id),
          isPending: isDebugModeEnabled && pendingBlocks.includes(block.id),
          isNew: block.isNew,
          enabled: block.enabled,
          hasActiveHelper: activeHelperTargets.has(block.id),
        },
      })
    })

    return nodeArray
  }, [
    blocks,
    loops,
    groups,
    activeBlockIds,
    pendingBlocks,
    isDebugModeEnabled,
    activeHelperTargetsKey,
  ])

  // ULTRA-SMOOTH: Use ReactFlow's native state management
  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes)

  // Sync nodes with rawNodes when they change (but not during dragging)
  const isDraggingRef = useRef(false)

  // RAF-batched position updates to the store for ultra-smooth dragging
  const pendingPositionsRef = useRef(new Map<string, { x: number; y: number }>())
  const rafFlushRef = useRef<number | null>(null)
  const lastAppliedPositionsRef = useRef(new Map<string, { x: number; y: number }>())

  // Suppress ReactFlow click selection when user single-clicks a node without modifiers
  const suppressClickSelectionRef = useRef(false)

  const flushPendingPositions = useCallback(() => {
    const batch = pendingPositionsRef.current
    if (batch.size === 0) {
      rafFlushRef.current = null
      return
    }

    batch.forEach((pos, id) => {
      if (id.startsWith('group-') || id.startsWith('loop-')) return
      const rounded = { x: Math.round(pos.x), y: Math.round(pos.y) }
      updateBlockPosition(id, rounded)
    })

    batch.clear()
    rafFlushRef.current = null
  }, [updateBlockPosition])

  const queuePositionUpdate = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      pendingPositionsRef.current.set(id, pos)

      if (rafFlushRef.current == null) {
        rafFlushRef.current = requestAnimationFrame(flushPendingPositions)
      }
    },
    [flushPendingPositions]
  )

  // Debounce ref for node sync
  const nodeSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ── GPU will-change: transform optimization ──────────────────────────────
  const flowWrapperRef = useRef<HTMLDivElement>(null)
  useGpuOptimization(flowWrapperRef)

  useEffect(() => {
    // Only sync if not currently dragging to prevent jitter
    if (isDraggingRef.current) {
      return
    }

    if (nodeSyncTimeoutRef.current) {
      clearTimeout(nodeSyncTimeoutRef.current)
    }

    nodeSyncTimeoutRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        startTransition(() => {
          setNodes(rawNodes)
        })
      }
    }, 0)

    return () => {
      if (nodeSyncTimeoutRef.current) {
        clearTimeout(nodeSyncTimeoutRef.current)
      }
    }
  }, [rawNodes, setNodes])

  // Apply viewport culling for performance with large datasets
  const viewport = getViewport()
  const containerSize = useMemo(
    () => ({
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    }),
    []
  )

  // Node drag event handlers for better control
  const onNodeDragStart = useCallback(
    (event: any, node: any) => {
      isDraggingRef.current = true
      document.body.classList.add('node-dragging')
      document.documentElement.classList.add('node-dragging')
      document.getSelection()?.removeAllRanges()

      setDragging(true)
      workflowSync.pausePolling()
    },
    [setDragging]
  )

  const onNodeDrag = useCallback(
    (_event: any, _node: any, _draggedNodes: any[]) => {
      isDraggingRef.current = true
      document.getSelection()?.removeAllRanges()
      if (_node?.id && _node?.position) {
        syncNodeDrag(_node.id, _node.position)
      }
    },
    [syncNodeDrag]
  )

  const onNodeDragStop = useCallback(
    (event: any, node: any, draggedNodes: any[]) => {
      if (!node?.id) {
        isDraggingRef.current = false
        document.body.classList.remove('node-dragging')
        document.documentElement.classList.remove('node-dragging')
        return
      }

      const allDragged = draggedNodes && draggedNodes.length > 0 ? draggedNodes : [node]

      const { batchUpdateBlocks, groups, blocks: storeBlocks } = useWorkflowStore.getState()
      const blockUpdates: { id: string; changes: { position: { x: number; y: number } } }[] = []

      const draggedGroupNode = allDragged.find(
        (n: any) => n?.id?.startsWith('group-') && !n.id.includes('label')
      )
      if (draggedGroupNode) {
        const groupId = draggedGroupNode.id.replace('group-', '')
        const group = groups[groupId]
        if (group) {
          const newPos = draggedGroupNode.position || draggedGroupNode.positionAbsolute
          const GROUP_PADDING = { TOP: 50, RIGHT: 50, BOTTOM: 60, LEFT: 50 }
          const BLOCK_W = 220,
            BLOCK_H = 55
          const cachedDims = measuredDimsRef.current
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity
          group.nodeIds.forEach((nid: string) => {
            const block = storeBlocks[nid]
            if (!block?.position) return
            const dims = cachedDims.get(nid)
            const bw = dims?.width || (block.isWide ? 480 : BLOCK_W)
            const bh = dims?.height || block.height || BLOCK_H
            minX = Math.min(minX, block.position.x - bw / 2)
            minY = Math.min(minY, block.position.y - bh / 2)
            maxX = Math.max(maxX, block.position.x + bw / 2)
            maxY = Math.max(maxY, block.position.y + bh / 2)
          })
          if (minX !== Infinity) {
            const origCX = (minX - GROUP_PADDING.LEFT + maxX + GROUP_PADDING.RIGHT) / 2
            const origCY = (minY - GROUP_PADDING.TOP + maxY + GROUP_PADDING.BOTTOM) / 2
            const dx = newPos.x - origCX
            const dy = newPos.y - origCY

            group.nodeIds.forEach((nid: string) => {
              const block = storeBlocks[nid]
              if (!block?.position) return
              blockUpdates.push({
                id: nid,
                changes: {
                  position: {
                    x: Math.round(block.position.x + dx),
                    y: Math.round(block.position.y + dy),
                  },
                },
              })
            })
          }
        }
      } else {
        allDragged.forEach((draggedNode: any) => {
          if (!draggedNode?.id) return
          if (draggedNode.id.startsWith('group-') || draggedNode.id.startsWith('loop-')) return

          const pos = draggedNode.parentId
            ? draggedNode.positionAbsolute || draggedNode.position
            : draggedNode.position || draggedNode.positionAbsolute
          const { x, y } = pos || { x: 0, y: 0 }

          blockUpdates.push({
            id: draggedNode.id,
            changes: { position: { x: Math.round(x), y: Math.round(y) } },
          })
        })
      }

      if (blockUpdates.length > 0) {
        if (blockUpdates.length === 1) {
          updateBlockPosition(blockUpdates[0].id, blockUpdates[0].changes.position)
        } else {
          batchUpdateBlocks(blockUpdates)
        }
      }

      isDraggingRef.current = false
      document.body.classList.remove('node-dragging')
      document.documentElement.classList.remove('node-dragging')

      // Sync final positions to collaborators
      blockUpdates.forEach(({ id, changes }) => {
        syncNodePosition(id, changes.position)
      })

      setDragging(false)
      workflowSync.resumePolling()
      markDurableChange()
      workflowSync.syncUserAction()
    },
    [updateBlockPosition, setDragging, markDurableChange, syncNodePosition]
  )

  // Override onNodesChange with immediate synchronous updates for smooth dragging.
  const handleNodesChange = useCallback(
    (changes: any) => {
      const isDragging = changes.some(
        (change: any) => change.type === 'position' && change.dragging !== false
      )
      if (isDragging) {
        isDraggingRef.current = true
      }

      const groupDragChange = changes.find(
        (c: any) => c.type === 'position' && c.dragging && c.position && c.id.startsWith('group-')
      )

      onNodesChange(changes)

      // Cache measured dimensions for accurate group bounds calculation
      changes.forEach((change: any) => {
        if (change.type === 'dimensions' && change.id && change.dimensions) {
          measuredDimsRef.current.set(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          })
        }
      })

      const dragPosChanges = changes.filter(
        (c: any) => c.type === 'position' && c.dragging && c.position
      )
      if (dragPosChanges.length === 0) return

      const { groups, blocks: storeBlocks } = useWorkflowStore.getState()

      // SCENARIO A: Group container being dragged
      if (groupDragChange) {
        const groupId = groupDragChange.id.replace('group-', '')
        const group = groups[groupId]
        if (!group) return

        const newContainerPos = groupDragChange.position

        setNodes((prevNodes) => {
          const GROUP_PADDING = { TOP: 50, RIGHT: 50, BOTTOM: 60, LEFT: 50 }
          const BLOCK_W = 220,
            BLOCK_H = 55
          const cachedDims = measuredDimsRef.current

          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity
          group.nodeIds.forEach((nid: string) => {
            const block = storeBlocks[nid]
            if (!block?.position) return
            const dims = cachedDims.get(nid)
            const bw = dims?.width || (block.isWide ? 480 : BLOCK_W)
            const bh = dims?.height || block.height || BLOCK_H
            minX = Math.min(minX, block.position.x - bw / 2)
            minY = Math.min(minY, block.position.y - bh / 2)
            maxX = Math.max(maxX, block.position.x + bw / 2)
            maxY = Math.max(maxY, block.position.y + bh / 2)
          })
          if (minX === Infinity) return prevNodes

          const origCX = (minX - GROUP_PADDING.LEFT + maxX + GROUP_PADDING.RIGHT) / 2
          const origCY = (minY - GROUP_PADDING.TOP + maxY + GROUP_PADDING.BOTTOM) / 2
          const dx = newContainerPos.x - origCX
          const dy = newContainerPos.y - origCY

          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return prevNodes

          const memberIds = new Set(group.nodeIds)
          return prevNodes.map((n: any) => {
            if (memberIds.has(n.id)) {
              const block = storeBlocks[n.id]
              if (!block?.position) return n
              return {
                ...n,
                position: {
                  x: block.position.x + dx,
                  y: block.position.y + dy,
                },
              }
            }
            return n
          })
        })
        return
      }

      // SCENARIO B: Block drag -> resize group container to follow
      const blockPosChanges = dragPosChanges.filter(
        (c: any) => !c.id.startsWith('group-') && !c.id.startsWith('loop-')
      )
      if (blockPosChanges.length === 0) return

      const posMap = new Map<string, { x: number; y: number }>()
      blockPosChanges.forEach((c: any) => posMap.set(c.id, c.position))

      let hasGroupedDrag = false
      for (const group of Object.values(groups)) {
        if (group.nodeIds.some((nid: string) => posMap.has(nid))) {
          hasGroupedDrag = true
          break
        }
      }
      if (!hasGroupedDrag) return

      const GROUP_PADDING = { TOP: 50, RIGHT: 50, BOTTOM: 60, LEFT: 50 }
      const BLOCK_W = 220
      const BLOCK_H = 55
      const cachedDims = measuredDimsRef.current

      setNodes((prevNodes) => {
        const nodeMap = new Map<string, any>()
        prevNodes.forEach((n: any) => nodeMap.set(n.id, n))

        const updates = new Map<string, any>()

        Object.entries(groups).forEach(([groupId, group]) => {
          if (!group.nodeIds.some((nid: string) => posMap.has(nid))) return

          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity

          group.nodeIds.forEach((nid: string) => {
            const rfNode = nodeMap.get(nid)
            const block = storeBlocks[nid]
            if (!rfNode && !block) return

            const pos = rfNode?.position || block?.position
            if (!pos) return

            const mw =
              rfNode?.measured?.width ||
              cachedDims.get(nid)?.width ||
              (block?.isWide ? 480 : BLOCK_W)
            const mh =
              rfNode?.measured?.height || cachedDims.get(nid)?.height || block?.height || BLOCK_H

            minX = Math.min(minX, pos.x - mw / 2)
            minY = Math.min(minY, pos.y - mh / 2)
            maxX = Math.max(maxX, pos.x + mw / 2)
            maxY = Math.max(maxY, pos.y + mh / 2)
          })

          if (minX === Infinity) return

          const color = group.color || '#8B5CF6'
          const cLeft = minX - GROUP_PADDING.LEFT
          const cTop = minY - GROUP_PADDING.TOP
          const w = maxX + GROUP_PADDING.RIGHT - cLeft
          const h = maxY + GROUP_PADDING.BOTTOM - cTop
          const cx = cLeft + w / 2
          const cy = cTop + h / 2

          updates.set(`group-${groupId}`, {
            position: { x: cx, y: cy },
            style: {
              width: w,
              height: h,
              borderRadius: '16px',
              border: `1.5px solid ${color}40`,
              background: `${color}0D`,
              zIndex: -1,
            },
            data: { group, bounds: { width: w, height: h } },
          })
        })

        if (updates.size === 0) return prevNodes

        return prevNodes.map((n: any) => {
          const upd = updates.get(n.id)
          if (!upd) return n
          return { ...n, ...upd }
        })
      })
    },
    [onNodesChange, setNodes]
  )

  // IMMEDIATE edge updates - no RAF delays
  const onEdgesChange = useCallback(
    (changes: any) => {
      changes.forEach((change: any) => {
        if (change.type === 'remove') {
          removeEdge(change.id)
          syncEdgeRemove(change.id)
        }
      })
    },
    [removeEdge, syncEdgeRemove]
  )

  // IMMEDIATE connection handling - no RAF delays
  const onConnect = useCallback(
    (connection: any) => {
      if (connection.source && connection.target) {
        const newEdge = {
          ...connection,
          id: crypto.randomUUID(),
          type: 'heroEdge', // HER ZAMAN HERO-EDGE
          animated: false,
        }
        // HERO EDGE - HER ZAMAN
        const addedEdge = addEdge(newEdge)
        if (addedEdge) {
          syncEdgeAdd(addedEdge)
        }
      }
    },
    [addEdge, syncEdgeAdd]
  )

  // DIRECT event handlers - no wrapper delays

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Broadcast cursor position to collaborators on mouse move
  const onPaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      syncCursor(flowPos)
    },
    [screenToFlowPosition, syncCursor]
  )

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null)
    clearSelection()
    closeContextMenu()
  }, [clearSelection, closeContextMenu])

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.stopPropagation()
      setSelectedEdgeId(edge.id)
      closeContextMenu()
    },
    [closeContextMenu]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onNodeClick = useCallback((e: React.MouseEvent, node: any) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      return
    }

    const target = e.target as HTMLElement
    if (
      target.closest('.action-bar') ||
      target.closest('button') ||
      target.closest('.block-name-editable') ||
      target.closest('input')
    ) {
      suppressClickSelectionRef.current = true
      return
    }

    if (
      node.id.startsWith('loop-') ||
      node.id.startsWith('group-') ||
      node.data?.type === 'sticky-note'
    ) {
      suppressClickSelectionRef.current = true
      return
    }

    const { openRightSidebar } = useWorkflowStore.getState()
    openRightSidebar(node.id)

    suppressClickSelectionRef.current = true
  }, [])

  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: any[] }) => {
      if (suppressClickSelectionRef.current) {
        suppressClickSelectionRef.current = false
        return
      }

      if (isDraggingRef.current) {
        return
      }

      const selectedIds = nodes
        .map((node) => node.id)
        .filter((id) => !id.startsWith('loop-') && !id.startsWith('group-'))

      const { setSelectedNodes, selectedNodeIds } = useWorkflowStore.getState()

      const currentIds = selectedNodeIds.sort().join(',')
      const newIds = selectedIds.sort().join(',')
      if (currentIds !== newIds) {
        setSelectedNodes(selectedIds)
        syncSelection(selectedIds)
      }
    },
    [syncSelection]
  )

  // Static ReactFlow props
  const defaultEdgeOptions = DEFAULT_EDGE_OPTIONS
  const proOptions = PRO_OPTIONS
  const defaultViewport = DEFAULT_VIEWPORT
  const snapGrid = SNAP_GRID

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      targetType: 'canvas',
    })
  }, [])

  // Transform edges to include selection state, style, and highlighting
  const highlightedEdgeIds = useWorkflowStore((state) => state.highlightedEdgeIds)

  const isExecuting = useExecutionStore((s) => s.isExecuting)
  const activeConnections = useExecutionStore((s) => s.activeConnections)

  const visibleEdges = useMemo(() => {
    return edges.filter((e) => blocks[e.source] && blocks[e.target])
  }, [edges, blocks])

  // Stable edge callbacks
  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      removeEdge(edgeId)
      setSelectedEdgeId(null)
    },
    [removeEdge]
  )

  const handleEdgeEdit = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId)
    logger.debug('Edit edge:', edgeId)
  }, [])

  const handleEdgeCopy = useCallback(
    (edgeId: string) => {
      const e = useWorkflowStore.getState().edges.find((e) => e.id === edgeId)
      if (!e) return
      const newEdgeId = crypto.randomUUID()
      addEdge({
        id: newEdgeId,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: 'heroEdge',
      } as any)
      logger.debug('Copied edge:', edgeId, 'to', newEdgeId)
    },
    [addEdge]
  )

  const handleEdgeToggleAnimation = useCallback(
    (edgeId: string, newAnimation: string) => {
      updateEdgeAnimation(edgeId, newAnimation as any)
      logger.debug('Toggle animation for edge:', edgeId, 'to', newAnimation)
    },
    [updateEdgeAnimation]
  )

  const handleEdgeSettings = useCallback((edgeId: string, currentSettings: any) => {
    setSelectedEdgeId(edgeId)
    logger.debug('Open settings for edge:', edgeId, currentSettings)
  }, [])

  const rawEdgesWithSelection = useMemo(
    () =>
      visibleEdges.map((edge) => {
        const hasExecutionData = activeConnections.some(
          (conn) => conn.source === edge.source && conn.target === edge.target
        )
        const edgeType = isExecuting && hasExecutionData ? 'executionEdge' : edge.type || 'heroEdge'

        return {
          ...edge,
          type: edgeType,
          data: {
            selectedEdgeId,
            edgeStyle: edge.edgeStyle || 'solid',
            thickness: edge.thickness || 'medium',
            color: edge.color || 'default',
            animation: edge.animation || 'none',
            label: edge.label || '',
            highlightedEdgeIds,
            source: edge.source,
            target: edge.target,
            onDelete: handleEdgeDelete,
            onEdit: handleEdgeEdit,
            onCopy: handleEdgeCopy,
            onToggleAnimation: handleEdgeToggleAnimation,
            onSettings: handleEdgeSettings,
          },
        }
      }),
    [
      visibleEdges,
      activeConnections,
      isExecuting,
      selectedEdgeId,
      highlightedEdgeIds,
      handleEdgeDelete,
      handleEdgeEdit,
      handleEdgeCopy,
      handleEdgeToggleAnimation,
      handleEdgeSettings,
    ]
  )

  // Optimize edges with memoization
  const edgesWithSelection = useOptimizedEdges(rawEdgesWithSelection)

  // DISABLE viewport culling for ultra-smooth dragging - use all nodes directly
  const culledNodes = nodes
  const culledEdges = edgesWithSelection

  // ── Keyboard shortcuts ──
  useWorkflowKeyboardShortcuts({
    selectedEdgeId,
    setSelectedEdgeId,
    removeEdge,
    syncEdgeRemove,
    clearSelection,
    blocks,
    clipboard,
    setClipboard,
    activeWorkflowId,
    syncNodeRemove,
  })

  // ── Custom event listeners ──
  useSubBlockValueEvents(setSubBlockValue)
  useContextMenuEvents(setContextMenu)

  // ── Loading state ──
  const { showWorkspaceLoading, showControlBarShell, loadingInfo } = useLoadingState({
    isInitialized,
    isLoadingWorkflow,
    isUIReady,
    activeWorkflowId,
  })

  // HYDRATION FIX: Return simple loading state until client is mounted
  if (!isMounted) {
    return (
      <div className="flex flex-col h-dvh w-full overflow-hidden">
        <div className="flex-1 relative w-full h-full">
          <WorkspaceLoading message="Initializing..." submessage="Setting up workspace" />
        </div>
      </div>
    )
  }

  return (
    <div className="workflow-editor-runtime relative flex h-dvh w-full flex-col overflow-hidden bg-transparent">
      {/* Control Bar - Outside of padded container */}
      <div className="absolute top-0 left-0 right-0 z-50 w-full">
        {showControlBarShell && <ControlBarShell isCollapsed={isSidebarCollapsed} />}
        <div
          className={
            showControlBarShell
              ? 'opacity-0 pointer-events-none'
              : 'transition-opacity duration-500'
          }
        >
          <Suspense
            fallback={
              showControlBarShell ? null : <ControlBarShell isCollapsed={isSidebarCollapsed} />
            }
          >
            <ControlBar />
          </Suspense>
        </div>
      </div>

      <div
        ref={flowWrapperRef}
        className={`workflow-editor-stage-shell flex-1 relative z-10 w-full h-full transition-all duration-300 ease-out !bg-transparent ${
          isRightSidebarOpen ? 'pr-[420px]' : ''
        }`}
      >
        {/* Workspace Loading Overlay - Shows during workflow transitions */}
        {showWorkspaceLoading && (
          <WorkspaceLoading message={loadingInfo.message} submessage={loadingInfo.submessage} />
        )}

        <Toolbar />

        <Suspense
          fallback={<div className="w-80 h-96 bg-background/80 animate-pulse rounded-lg" />}
        >
          <Panel />
        </Suspense>
        <NotificationList />
        {/* <MiniMap /> */}
        <Suspense
          fallback={<div className="w-64 h-32 bg-background/80 animate-pulse rounded-lg" />}
        >
          <ExecutionMetrics />
        </Suspense>
        <SelectionToolbar selectedNodeIds={selectedNodeIds} />
        <ReactFlow
          nodes={culledNodes}
          edges={culledEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={onInit}
          fitView
          minZoom={0.1}
          maxZoom={1.3}
          panOnScroll
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={proOptions}
          defaultViewport={defaultViewport}
          snapGrid={snapGrid} // Ultra-fine grid for smooth movement
          connectionLineComponent={HeroConnectionLine}
          connectionLineType={ConnectionLineType.SmoothStep}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onPaneMouseMove={onPaneMouseMove}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
          onContextMenu={handleContextMenu}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          elementsSelectable={true}
          selectionOnDrag={true} // Enable selection box with Ctrl+Drag (handled by selectionKeyCode)
          selectNodesOnDrag={false} // Prevent accidental selection during drag — reduces re-renders
          nodesConnectable={true}
          nodesDraggable={true}
          panOnDrag={[1, 2]} // Enable panning with MIDDLE and RIGHT mouse buttons only
          selectionMode={SelectionMode.Partial} // Nodes must be partially inside selection box
          noWheelClassName="allow-scroll"
          edgesFocusable={false}
          edgesReconnectable={false}
          className="workflow-container workflow-editor-canvas h-full"
          snapToGrid={false} // Disable snapping for buttery-smooth free movement
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          nodeDragThreshold={5} // 5px threshold to distinguish click from drag
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          multiSelectionKeyCode={['Control', 'Meta']} // Enable Ctrl/Cmd+Click for multi-selection (Windows/Mac)
          attributionPosition="bottom-left"
          onlyRenderVisibleElements={false} // Disable virtualization to avoid pop-in/out during drag
          nodeOrigin={[0.5, 0.5]} // Center origin for consistent handle alignment
          disableKeyboardA11y={true}
          preventScrolling={true} // Prevent scroll conflicts during drag
          panOnScrollSpeed={2}
          zoomActivationKeyCode={null}
          selectionKeyCode={['Control', 'Meta']} // Enable Ctrl/Cmd+Drag for selection box (Windows/Mac)
          translateExtent={[
            [-10000, -10000],
            [10000, 10000],
          ]}
        >
          <WorkflowPerformanceMonitor />
          <CollaborationCursors
            cursors={collaborators.filter(
              (c): c is typeof c & { cursor: { x: number; y: number } } => !!c.cursor
            )}
            currentUserId={session?.user?.id || ''}
          />
        </ReactFlow>
      </div>

      {/* Right Sidebar */}
      <RightSidebar />

      {/* Context Menu */}
      {contextMenu && (
        <WorkflowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetType={contextMenu.targetType}
          targetId={contextMenu.targetId}
          onClose={closeContextMenu}
          onCopy={(ids) => {
            const { blocks: storeBlocks } = useWorkflowStore.getState()
            const { workflowValues } = useSubBlockStore.getState()
            const wfId = activeWorkflowId
            const copied = ids
              .filter((nodeId) => !nodeId.startsWith('group-') && !nodeId.startsWith('loop-'))
              .map((nodeId) => ({
                block: storeBlocks[nodeId],
                subBlockValues: (wfId ? workflowValues[wfId]?.[nodeId] : null) ?? {},
              }))
              .filter((entry) => Boolean(entry.block))
            if (copied.length > 0) setClipboard(copied)
          }}
        />
      )}
    </div>
  )
}

// Workflow wrapper
export default function Workflow() {
  return (
    <ReactFlowProvider>
      <ErrorBoundary>
        <WorkflowContent />
      </ErrorBoundary>
    </ReactFlowProvider>
  )
}
