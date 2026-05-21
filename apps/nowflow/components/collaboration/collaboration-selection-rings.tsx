'use client'

import { useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'

interface SelectionEntry {
  userId: string
  name: string
  color: string
  selectedNodes: string[]
}

interface CollaborationSelectionRingsProps {
  selections: SelectionEntry[]
}

export function CollaborationSelectionRings({ selections }: CollaborationSelectionRingsProps) {
  const { getNodes, getViewport } = useReactFlow()
  const [viewport, setViewport] = useState(getViewport())

  // Track viewport for position updates
  useEffect(() => {
    const interval = setInterval(() => {
      setViewport(getViewport())
    }, 16)
    return () => clearInterval(interval)
  }, [getViewport])

  const nodes = getNodes()

  // Build a map: nodeId -> list of users selecting it
  const nodeSelectors = new Map<string, { color: string; name: string }[]>()
  for (const sel of selections) {
    for (const nodeId of sel.selectedNodes) {
      const existing = nodeSelectors.get(nodeId) ?? []
      existing.push({ color: sel.color, name: sel.name })
      nodeSelectors.set(nodeId, existing)
    }
  }

  if (nodeSelectors.size === 0) return null

  const { x: vx, y: vy, zoom } = viewport

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {Array.from(nodeSelectors.entries()).map(([nodeId, selectors]) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node || !node.measured?.width || !node.measured?.height) return null

        const primarySelector = selectors[0]
        const screenX = node.position.x * zoom + vx
        const screenY = node.position.y * zoom + vy
        const width = node.measured.width * zoom
        const height = node.measured.height * zoom

        return (
          <div
            key={nodeId}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${screenX - 4}px, ${screenY - 4}px)`,
              width: width + 8,
              height: height + 8,
              borderRadius: 8,
              border: `1px solid ${primarySelector.color}`,
              boxShadow: 'none',
              transition: 'transform 100ms ease-out, width 100ms, height 100ms',
              pointerEvents: 'none',
            }}
          >
            {/* User name tag on the ring */}
            <div className="absolute -top-5 left-1 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              {selectors.map((s) => s.name).join(', ')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
