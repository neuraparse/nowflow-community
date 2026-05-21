'use client'

import React, { useMemo, useState } from 'react'
import { type Edge, type EdgeProps, getSmoothStepPath, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks/registry'
import { EdgeInteractions } from './interactions/edge-interactions'

// Ultra-Modern Hero Edge - Smooth Step & Minimal
type HeroEdgeData = Record<string, unknown> & {
  onDelete?: (edgeId: string) => void
  isActive?: boolean
  isCompleted?: boolean
  hasError?: boolean
}

type HeroEdgeType = Edge<HeroEdgeData, string>

export function HeroEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  style = {},
  markerEnd,
  data,
}: EdgeProps<HeroEdgeType>) {
  // State management
  const [showHoverArea, setShowHoverArea] = useState(false)
  const [hoverAreaWidth, setHoverAreaWidth] = useState(50)
  const [internalIsHovered, setInternalIsHovered] = useState(false)

  // Targeted selectors — only re-render when THIS edge's source/target block type changes.
  // Replaces: full blocks + full edges store subscriptions + O(n) edges.find().
  const sourceType = useWorkflowStore((state) => state.blocks[source]?.type ?? 'default')
  const targetType = useWorkflowStore((state) => state.blocks[target]?.type ?? 'default')
  const isHighlighted = useWorkflowStore((state) => state.highlightedEdgeIds.includes(id))

  // Detect utility edges — dashed style when either endpoint is a utility helper block
  const sourceBlockConfig = getBlock(sourceType)
  const targetBlockConfig = getBlock(targetType)
  const isUtilityEdge =
    sourceBlockConfig?.isUtility === true || targetBlockConfig?.isUtility === true

  // Detect utility-slot connections via handle IDs from ReactFlow props (no store lookup)
  const isUtilitySlotEdge =
    sourceHandleId === 'utility-source' || targetHandleId === 'utility-target'

  // ── Signal Odyssey: per-source-type edge classification ───────────────────
  const isStarterSource = sourceType === 'starter'
  const isAgentSource = sourceBlockConfig?.category === 'agents'
  const isConditionSource = sourceType === 'condition' || sourceType === 'router'
  const isToolSource = sourceBlockConfig?.category === 'tools'

  // Execution states from data
  const isActive = data?.isActive || false
  const isCompleted = data?.isCompleted || false
  const hasError = data?.hasError || false

  // Subtle Edge Color System - Clean and Modern
  const edgeColor = useMemo(() => {
    // Priority: error > active > completed > highlighted > source block color
    if (hasError) return '#ef4444' // Red
    if (isActive) return '#3b82f6' // Blue
    if (isCompleted) return '#22c55e' // Green
    if (isHighlighted) return '#8b5cf6' // Purple
    // Vertical utility-slot connections always use purple
    if (isUtilitySlotEdge) return '#a855f7'

    // Use source block color; fall back to subtle slate for utility edges
    return sourceBlockConfig?.bgColor || '#94a3b8'
  }, [sourceBlockConfig, isHighlighted, isActive, isCompleted, hasError, isUtilitySlotEdge])

  // ── Signal Odyssey: per-source-type stroke width ───────────────────────────
  const strokeWidth = useMemo(() => {
    if (hasError || isActive) return 2.5
    if (isHighlighted || internalIsHovered) return 2.5
    // Per-source-type base width
    if (isStarterSource || isAgentSource) return 2.5 // Bold command/launch signals
    if (isConditionSource || isUtilityEdge) return 1.5 // Thinner split/helper channels
    return 2 // Process, Tool — standard relay
  }, [
    isHighlighted,
    internalIsHovered,
    hasError,
    isActive,
    isStarterSource,
    isAgentSource,
    isConditionSource,
    isUtilityEdge,
  ])

  // Path routing: smooth step for all connections (utility slot connections also use step style)
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (isUtilitySlotEdge) {
      // Stepped orthogonal path: utility block (below) → host block (above)
      // sourcePosition=Top exits upward from utility block's top handle
      // targetPosition=Bottom enters from below into host block's bottom handle
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition: Position.Top,
        targetX,
        targetY,
        targetPosition: Position.Bottom,
        borderRadius: 8,
        offset: 16,
      })
    }
    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
      offset: 20,
    })
  }, [isUtilitySlotEdge, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition])

  // ── Signal Odyssey: per-source-type opacity ────────────────────────────────
  const edgeOpacity = useMemo(() => {
    if (hasError || isActive || isCompleted) return 1
    if (isHighlighted || internalIsHovered) return 0.9
    // Per-source-type base opacity
    if (isStarterSource) return 0.85 // Strong launch pulse
    if (isAgentSource) return 0.8 // Authoritative command
    if (isConditionSource) return 0.75 // Split channels
    if (isToolSource) return 0.65 // External data transfer
    if (isUtilityEdge) return 0.6 // Background helper
    return 0.7 // Process default
  }, [
    isHighlighted,
    internalIsHovered,
    hasError,
    isActive,
    isCompleted,
    isStarterSource,
    isAgentSource,
    isConditionSource,
    isToolSource,
    isUtilityEdge,
  ])

  // ── Signal Odyssey: per-source-type arrow marker size ───────────────────────
  const arrowMarkerId = `hero-arrow-${id}`
  const markerSize = useMemo(() => {
    if (isStarterSource) return 4.5 // Bold launch signal
    if (isConditionSource) return 3.5 // Thinner split channels
    if (isUtilityEdge) return 2.5 // Small helper signal
    return 4 // Agent, Process, Tool — standard
  }, [isStarterSource, isConditionSource, isUtilityEdge])

  // Shadow/Glow effect - Subtle and modern
  const shadowFilter = useMemo(() => {
    if (hasError) return `drop-shadow(0 0 8px ${edgeColor}AA) drop-shadow(0 0 16px ${edgeColor}70)`
    if (isActive) return `drop-shadow(0 0 10px ${edgeColor}90) drop-shadow(0 0 20px ${edgeColor}60)`
    if (isCompleted) return `drop-shadow(0 0 6px ${edgeColor}80)`
    if (isHighlighted || internalIsHovered)
      return `drop-shadow(0 0 4px ${edgeColor}70) drop-shadow(0 0 8px ${edgeColor}50)`
    return `drop-shadow(0 0 2px ${edgeColor}30)` // Subtle shadow in default state
  }, [edgeColor, hasError, isActive, isCompleted, isHighlighted, internalIsHovered])

  // Get delete function from data
  const onDelete = data?.onDelete

  return (
    <>
      {/* Modern Gradient & Arrow Definitions */}
      <defs>
        {/* Sharp Modern Arrow Marker */}
        <marker
          id={arrowMarkerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={markerSize}
          markerHeight={markerSize}
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={edgeColor}
            fillOpacity={edgeOpacity}
            className="transition-all duration-300"
          />
        </marker>

        {/* Gradient for highlighted state */}
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={edgeColor} stopOpacity={edgeOpacity * 0.5} />
          <stop offset="50%" stopColor={edgeColor} stopOpacity={edgeOpacity} />
          <stop offset="100%" stopColor={edgeColor} stopOpacity={edgeOpacity * 0.5} />
        </linearGradient>
      </defs>

      {/* Visual hover area (optional debug) */}
      {showHoverArea && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(255,0,0,0.15)"
          strokeWidth={hoverAreaWidth}
          pointerEvents="none"
        />
      )}

      {/* INVISIBLE HOVER PATH - Reasonable hover area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={80}
        pointerEvents="stroke"
        className="cursor-pointer"
        onMouseEnter={() => setInternalIsHovered(true)}
        onMouseLeave={() => setInternalIsHovered(false)}
      />

      {/* Background Glow Layer - Subtle depth effect */}
      {(isHighlighted || internalIsHovered || isActive || hasError) && (
        <motion.path
          d={edgePath as any}
          fill="none"
          stroke={edgeColor as any}
          strokeWidth={strokeWidth + 8}
          strokeOpacity={0.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ strokeOpacity: 0 }}
          animate={{ strokeOpacity: 0.15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="pointer-events-none"
        />
      )}

      {/* Main Edge Path - Clean Stepped Lines */}
      {/* id is used by animateMotion <mpath> for the active particle animation */}
      <motion.path
        id={`edge-path-main-${id}`}
        d={edgePath as any}
        fill="none"
        stroke={(isHighlighted ? `url(#gradient-${id})` : edgeColor) as any}
        strokeWidth={strokeWidth as any}
        strokeOpacity={
          (isUtilitySlotEdge
            ? edgeOpacity * 0.85
            : isUtilityEdge
              ? edgeOpacity * 0.75
              : edgeOpacity) as any
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={
          isActive
            ? undefined
            : isUtilitySlotEdge
              ? '4 3'
              : isUtilityEdge
                ? '6 4'
                : isToolSource
                  ? '3 3'
                  : undefined
        }
        style={{
          filter: shadowFilter as any,
        }}
        initial={false}
        animate={{
          strokeWidth,
          strokeOpacity: isUtilitySlotEdge
            ? edgeOpacity * 0.85
            : isUtilityEdge
              ? edgeOpacity * 0.75
              : edgeOpacity,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
        markerEnd={`url(#${arrowMarkerId})` as any}
        className="transition-all duration-300"
      />

      {/* Active Pulse Animation — animateMotion particles (no stroke-dasharray CPU cost) */}
      {isActive && (
        <>
          {/* 4 particles traveling along the edge path via SVG animateMotion */}
          {([0, 1, 2, 3] as const).map((i) => (
            <circle
              key={i}
              r={2.5}
              fill={edgeColor}
              fillOpacity={0.8}
              className="pointer-events-none"
            >
              <animateMotion
                dur="1.4s"
                repeatCount="indefinite"
                begin={`${i * 0.35}s`}
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.4 0 0.6 1"
              >
                <mpath href={`#edge-path-main-${id}`} />
              </animateMotion>
            </circle>
          ))}

          {/* Pulsing glow on the path */}
          <motion.path
            d={edgePath as any}
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={strokeWidth + 2}
            strokeOpacity={0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ strokeOpacity: 0.3 }}
            animate={{ strokeOpacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="pointer-events-none"
          />
        </>
      )}

      {/* Completed Checkmark Effect */}
      {isCompleted && (
        <g>
          {/* Circle background */}
          <motion.circle
            cx={labelX as any}
            cy={labelY as any}
            r={10 as any}
            fill={edgeColor as any}
            fillOpacity={0.15}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'backOut' }}
            className="pointer-events-none"
          />
          {/* Checkmark circle border */}
          <motion.circle
            cx={labelX as any}
            cy={labelY as any}
            r={10 as any}
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={2}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'backOut', delay: 0.1 }}
            className="pointer-events-none"
          />
          {/* Checkmark icon */}
          <motion.path
            d={
              `M ${labelX - 4} ${labelY} L ${labelX - 1} ${labelY + 3} L ${labelX + 4} ${labelY - 3}` as any
            }
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
            className="pointer-events-none"
          />
        </g>
      )}

      {/* Error X Mark Effect */}
      {hasError && (
        <g>
          {/* Circle background */}
          <motion.circle
            cx={labelX as any}
            cy={labelY as any}
            r={10 as any}
            fill={edgeColor as any}
            fillOpacity={0.15}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'backOut' }}
            className="pointer-events-none"
          />
          {/* Error circle border */}
          <motion.circle
            cx={labelX as any}
            cy={labelY as any}
            r={10 as any}
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={2}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'backOut', delay: 0.1 }}
            className="pointer-events-none"
          />
          {/* X mark - line 1 */}
          <motion.path
            d={`M ${labelX - 4} ${labelY - 4} L ${labelX + 4} ${labelY + 4}` as any}
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
            className="pointer-events-none"
          />
          {/* X mark - line 2 */}
          <motion.path
            d={`M ${labelX + 4} ${labelY - 4} L ${labelX - 4} ${labelY + 4}` as any}
            fill="none"
            stroke={edgeColor as any}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.3 }}
            className="pointer-events-none"
          />
        </g>
      )}

      {/* Interactive toolbar */}
      <EdgeInteractions
        edgeId={id}
        edgePath={edgePath}
        labelX={labelX}
        labelY={labelY}
        showToolbar={true}
        onDelete={() => onDelete?.(id)}
        enableHaptics={false}
        showHoverArea={showHoverArea}
        hoverAreaWidth={hoverAreaWidth}
        onToggleHoverArea={() => setShowHoverArea(!showHoverArea)}
        onHoverAreaWidthChange={setHoverAreaWidth}
        isHovered={internalIsHovered}
      />
    </>
  )
}
