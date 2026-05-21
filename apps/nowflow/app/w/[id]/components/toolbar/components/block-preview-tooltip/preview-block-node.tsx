/**
 * PreviewBlockNode — Mini block replica for the preview tooltip.
 *
 * "main"  = foreignObject with full shape system + glow (1 layout context)
 * "ghost" = pure SVG rect/text — zero layout overhead
 */
import React, { useMemo } from 'react'
import {
  getLiveCanvasGlassAppearance,
  hexToRgba,
} from '@/components/workflow/live-canvas-block-style'
import { getBlockShape } from '@/app/w/[id]/components/workflow-block/components/hero-style-block/block-shapes'
import type { BlockConfig } from '@/blocks/types'

interface PreviewBlockNodeProps {
  config: BlockConfig
  x: number
  y: number
  variant?: 'main' | 'ghost'
  isDark: boolean
}

const MAIN_W = 114
const MAIN_H = 48
const GHOST_W = 82
const GHOST_H = 34

/**
 * Ghost block — pure SVG, no foreignObject, no layout engine overhead.
 * Just a rounded rect with a colored square (icon placeholder) and text.
 */
function GhostBlock({
  config,
  x,
  y,
  isDark,
}: {
  config: BlockConfig
  x: number
  y: number
  isDark: boolean
}) {
  const left = x - GHOST_W / 2
  const top = y - GHOST_H / 2

  return (
    <g opacity={0.6}>
      {/* Block body */}
      <rect
        x={left}
        y={top}
        width={GHOST_W}
        height={GHOST_H}
        rx={6}
        fill={isDark ? 'rgba(38,42,48,0.88)' : 'rgba(255,255,255,0.92)'}
        stroke={isDark ? 'rgba(255,255,255,0.14)' : config.bgColor}
        strokeWidth={0.8}
        strokeOpacity={isDark ? 1 : 0.3}
      />

      {/* Icon square */}
      <rect
        x={left + 7}
        y={y - 8}
        width={16}
        height={16}
        rx={4}
        fill={config.bgColor}
        fillOpacity={0.85}
      />

      {/* Block name */}
      <text
        x={left + 28}
        y={y + 3}
        fontSize={6.5}
        fontWeight={600}
        fill={isDark ? 'rgba(255,255,255,0.72)' : '#475569'}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {config.name.length > 9 ? config.name.slice(0, 8) + '…' : config.name}
      </text>

      {/* Handle dots */}
      <circle
        cx={left - 1}
        cy={y}
        r={1.5}
        fill={config.bgColor}
        fillOpacity={isDark ? 0.38 : 0.3}
      />
      <circle
        cx={left + GHOST_W + 1}
        cy={y}
        r={1.5}
        fill={config.bgColor}
        fillOpacity={isDark ? 0.38 : 0.3}
      />
    </g>
  )
}

/**
 * Main block — uses foreignObject for accurate shape rendering via getBlockShape().
 * Only 1 foreignObject in the entire canvas (the focused block).
 */
function MainBlock({
  config,
  x,
  y,
  isDark,
}: {
  config: BlockConfig
  x: number
  y: number
  isDark: boolean
}) {
  const shape = useMemo(
    () => getBlockShape(config.type, config.category, config.isUtility ?? false),
    [config.type, config.category, config.isUtility]
  )
  const { glassFallback, glassSurface, glassOverlay, glassInsetShadow, handleBorder } =
    getLiveCanvasGlassAppearance(isDark)

  const IconComponent = useMemo(() => {
    if (typeof config.icon === 'function') return config.icon
    return null
  }, [config.icon])

  const left = x - MAIN_W / 2
  const top = y - MAIN_H / 2

  return (
    <g>
      {/* Input handle */}
      <circle
        cx={left - 1}
        cy={y}
        r={3}
        fill={config.bgColor}
        fillOpacity={isDark ? 0.24 : 0.18}
        style={{ animation: 'bpt-handle-pulse 2s ease-in-out infinite' }}
      />
      <circle
        cx={left - 1}
        cy={y}
        r={2}
        fill={config.bgColor}
        stroke={handleBorder}
        strokeWidth={1}
      />

      {/* Output handle */}
      <circle
        cx={left + MAIN_W + 1}
        cy={y}
        r={3}
        fill={config.bgColor}
        fillOpacity={isDark ? 0.24 : 0.18}
        style={{ animation: 'bpt-handle-pulse 2s ease-in-out infinite', animationDelay: '1s' }}
      />
      <circle
        cx={left + MAIN_W + 1}
        cy={y}
        r={2}
        fill={config.bgColor}
        stroke={handleBorder}
        strokeWidth={1}
      />

      {/* Block body — single foreignObject for the whole canvas */}
      <foreignObject
        x={left}
        y={top}
        width={MAIN_W}
        height={MAIN_H}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            width: MAIN_W,
            height: MAIN_H,
            clipPath: shape.clipPath,
            WebkitClipPath: shape.clipPath,
            borderRadius: shape.borderRadius,
            background: glassFallback,
            border: isDark
              ? '1px solid rgba(255,255,255,0.14)'
              : '1px solid rgba(255,255,255,0.74)',
            boxShadow: `${shape.hasLeftAccent ? `inset 3px 0 0 ${config.bgColor}, ` : ''}${glassInsetShadow}${isDark ? ', 0 14px 28px rgba(0,0,0,0.28)' : ', 0 12px 24px rgba(24,24,27,0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: `0 ${shape.paddingRight} 0 ${shape.paddingLeft}`,
            animation: 'bpt-process-glow 3s ease-in-out infinite',
            animationDelay: '0.5s',
            isolation: 'isolate',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: glassSurface,
              backdropFilter: 'blur(20px) saturate(138%)',
              WebkitBackdropFilter: 'blur(20px) saturate(138%)',
              transform: 'translateZ(0)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: glassOverlay,
            }}
          />
          {/* Icon */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: 22,
              height: 22,
              minWidth: 22,
              borderRadius: 5,
              background: `linear-gradient(135deg, ${config.bgColor}, ${config.bgColor}CC)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 18px ${hexToRgba(config.bgColor, isDark ? 0.28 : 0.22)}, inset 0 1px 0 rgba(255,255,255,0.22)`,
            }}
          >
            {IconComponent && <IconComponent style={{ width: 12, height: 12, color: 'white' }} />}
          </div>

          {/* Name */}
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontSize: 7.5,
              fontWeight: 600,
              color: isDark ? 'rgba(255,255,255,0.92)' : '#1e293b',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {config.name}
          </span>

          {/* Status dot */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: 4,
              height: 4,
              minWidth: 4,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              animation: 'bpt-handle-pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </foreignObject>
    </g>
  )
}

export const PreviewBlockNode = React.memo(function PreviewBlockNode({
  config,
  x,
  y,
  variant = 'main',
  isDark,
}: PreviewBlockNodeProps) {
  if (variant === 'ghost') {
    return <GhostBlock config={config} x={x} y={y} isDark={isDark} />
  }
  return <MainBlock config={config} x={x} y={y} isDark={isDark} />
})

export const BLOCK_DIMENSIONS = {
  main: { w: MAIN_W, h: MAIN_H },
  ghost: { w: GHOST_W, h: GHOST_H },
}
