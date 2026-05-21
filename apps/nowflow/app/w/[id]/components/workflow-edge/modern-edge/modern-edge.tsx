'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'
import { motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import type {
  EdgeAnimation,
  EdgeColor,
  EdgeStyle,
  EdgeThickness,
} from '@/stores/workflows/workflow/types'
import { EdgeInteractions } from '../interactions/edge-interactions'
import { enableGPUAcceleration } from '../performance/edge-performance'
import { getEdgeStyleProps, ModernEdgeStyles } from '../styling/modern-edge-styles'
import { SVGAnimations } from '../svg-animations/svg-animations'

// Stable transition config — defined outside the component to avoid recreation on every render
const MOTION_TRANSITION = {
  stroke: { duration: 0.3, ease: 'easeOut' },
  strokeWidth: { duration: 0.3, ease: 'easeOut' },
  strokeOpacity: { duration: 0.3, ease: 'easeOut' },
  filter: { duration: 0.3, ease: 'easeOut' },
} as const

export interface ModernEdgeProps extends EdgeProps {
  data?: {
    selectedEdgeId?: string
    edgeStyle?: EdgeStyle | 'gradient' | 'glassmorphism' | 'neon'
    thickness?: EdgeThickness
    color?: EdgeColor
    animation?: EdgeAnimation | 'particles' | 'glow' | 'morphing'
    label?: string
    highlightedEdgeIds?: string[]
    isActive?: boolean
    isCompleted?: boolean
    hasError?: boolean
    onDelete?: (edgeId: string) => void
    onEdit?: (edgeId: string) => void
    onCopy?: (edgeId: string, settings: any) => void
    onToggleAnimation?: (edgeId: string, newAnimation: string) => void
    onSettings?: (edgeId: string, currentSettings: any) => void
  }
}

export const ModernEdge = React.memo(function ModernEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data = {},
}: ModernEdgeProps) {
  const {
    selectedEdgeId,
    edgeStyle: style = 'solid',
    thickness = 'medium',
    color = 'default',
    animation = 'none', // No animation by default for subtle appearance
    label = '',
    highlightedEdgeIds = [],
    isActive = false,
    isCompleted = false,
    hasError = false,
    onDelete,
  } = data

  const edgeRef = useRef<SVGPathElement>(null)
  const controls = useAnimation()
  const [isSelected, setIsSelected] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Calculate smooth bezier path for modern curves
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25, // Smooth modern curves
  })

  // Determine if edge is selected or highlighted
  const isEdgeSelected = id === selectedEdgeId
  const isHighlighted = highlightedEdgeIds.includes(id)

  // Performance monitoring removed — running on every render caused unnecessary work

  // GPU acceleration for edge element
  useEffect(() => {
    if (edgeRef.current) {
      enableGPUAcceleration(edgeRef.current)
    }
  }, [])

  // Memoized edge color calculation for performance
  const getEdgeColor = useMemo(() => {
    // Priority order: error > completed > active > selected > highlighted > default
    if (hasError) return '#ef4444' // Red for errors
    if (isCompleted) return '#22c55e' // Green for completed
    if (isActive) return '#3b82f6' // Blue for active
    if (isEdgeSelected) return '#8b5cf6' // Purple for selected
    if (isHighlighted) return '#6366f1' // Indigo for highlighted
    if (isHovered) return '#6366f1' // Indigo for hover

    // Visible default colors - always visible
    const colorMap: Record<string, string> = {
      default: '#94a3b8', // Medium gray - always visible
      blue: '#94a3b8',
      green: '#94a3b8',
      red: '#94a3b8',
      yellow: '#94a3b8',
      purple: '#94a3b8',
      orange: '#94a3b8',
      teal: '#94a3b8',
      pink: '#94a3b8',
      indigo: '#94a3b8',
    }
    return colorMap[color] ?? colorMap.default
  }, [color, isEdgeSelected, isHighlighted, isHovered, isActive, isCompleted, hasError])

  // Subtle stroke width with smooth hover enhancement
  const getStrokeWidth = useMemo(() => {
    // Much thinner default widths for subtle appearance
    const baseWidth = {
      thin: 1,
      medium: 1.5,
      thick: 2,
      'extra-thick': 2.5,
    }[thickness]

    // Significant increase on hover/selection for clear feedback
    if (isSelected) return baseWidth + 2
    if (isHighlighted) return baseWidth + 1.5
    if (isHovered) return baseWidth + 1
    return baseWidth
  }, [thickness, isSelected, isHighlighted, isHovered])

  // Modern stroke dash array
  const getStrokeDashArray = useMemo(() => {
    switch (style) {
      case 'dashed':
        return '8,4'
      case 'dotted':
        return '2,3'
      case 'double':
        return 'none'
      default:
        return 'none'
    }
  }, [style])

  // Modern gradient definition
  const gradientId = `gradient-${id}`
  const gradientDef = useMemo(() => {
    if (style !== 'gradient') return null

    return (
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={getEdgeColor} stopOpacity="0.3" />
          <stop offset="50%" stopColor={getEdgeColor} stopOpacity="1" />
          <stop offset="100%" stopColor={getEdgeColor} stopOpacity="0.3" />
        </linearGradient>
      </defs>
    )
  }, [style, gradientId, getEdgeColor])

  // Animation effects
  useEffect(() => {
    if (animation === 'none') return

    const animationConfigs = {
      flow: {
        strokeDasharray: [0, 20],
        strokeDashoffset: [0, -20],
        transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
      },
      pulse: {
        strokeWidth: [getStrokeWidth, getStrokeWidth * 1.5, getStrokeWidth],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      },
      glow: {
        filter: [
          'drop-shadow(0 0 2px currentColor)',
          'drop-shadow(0 0 8px currentColor)',
          'drop-shadow(0 0 2px currentColor)',
        ],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      },
    }

    const config = animationConfigs[animation as keyof typeof animationConfigs]
    if (config) {
      controls.start(config)
    }
  }, [animation, controls, getStrokeWidth])

  // Subtle shadow and glow effects
  const getShadowFilter = useMemo(() => {
    if (isSelected) {
      return `drop-shadow(0 0 6px ${getEdgeColor}60) drop-shadow(0 0 12px ${getEdgeColor}30)`
    }
    if (isHighlighted || isHovered) {
      return `drop-shadow(0 0 3px ${getEdgeColor}40)`
    }
    return 'none'
  }, [isSelected, isHighlighted, isHovered, getEdgeColor])

  // Opacity - always visible, no change on hover
  const getOpacity = useMemo(() => {
    return 1 // Always fully visible
  }, [])

  // Stable callback references for EdgeInteractions
  const handleEdit = useCallback(() => data.onEdit?.(id), [data.onEdit, id])
  const handleDelete = useCallback(() => onDelete?.(id), [onDelete, id])
  const handleCopy = useCallback(() => {
    data.onCopy?.(id, { style, thickness, color, animation })
  }, [data.onCopy, id, style, thickness, color, animation])
  const handleToggleAnimation = useCallback(() => {
    const newAnimation = animation === 'none' ? 'flow' : 'none'
    data.onToggleAnimation?.(id, newAnimation)
  }, [data.onToggleAnimation, id, animation])
  const handleSettings = useCallback(() => {
    data.onSettings?.(id, { style, thickness, color, animation })
  }, [data.onSettings, id, style, thickness, color, animation])

  // Get modern style properties
  const styleProps = getEdgeStyleProps({
    edgeId: id,
    color,
    isSelected: isEdgeSelected,
    isHighlighted,
    isActive,
    isCompleted,
    hasError,
    style,
    thickness,
  })

  return (
    <g>
      {/* Modern edge styles and filters */}
      <ModernEdgeStyles
        edgeId={id}
        color={color}
        isSelected={isEdgeSelected}
        isHighlighted={isHighlighted}
        isActive={isActive}
        isCompleted={isCompleted}
        hasError={hasError}
        style={
          [
            'solid',
            'dashed',
            'dotted',
            'gradient',
            'glassmorphism',
            'neon',
            'double',
            'wavy',
          ].includes(style)
            ? (style as any)
            : 'solid'
        }
        thickness={thickness}
      />

      {/* Main edge path with subtle default and smooth hover enhancement */}
      <motion.path
        ref={edgeRef}
        d={edgePath as any}
        fill="none"
        stroke={getEdgeColor as any}
        strokeWidth={getStrokeWidth as any}
        strokeOpacity={getOpacity as any}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={getStrokeDashArray as any}
        style={{
          filter: getShadowFilter as any,
        }}
        animate={controls as any}
        transition={MOTION_TRANSITION}
      />

      {/* Advanced SVG animations */}
      <SVGAnimations
        edgePath={edgePath}
        edgeId={id}
        isActive={isActive}
        isCompleted={isCompleted}
        hasError={hasError}
        animationType={animation as any}
        color={color}
        intensity="medium"
      />

      {/* Interactive edge features */}
      <EdgeInteractions
        edgeId={id}
        edgePath={edgePath}
        labelX={labelX}
        labelY={labelY}
        isSelected={isEdgeSelected}
        showToolbar={true}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onToggleAnimation={handleToggleAnimation}
        onSettings={handleSettings}
        label={label}
        enableHaptics={true}
      />
    </g>
  )
})
