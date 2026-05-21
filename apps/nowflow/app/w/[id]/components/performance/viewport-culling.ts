// 2025 Modern Viewport Culling for ReactFlow Performance Optimization
import { Edge, Node, Viewport } from '@xyflow/react'

export interface ViewportBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface CullingConfig {
  enabled: boolean
  margin: number // Extra margin around viewport for smooth transitions
  nodeWidth: number // Approximate node width for calculations
  nodeHeight: number // Approximate node height for calculations
  enableLOD: boolean // Level of Detail optimization
  lodThreshold: number // Zoom level threshold for LOD
}

export const defaultCullingConfig: CullingConfig = {
  enabled: true,
  margin: 200, // 200px margin for smooth scrolling
  nodeWidth: 200,
  nodeHeight: 100,
  enableLOD: true,
  lodThreshold: 0.5, // Below 50% zoom, use simplified rendering
}

// Calculate viewport bounds from ReactFlow viewport
export function calculateViewportBounds(
  viewport: Viewport,
  containerSize: { width: number; height: number },
  margin = 200
): ViewportBounds {
  const { x, y, zoom } = viewport
  const { width, height } = containerSize

  return {
    left: -x / zoom - margin,
    right: (-x + width) / zoom + margin,
    top: -y / zoom - margin,
    bottom: (-y + height) / zoom + margin,
  }
}

// Check if a node is visible in the viewport
export function isNodeVisible(node: Node, bounds: ViewportBounds, config: CullingConfig): boolean {
  if (!config.enabled) return true

  const nodeLeft = node.position.x
  const nodeRight = node.position.x + config.nodeWidth
  const nodeTop = node.position.y
  const nodeBottom = node.position.y + config.nodeHeight

  return !(
    nodeRight < bounds.left ||
    nodeLeft > bounds.right ||
    nodeBottom < bounds.top ||
    nodeTop > bounds.bottom
  )
}

// Check if an edge is visible in the viewport
export function isEdgeVisible(
  edge: Edge,
  nodes: Node[],
  bounds: ViewportBounds,
  config: CullingConfig
): boolean {
  if (!config.enabled) return true

  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)

  if (!sourceNode || !targetNode) return false

  // Check if either node is visible
  const sourceVisible = isNodeVisible(sourceNode, bounds, config)
  const targetVisible = isNodeVisible(targetNode, bounds, config)

  // If either node is visible, show the edge
  if (sourceVisible || targetVisible) return true

  // Check if edge path crosses the viewport
  const minX = Math.min(sourceNode.position.x, targetNode.position.x)
  const maxX = Math.max(sourceNode.position.x, targetNode.position.x)
  const minY = Math.min(sourceNode.position.y, targetNode.position.y)
  const maxY = Math.max(sourceNode.position.y, targetNode.position.y)

  return !(maxX < bounds.left || minX > bounds.right || maxY < bounds.top || minY > bounds.bottom)
}

// Filter visible nodes with viewport culling
export function cullNodes(
  nodes: Node[],
  viewport: Viewport,
  containerSize: { width: number; height: number },
  config: CullingConfig = defaultCullingConfig
): Node[] {
  if (!config.enabled) return nodes

  const bounds = calculateViewportBounds(viewport, containerSize, config.margin)

  return nodes.filter((node) => isNodeVisible(node, bounds, config))
}

// Filter visible edges with viewport culling
export function cullEdges(
  edges: Edge[],
  nodes: Node[],
  viewport: Viewport,
  containerSize: { width: number; height: number },
  config: CullingConfig = defaultCullingConfig
): Edge[] {
  if (!config.enabled) return edges

  const bounds = calculateViewportBounds(viewport, containerSize, config.margin)

  return edges.filter((edge) => isEdgeVisible(edge, nodes, bounds, config))
}

