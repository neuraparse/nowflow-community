/**
 * PreviewEdge — Lightweight animated bezier edge with a single flowing particle.
 *
 * Uses SVG-native <animateMotion> for zero-JS-overhead, same as hero-edge.tsx.
 * Kept minimal: 1 path + 1 glow path + 1 particle = 3 SVG nodes total.
 */
import React from 'react'

interface PreviewEdgeProps {
  path: string
  color: string
  isDark: boolean
  delay?: number
  pathId: string
  duration?: number
}

export const PreviewEdge = React.memo(function PreviewEdge({
  path,
  color,
  isDark,
  delay = 0,
  pathId,
  duration = 2.4,
}: PreviewEdgeProps) {
  return (
    <g>
      {/* Subtle glow background */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isDark ? 4.5 : 4}
        strokeOpacity={isDark ? 0.18 : 0.12}
        strokeLinecap="round"
        style={{
          animation: 'bpt-edge-glow-pulse 3s ease-in-out infinite',
          animationDelay: `${delay}s`,
        }}
      />

      {/* Main edge line */}
      <path
        id={pathId}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={isDark ? 0.5 : 0.4}
        strokeLinecap="round"
      />

      {/* Single flowing particle */}
      <circle
        r={2.5}
        fill={color}
        fillOpacity={isDark ? 0.92 : 0.86}
        style={{
          animation: `bpt-particle-fade ${duration}s ease-in-out infinite`,
          animationDelay: `${delay}s`,
        }}
      >
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.4 0 0.6 1"
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </g>
  )
})
