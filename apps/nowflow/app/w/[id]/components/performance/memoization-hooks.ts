// 2025 Modern Memoization Hooks for ReactFlow Performance
import { useCallback, useMemo, useRef } from 'react'
import { Edge, EdgeTypes, Node, NodeTypes } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'

// Stable node types memoization using ref for truly stable reference
export function useStableNodeTypes(nodeTypes: NodeTypes): NodeTypes {
  const nodeTypesRef = useRef<NodeTypes>(nodeTypes)

  // Only update ref if the object reference actually changed
  // This prevents React Flow warning about new nodeTypes object
  if (nodeTypesRef.current !== nodeTypes) {
    nodeTypesRef.current = nodeTypes
  }

  return nodeTypesRef.current
}

// Stable edge types memoization using ref for truly stable reference
export function useStableEdgeTypes(edgeTypes: EdgeTypes): EdgeTypes {
  const edgeTypesRef = useRef<EdgeTypes>(edgeTypes)

  // Only update ref if the object reference actually changed
  // This prevents React Flow warning about new edgeTypes object
  if (edgeTypesRef.current !== edgeTypes) {
    edgeTypesRef.current = edgeTypes
  }

  return edgeTypesRef.current
}

// Optimized nodes memoization with shallow comparison
export function useOptimizedNodes(nodes: Node[]): Node[] {
  const prevNodesRef = useRef<Node[]>([])

  return useMemo(() => {
    // Deep comparison for nodes array
    if (nodes.length !== prevNodesRef.current.length) {
      prevNodesRef.current = nodes
      return nodes
    }

    // Check for meaningful changes (ignore position during drag for performance)
    const hasChanged = nodes.some((node, index) => {
      const prevNode = prevNodesRef.current[index]
      if (!prevNode) return true

      return (
        node.id !== prevNode.id ||
        // Ignore selection changes - they cause excessive re-renders
        // node.selected !== prevNode.selected ||
        node.data?.type !== prevNode.data?.type ||
        node.data?.name !== prevNode.data?.name ||
        node.data?.isActive !== prevNode.data?.isActive ||
        node.data?.isPending !== prevNode.data?.isPending
      )
    })

    if (hasChanged) {
      prevNodesRef.current = nodes
      return nodes
    }

    return prevNodesRef.current
  }, [nodes])
}

// Optimized edges memoization with shallow comparison
export function useOptimizedEdges(edges: Edge[]): Edge[] {
  const prevEdgesRef = useRef<Edge[]>([])

  return useMemo(() => {
    // Deep comparison for edges array
    if (edges.length !== prevEdgesRef.current.length) {
      prevEdgesRef.current = edges
      return edges
    }

    // Check if any edge has actually changed — avoid JSON.stringify (expensive)
    const hasChanged = edges.some((edge, index) => {
      const prevEdge = prevEdgesRef.current[index]
      if (!prevEdge) return true

      return (
        edge.id !== prevEdge.id ||
        edge.source !== prevEdge.source ||
        edge.target !== prevEdge.target ||
        edge.sourceHandle !== prevEdge.sourceHandle ||
        edge.targetHandle !== prevEdge.targetHandle ||
        edge.selected !== prevEdge.selected ||
        edge.type !== prevEdge.type ||
        // Data fields that actually affect rendering
        edge.data?.isActive !== prevEdge.data?.isActive ||
        edge.data?.isCompleted !== prevEdge.data?.isCompleted ||
        edge.data?.hasError !== prevEdge.data?.hasError ||
        edge.data?.selectedEdgeId !== prevEdge.data?.selectedEdgeId ||
        edge.data?.highlightedEdgeIds !== prevEdge.data?.highlightedEdgeIds ||
        edge.data?.edgeStyle !== prevEdge.data?.edgeStyle ||
        edge.data?.animation !== prevEdge.data?.animation ||
        edge.data?.thickness !== prevEdge.data?.thickness ||
        edge.data?.color !== prevEdge.data?.color
      )
    })

    if (hasChanged) {
      prevEdgesRef.current = edges
      return edges
    }

    return prevEdgesRef.current
  }, [edges])
}

// Stable event handlers with proper dependencies
export function useStableEventHandlers(
  onNodesChange: any,
  onEdgesChange: any,
  onConnect: any,
  dependencies: any[] = []
) {
  const stableOnNodesChange = useCallback(onNodesChange, dependencies)
  const stableOnEdgesChange = useCallback(onEdgesChange, dependencies)
  const stableOnConnect = useCallback(onConnect, dependencies)

  return {
    onNodesChange: stableOnNodesChange,
    onEdgesChange: stableOnEdgesChange,
    onConnect: stableOnConnect,
  }
}

// Throttled updates for high-frequency operations
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 16 // ~60fps
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastExecution = useRef(0)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()

      if (now - lastExecution.current >= delay) {
        callback(...args)
        lastExecution.current = now
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(
          () => {
            callback(...args)
            lastExecution.current = Date.now()
          },
          delay - (now - lastExecution.current)
        )
      }
    }) as T,
    [callback, delay]
  )
}

