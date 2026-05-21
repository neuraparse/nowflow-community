'use client'

import React from 'react'

export interface ModernEdgeStyleProps {
  edgeId: string
  color: string
  isSelected?: boolean
  isHighlighted?: boolean
  isActive?: boolean
  isCompleted?: boolean
  hasError?: boolean
  style?: 'solid' | 'dashed' | 'dotted' | 'gradient' | 'glassmorphism' | 'neon' | 'double' | 'wavy'
  thickness?: 'thin' | 'medium' | 'thick' | 'extra-thick'
}

export function ModernEdgeStyles({
  edgeId,
  color,
  isSelected = false,
  isHighlighted = false,
  isActive = false,
  isCompleted = false,
  hasError = false,
  style = 'solid',
  thickness = 'medium',
}: ModernEdgeStyleProps) {
  // Generate unique IDs for gradients and filters
  const gradientId = `gradient-${edgeId}`
  const glowId = `glow-${edgeId}`
  const neonId = `neon-${edgeId}`
  const glassmorphismId = `glassmorphism-${edgeId}`

  // Dynamic color based on state
  const getStateColor = () => {
    if (hasError) return '#ef4444'
    if (isCompleted) return '#22c55e'
    if (isActive) return '#3b82f6'
    if (isSelected) return '#8b5cf6'
    if (isHighlighted) return '#6366f1'
    return color
  }

  const stateColor = getStateColor()

  return (
    <defs>
      {/* Modern Gradient Definitions */}
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={stateColor} stopOpacity="0.3" />
        <stop offset="50%" stopColor={stateColor} stopOpacity="1" />
        <stop offset="100%" stopColor={stateColor} stopOpacity="0.3" />
      </linearGradient>

      {/* Animated Gradient for Flow Effect */}
      <linearGradient id={`${gradientId}-animated`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={stateColor} stopOpacity="0">
          <animate attributeName="stop-opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
        </stop>
        <stop offset="50%" stopColor={stateColor} stopOpacity="1">
          <animate
            attributeName="stop-opacity"
            values="0;1;0"
            dur="2s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </stop>
        <stop offset="100%" stopColor={stateColor} stopOpacity="0">
          <animate
            attributeName="stop-opacity"
            values="0;1;0"
            dur="2s"
            repeatCount="indefinite"
            begin="1s"
          />
        </stop>
      </linearGradient>

      {/* Glassmorphism Gradient */}
      <linearGradient id={glassmorphismId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
        <stop offset="50%" stopColor={stateColor} stopOpacity="0.8" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </linearGradient>

      {/* Radial Gradient for Glow Effects */}
      <radialGradient id={`${gradientId}-radial`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={stateColor} stopOpacity="1" />
        <stop offset="70%" stopColor={stateColor} stopOpacity="0.6" />
        <stop offset="100%" stopColor={stateColor} stopOpacity="0" />
      </radialGradient>

      {/* Modern Glow Filter */}
      <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Enhanced Glow for Selected/Active States */}
      <filter id={`${glowId}-enhanced`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="6" result="coloredBlur" />
        <feOffset in="coloredBlur" dx="0" dy="0" result="offsetBlur" />
        <feFlood floodColor={stateColor} floodOpacity="0.8" />
        <feComposite in2="offsetBlur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Neon Effect Filter */}
      <filter id={neonId} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur1" />
        <feGaussianBlur stdDeviation="4" result="blur2" />
        <feGaussianBlur stdDeviation="8" result="blur3" />
        <feMerge>
          <feMergeNode in="blur3" />
          <feMergeNode in="blur2" />
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Glassmorphism Filter */}
      <filter id={glassmorphismId} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.8 0"
        />
        <feOffset dx="0" dy="1" result="offset" />
        <feMerge>
          <feMergeNode in="offset" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Drop Shadow Filter */}
      <filter id={`shadow-${edgeId}`} x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={stateColor} floodOpacity="0.3" />
      </filter>

      {/* Animated Shadow for Active States */}
      <filter id={`shadow-${edgeId}-animated`} x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={stateColor} floodOpacity="0.3">
          <animate attributeName="stdDeviation" values="3;6;3" dur="2s" repeatCount="indefinite" />
          <animate
            attributeName="flood-opacity"
            values="0.3;0.6;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </feDropShadow>
      </filter>

      {/* Turbulence for Wavy Effect */}
      <filter id={`wavy-${edgeId}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" result="turbulence" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          scale="2"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      {/* Pattern Definitions for Dashed/Dotted Lines */}
      <pattern id={`dash-${edgeId}`} patternUnits="userSpaceOnUse" width="10" height="2">
        <rect width="6" height="2" fill={stateColor} />
        <rect x="6" width="4" height="2" fill="transparent" />
      </pattern>

      <pattern id={`dot-${edgeId}`} patternUnits="userSpaceOnUse" width="6" height="2">
        <circle cx="1" cy="1" r="1" fill={stateColor} />
      </pattern>

      {/* Marker Definitions for Arrow Heads */}
      <marker
        id={`arrow-${edgeId}`}
        viewBox="0 0 10 10"
        refX="9"
        refY="3"
        markerWidth="4"
        markerHeight="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L9,3 z" fill={stateColor} />
      </marker>

      {/* Animated Arrow Marker */}
      <marker
        id={`arrow-${edgeId}-animated`}
        viewBox="0 0 10 10"
        refX="9"
        refY="3"
        markerWidth="4"
        markerHeight="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L9,3 z" fill={stateColor}>
          <animate
            attributeName="fill-opacity"
            values="0.5;1;0.5"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </marker>

      {/* Glow Arrow Marker */}
      <marker
        id={`arrow-${edgeId}-glow`}
        viewBox="0 0 10 10"
        refX="9"
        refY="3"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L9,3 z" fill={stateColor} filter={`url(#${glowId})`} />
      </marker>
    </defs>
  )
}

// Utility function to get style properties based on edge configuration
export const getEdgeStyleProps = (props: ModernEdgeStyleProps) => {
  const {
    edgeId,
    color,
    isSelected,
    isHighlighted,
    isActive,
    isCompleted,
    hasError,
    style,
    thickness,
  } = props

  const stateColor = hasError
    ? '#ef4444'
    : isCompleted
      ? '#22c55e'
      : isActive
        ? '#3b82f6'
        : isSelected
          ? '#8b5cf6'
          : isHighlighted
            ? '#6366f1'
            : '#94a3b8' // Medium gray - always visible

  const strokeWidth = {
    thin: 1,
    medium: 1.5,
    thick: 2,
    'extra-thick': 2.5,
  }[thickness]

  const adjustedStrokeWidth = isSelected
    ? strokeWidth + 2
    : isHighlighted
      ? strokeWidth + 1.5
      : strokeWidth

  const getStroke = () => {
    switch (style) {
      case 'gradient':
        return `url(#gradient-${edgeId})`
      case 'glassmorphism':
        return `url(#glassmorphism-${edgeId})`
      case 'neon':
        return stateColor
      default:
        return stateColor
    }
  }

  const getFilter = () => {
    if (style === 'neon') return `url(#neon-${edgeId})`
    if (style === 'glassmorphism') return `url(#glassmorphism-${edgeId})`
    if (isSelected || isActive) return `url(#glow-${edgeId}-enhanced)`
    if (isHighlighted) return `url(#glow-${edgeId})`
    return `url(#shadow-${edgeId})`
  }

  const getMarkerEnd = () => {
    if (isActive) return `url(#arrow-${edgeId}-animated)`
    if (style === 'neon' || isSelected) return `url(#arrow-${edgeId}-glow)`
    return `url(#arrow-${edgeId})`
  }

  return {
    stroke: getStroke(),
    strokeWidth: adjustedStrokeWidth,
    filter: getFilter(),
    markerEnd: getMarkerEnd(),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}
