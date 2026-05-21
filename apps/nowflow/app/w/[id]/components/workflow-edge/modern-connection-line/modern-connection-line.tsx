'use client'

import React, { useMemo } from 'react'
// reactflow API differs by version; prefer named export for getBezierPath
import { getBezierPath } from '@xyflow/react'
import type { Position } from '@xyflow/react'
import { motion } from 'framer-motion'

interface ConnectionLineProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  fromPosition: Position
  toPosition: Position
}

export function ModernConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineProps) {
  // Calculate smooth bezier path
  const [connectionPath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    curvature: 0.25,
  })

  // Modern gradient for connection line
  const gradientId = 'modern-connection-gradient'

  // Calculate path length for animation
  const pathLength = useMemo(() => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', connectionPath)
    return path.getTotalLength()
  }, [connectionPath])

  return (
    <g>
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
        </linearGradient>

        {/* Animated gradient for flow effect */}
        <linearGradient id={`${gradientId}-animated`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="1">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </stop>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0">
            <animate
              attributeName="stop-opacity"
              values="0;1;0"
              dur="1.5s"
              repeatCount="indefinite"
              begin="0.6s"
            />
          </stop>
        </linearGradient>

        {/* Glow filter */}
        <filter id="modern-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle background glow */}
      <motion.path
        d={connectionPath as any}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="4"
        strokeOpacity="0.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#modern-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />

      {/* Main connection line - more subtle */}
      <motion.path
        d={connectionPath as any}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeOpacity="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength as any}
        strokeDashoffset={pathLength as any}
        initial={{ strokeDashoffset: pathLength, opacity: 0 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />

      {/* Animated flow overlay */}
      <motion.path
        d={connectionPath as any}
        fill="none"
        stroke={`url(#${gradientId}-animated)`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      />

      {/* Flowing particles - using animateMotionPath instead of offsetDistance */}
      {[...Array(3)].map((_, i) => (
        <motion.circle
          key={i}
          r={'2' as any}
          fill="#3b82f6"
          initial={{
            opacity: 0,
            scale: 0,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.5,
            ease: 'easeInOut',
          }}
        >
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            begin={`${i * 0.5}s`}
            path={connectionPath}
          />
        </motion.circle>
      ))}

      {/* Connection endpoint indicator */}
      <motion.circle
        // @ts-ignore: framer-motion MotionProps doesn't include cx/cy/r on circle
        cx={toX as any}
        cy={toY as any}
        r={'4' as any}
        fill="#3b82f6"
        stroke="white"
        strokeWidth="2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.2, 1],
          opacity: 1,
        }}
        transition={{
          duration: 0.6,
          delay: 0.8,
          ease: 'easeOut',
        }}
      />

      {/* Pulsing ring around endpoint */}
      <motion.circle
        // @ts-ignore: framer-motion MotionProps doesn't include cx/cy/r on circle
        cx={toX as any}
        cy={toY as any}
        r={'8' as any}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1"
        strokeOpacity="0.6"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.6, 0, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: 1,
          ease: 'easeInOut',
        }}
      />
    </g>
  )
}