// Debounced updates for expensive operations
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// Batched state updates for multiple changes
export function useBatchedUpdates() {
  const batchRef = useRef<(() => void)[]>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const addToBatch = useCallback((update: () => void) => {
    batchRef.current.push(update)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      const updates = batchRef.current.splice(0)
      updates.forEach((update) => update())
    }, 0) // Execute in next tick
  }, [])

  const flushBatch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      const updates = batchRef.current.splice(0)
      updates.forEach((update) => update())
    }
  }, [])

  return { addToBatch, flushBatch }
}

// Optimized selector for Zustand store
export function useShallowSelector<T, R>(selector: (state: T) => R, store: any): R {
  return store(useShallow(selector))
}

// Stable default props memoization
export function useStableDefaults<T>(defaults: T): T {
  return useMemo(() => defaults, [])
}

// Performance-optimized node data memoization
export function useNodeDataMemo(nodeData: any) {
  return useMemo(
    () => nodeData,
    [
      nodeData?.type,
      nodeData?.config?.id,
      nodeData?.name,
      nodeData?.isActive,
      nodeData?.isPending,
      // Add other specific fields that should trigger re-render
    ]
  )
}

// Performance-optimized edge data memoization
export function useEdgeDataMemo(edgeData: any) {
  return useMemo(
    () => edgeData,
    [
      edgeData?.selectedEdgeId,
      edgeData?.style,
      edgeData?.thickness,
      edgeData?.color,
      edgeData?.animation,
      edgeData?.label,
      edgeData?.source,
      edgeData?.target,
      // Add other specific fields that should trigger re-render
    ]
  )
}

// Viewport change optimization
export function useOptimizedViewport(viewport: any) {
  const prevViewportRef = useRef(viewport)

  return useMemo(() => {
    const hasSignificantChange =
      Math.abs(viewport.x - prevViewportRef.current.x) > 10 ||
      Math.abs(viewport.y - prevViewportRef.current.y) > 10 ||
      Math.abs(viewport.zoom - prevViewportRef.current.zoom) > 0.01

    if (hasSignificantChange) {
      prevViewportRef.current = viewport
      return viewport
    }

    return prevViewportRef.current
  }, [viewport.x, viewport.y, viewport.zoom])
}

// Stable ReactFlow props memoization
export function useStableReactFlowProps(props: any) {
  const {
    fitView,
    minZoom,
    maxZoom,
    panOnScroll,
    defaultEdgeOptions,
    proOptions,
    defaultViewport,
    snapGrid,
    connectionLineType,
    elementsSelectable,
    selectNodesOnDrag,
    nodesConnectable,
    nodesDraggable,
    draggable,
    noWheelClassName,
    edgesFocusable,
    edgesUpdatable,
    snapToGrid,
    elevateNodesOnSelect,
    elevateEdgesOnSelect,
    nodeDragThreshold,
    panOnDrag,
    zoomOnScroll,
    zoomOnPinch,
    zoomOnDoubleClick,
    deleteKeyCode,
    multiSelectionKeyCode,
    attributionPosition,
    onlyRenderVisibleElements,
    nodeOrigin,
    disableKeyboardA11y,
    preventScrolling,
    panOnScrollSpeed,
    zoomActivationKeyCode,
    selectionKeyCode,
    translateExtent,
  } = props

  return useMemo(
    () => ({
      fitView,
      minZoom,
      maxZoom,
      panOnScroll,
      defaultEdgeOptions,
      proOptions,
      defaultViewport,
      snapGrid,
      connectionLineType,
      elementsSelectable,
      selectNodesOnDrag,
      nodesConnectable,
      nodesDraggable,
      draggable,
      noWheelClassName,
      edgesFocusable,
      edgesUpdatable,
      snapToGrid,
      elevateNodesOnSelect,
      elevateEdgesOnSelect,
      nodeDragThreshold,
      panOnDrag,
      zoomOnScroll,
      zoomOnPinch,
      zoomOnDoubleClick,
      deleteKeyCode,
      multiSelectionKeyCode,
      attributionPosition,
      onlyRenderVisibleElements,
      nodeOrigin,
      disableKeyboardA11y,
      preventScrolling,
      panOnScrollSpeed,
      zoomActivationKeyCode,
      selectionKeyCode,
      translateExtent,
    }),
    [
      fitView,
      minZoom,
      maxZoom,
      panOnScroll,
      connectionLineType,
      elementsSelectable,
      selectNodesOnDrag,
      nodesConnectable,
      nodesDraggable,
      draggable,
      edgesFocusable,
      edgesUpdatable,
      snapToGrid,
      elevateNodesOnSelect,
      elevateEdgesOnSelect,
      nodeDragThreshold,
      panOnDrag,
      zoomOnScroll,
      zoomOnPinch,
      zoomOnDoubleClick,
      onlyRenderVisibleElements,
      disableKeyboardA11y,
      preventScrolling,
      panOnScrollSpeed,
    ]
  )
}