// Level of Detail (LOD) optimization
export function applyLOD(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
  config: CullingConfig
): { nodes: Node[]; edges: Edge[] } {
  if (!config.enableLOD) return { nodes, edges }

  const isLowDetail = viewport.zoom < config.lodThreshold

  if (isLowDetail) {
    // Simplify nodes for low zoom levels
    const simplifiedNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        simplified: true, // Flag for simplified rendering
      },
    }))

    // Reduce edge complexity
    const simplifiedEdges = edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        simplified: true,
        animation: 'none', // Disable animations at low zoom
      },
    }))

    return { nodes: simplifiedNodes, edges: simplifiedEdges }
  }

  return { nodes, edges }
}

// Performance-optimized culling with caching
export class ViewportCuller {
  private cache = new Map<string, boolean>()
  private lastViewport: Viewport | null = null
  private cacheTimeout = 100 // ms

  constructor(private config: CullingConfig = defaultCullingConfig) {}

  private getCacheKey(id: string, viewport: Viewport, type: 'node' | 'edge'): string {
    const roundedX = Math.round(viewport.x / 10) * 10
    const roundedY = Math.round(viewport.y / 10) * 10
    const roundedZoom = Math.round(viewport.zoom * 10) / 10

    return `${type}-${id}-${roundedX}-${roundedY}-${roundedZoom}`
  }

  private shouldUpdateCache(viewport: Viewport): boolean {
    if (!this.lastViewport) return true

    const deltaX = Math.abs(viewport.x - this.lastViewport.x)
    const deltaY = Math.abs(viewport.y - this.lastViewport.y)
    const deltaZoom = Math.abs(viewport.zoom - this.lastViewport.zoom)

    // Update cache if viewport changed significantly
    return deltaX > 50 || deltaY > 50 || deltaZoom > 0.1
  }

  cullNodesWithCache(
    nodes: Node[],
    viewport: Viewport,
    containerSize: { width: number; height: number }
  ): Node[] {
    if (!this.config.enabled) return nodes

    if (this.shouldUpdateCache(viewport)) {
      this.cache.clear()
      this.lastViewport = viewport
    }

    const bounds = calculateViewportBounds(viewport, containerSize, this.config.margin)

    return nodes.filter((node) => {
      const cacheKey = this.getCacheKey(node.id, viewport, 'node')

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const isVisible = isNodeVisible(node, bounds, this.config)
      this.cache.set(cacheKey, isVisible)

      return isVisible
    })
  }

  cullEdgesWithCache(
    edges: Edge[],
    nodes: Node[],
    viewport: Viewport,
    containerSize: { width: number; height: number }
  ): Edge[] {
    if (!this.config.enabled) return edges

    const bounds = calculateViewportBounds(viewport, containerSize, this.config.margin)

    return edges.filter((edge) => {
      const cacheKey = this.getCacheKey(edge.id, viewport, 'edge')

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)
      }

      const isVisible = isEdgeVisible(edge, nodes, bounds, this.config)
      this.cache.set(cacheKey, isVisible)

      return isVisible
    })
  }

  clearCache(): void {
    this.cache.clear()
    this.lastViewport = null
  }

  updateConfig(config: Partial<CullingConfig>): void {
    this.config = { ...this.config, ...config }
    this.clearCache()
  }
}

// Singleton instance for global use
export const globalViewportCuller = new ViewportCuller()

// Hook for easy integration with React components
export function useViewportCulling(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
  containerSize: { width: number; height: number },
  config?: Partial<CullingConfig>
) {
  if (config) {
    globalViewportCuller.updateConfig(config)
  }

  const culledNodes = globalViewportCuller.cullNodesWithCache(nodes, viewport, containerSize)

  const culledEdges = globalViewportCuller.cullEdgesWithCache(edges, nodes, viewport, containerSize)

  // Apply LOD if enabled
  const { nodes: lodNodes, edges: lodEdges } = applyLOD(
    culledNodes,
    culledEdges,
    viewport,
    globalViewportCuller['config']
  )

  return {
    nodes: lodNodes,
    edges: lodEdges,
    stats: {
      originalNodes: nodes.length,
      visibleNodes: lodNodes.length,
      originalEdges: edges.length,
      visibleEdges: lodEdges.length,
      cullingRatio: {
        nodes: (nodes.length - lodNodes.length) / nodes.length,
        edges: (edges.length - lodEdges.length) / edges.length,
      },
    },
  }
}
