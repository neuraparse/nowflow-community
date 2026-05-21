'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Hammer, Loader2, Network, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GraphStats {
  nodeCount: number
  edgeCount: number
  nodeTypes: Record<string, number>
  relationshipTypes: Record<string, number>
  avgDegree: number
}

interface GraphNode {
  id: string
  name: string
  type: string
  properties: Record<string, any>
  metadata: Record<string, any>
}

interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationship: string
  weight: number
  properties: Record<string, any>
}

const TYPE_COLORS: Record<string, string> = {
  person: '#3B82F6',
  organization: '#10B981',
  technology: '#8B5CF6',
  location: '#F59E0B',
  product: '#EC4899',
  event: '#06B6D4',
  concept: '#F97316',
}
const DEFAULT_COLOR = '#6B7280'

function getColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] || DEFAULT_COLOR
}

export function KnowledgeGraphViewer({ sourceId }: { sourceId: string }) {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [building, setBuilding] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge/${sourceId}/graph?action=stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sourceId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const searchGraph = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `/api/knowledge/${sourceId}/graph?action=query&q=${encodeURIComponent(query)}&maxNodes=30`
      )
      if (res.ok) {
        const data = await res.json()
        setGraphNodes(data.nodes || [])
        setGraphEdges(data.edges || [])
      }
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }

  const buildGraph = async () => {
    setBuilding(true)
    try {
      const res = await fetch(`/api/knowledge/${sourceId}/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build' }),
      })
      if (res.ok) await fetchStats()
    } catch {
      // ignore
    } finally {
      setBuilding(false)
    }
  }

  // Convert graph data to ReactFlow format with circular layout
  const { flowNodes, flowEdges } = useMemo(() => {
    const radius = Math.max(200, graphNodes.length * 30)
    const flowNodes: Node[] = graphNodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / graphNodes.length
      const color = getColor(n.type)
      return {
        id: n.id,
        position: { x: 400 + radius * Math.cos(angle), y: 300 + radius * Math.sin(angle) },
        data: { label: n.name, graphNode: n },
        style: {
          background: color,
          color: '#fff',
          border: `2px solid ${color}`,
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          maxWidth: 160,
          textAlign: 'center' as const,
        },
      }
    })

    const flowEdges: Edge[] = graphEdges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.relationship.replace(/_/g, ' '),
      animated: e.weight > 0.5,
      style: { stroke: '#94a3b8', strokeWidth: Math.max(1, e.weight * 3) },
      labelStyle: { fontSize: 10, fill: '#64748b' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#94a3b8' },
    }))

    return { flowNodes, flowEdges }
  }, [graphNodes, graphEdges])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const gn = graphNodes.find((n) => n.id === node.id)
      setSelectedNode(gn || null)
    },
    [graphNodes]
  )

  const topTypes = stats
    ? Object.entries(stats.nodeTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  if (loading) {
    return (
      <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-[#8B5CF6]" strokeWidth={1.5} />
          <h2 className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white">
            Knowledge Graph
          </h2>
          {stats && (
            <span className="text-[12px] font-logo text-zinc-400 dark:text-white/60">
              {stats.nodeCount} nodes / {stats.edgeCount} edges
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={buildGraph}
          disabled={building}
          className="font-logo text-[12px] h-8 rounded-lg border-black/[0.06] dark:border-white/[0.06]"
        >
          {building ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Hammer className="h-3.5 w-3.5 mr-2" />
          )}
          {building ? 'Building...' : 'Build Graph'}
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {/* Stats pills */}
        {stats && topTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topTypes.map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-logo font-medium text-white"
                style={{ backgroundColor: getColor(type) }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                {type} ({count})
              </span>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchGraph()}
              placeholder="Search entities..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30"
            />
          </div>
          <Button
            size="sm"
            onClick={searchGraph}
            disabled={searching || !query.trim()}
            className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-logo text-[12px] h-9 rounded-lg px-4"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Graph visualization */}
        {graphNodes.length > 0 ? (
          <div className="relative h-[420px] rounded-lg border border-black/[0.04] dark:border-white/[0.04] overflow-hidden bg-zinc-50 dark:bg-black/20">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodeClick={onNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
              minZoom={0.3}
              maxZoom={2}
            >
              <Background gap={20} size={1} />
              <Controls
                showInteractive={false}
                className="!bg-white dark:!bg-zinc-800 !border-black/[0.06] dark:!border-white/[0.06] !rounded-lg !shadow-sm"
              />
            </ReactFlow>

            {/* Node detail panel */}
            {selectedNode && (
              <div className="absolute top-3 right-3 w-56 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-zinc-900 p-3 shadow-lg z-10">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-logo font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: getColor(selectedNode.type) }}
                  >
                    {selectedNode.type}
                  </span>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white mb-2 break-words">
                  {selectedNode.name}
                </p>
                {Object.entries(selectedNode.properties).length > 0 && (
                  <div className="space-y-1 border-t border-black/[0.04] dark:border-white/[0.04] pt-2">
                    {Object.entries(selectedNode.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px] font-logo">
                        <span className="text-zinc-400">{k}</span>
                        <span className="text-zinc-600 dark:text-white/70">
                          {typeof v === 'number' ? v.toFixed(2) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : stats && stats.nodeCount === 0 ? (
          <div className="text-center py-12">
            <Network
              className="h-10 w-10 text-zinc-300 dark:text-white/20 mx-auto mb-3"
              strokeWidth={1}
            />
            <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60 mb-1">
              No graph data yet
            </p>
            <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
              Click &quot;Build Graph&quot; to extract entities and relationships
            </p>
          </div>
        ) : stats && stats.nodeCount > 0 && graphNodes.length === 0 ? (
          <div className="text-center py-10">
            <Search
              className="h-8 w-8 text-zinc-300 dark:text-white/20 mx-auto mb-3"
              strokeWidth={1}
            />
            <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60">
              Search for entities to visualize the graph
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
