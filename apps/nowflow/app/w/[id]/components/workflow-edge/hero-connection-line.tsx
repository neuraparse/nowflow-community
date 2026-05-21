'use client'

import React, { useMemo } from 'react'
import { getSmoothStepPath, useReactFlow } from '@xyflow/react'
import type { Position } from '@xyflow/react'
import { getBlock } from '@/blocks/registry'

interface HeroConnectionLineProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  fromPosition: Position
  toPosition: Position
  fromHandle?: any
  fromNode?: any
}

// HERO-EDGE MANTIK - AYNI RENKLENDİRME SİSTEMİ
export function HeroConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode,
}: HeroConnectionLineProps) {
  // ReactFlow'dan node bilgisini al
  const { getNode } = useReactFlow()
  const sourceNode = fromNode?.id ? getNode(fromNode.id) : null

  // Node type'ı al
  const sourceType = String((sourceNode?.data as any)?.type ?? 'default')

  // Get edge color from source block's config.bgColor - memoized
  const edgeColor = useMemo(() => {
    const blockConfig = getBlock(sourceType)
    return blockConfig?.bgColor || '#8B5CF6' // Fallback to violet
  }, [sourceType])

  // HERO-EDGE İLE AYNI PATH SİSTEMİ
  const [connectionPath] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })

  return (
    <g>
      {/* HERO-EDGE İLE AYNI ARROW MARKER */}
      <defs>
        <marker
          id="hero-connection-arrow"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
      </defs>

      {/* HERO-EDGE İLE AYNI ÇİZGİ STİLİ - DÜZ, RENKLİ, UCUNDA OK */}
      <path
        d={connectionPath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={3}
        strokeDasharray="none"
        markerEnd="url(#hero-connection-arrow)"
        className="react-flow__connection-path"
      />

      {/* Endpoint indicator */}
      <circle cx={toX} cy={toY} r={4} fill={edgeColor} stroke="white" strokeWidth={2} />
    </g>
  )
}
