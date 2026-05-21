/**
 * PreviewCanvas — Real workflow preview showing the block connected between
 * predecessor and successor blocks, exactly like it would appear on the canvas.
 *
 * Layout (328×130 viewBox):
 *   Left   (0–90)    : predecessor (ghost) block
 *   Edge   (90–120)  : bezier edge from predecessor → main
 *   Center (120–208) : main block (full size, with glow)
 *   Edge   (208–238) : bezier edge from main → successor
 *   Right  (238–328) : successor (ghost) block
 */
import React, { useMemo } from 'react'
import { getBlock } from '@/blocks/registry'
import type { BlockConfig } from '@/blocks/types'
import { BLOCK_DIMENSIONS, PreviewBlockNode } from './preview-block-node'
import { PreviewEdge } from './preview-edge'

const W = 328
const H = 130
const CY = H / 2 // vertical center

// Horizontal positions (center X of each block)
const PRED_X = 48
const MAIN_X = W / 2 // 164
const SUCC_X = W - 48 // 280

interface PreviewCanvasProps {
  config: BlockConfig
  isDark: boolean
}

/** Smooth cubic bezier edge path */
function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = Math.abs(tx - sx)
  const cpOffset = dx * 0.5
  return `M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${tx - cpOffset} ${ty}, ${tx} ${ty}`
}

/**
 * Pick realistic predecessor & successor blocks based on the block's category/type.
 * Returns registry keys for blocks that make sense in a real workflow.
 */
function getNeighborTypes(config: BlockConfig): { pred: string; succ: string } {
  const t = config.type
  const cat = config.category

  // Starter block: no predecessor, flows to agent or function
  if (t === 'starter') {
    return { pred: '', succ: 'agent' }
  }

  // Agent blocks: preceded by starter or API, followed by condition or integration
  if (cat === 'agents') {
    return { pred: 'starter', succ: 'condition' }
  }

  // Condition / Router: preceded by agent, followed by function
  if (t === 'condition' || t === 'router') {
    return { pred: 'agent', succ: 'function' }
  }

  // Function block: preceded by API, followed by agent
  if (t === 'function') {
    return { pred: 'api', succ: 'agent' }
  }

  // API block: preceded by starter, followed by function
  if (t === 'api') {
    return { pred: 'starter', succ: 'function' }
  }

  // Loop block: preceded by API, followed by agent
  if (t === 'loop') {
    return { pred: 'api', succ: 'agent' }
  }

  // Data blocks: preceded by function, followed by agent
  if (cat === 'data') {
    return { pred: 'function', succ: 'agent' }
  }

  // Integration/tool blocks: preceded by agent or function, followed by condition
  if (cat === 'tools' || cat === 'integrations') {
    return { pred: 'agent', succ: 'condition' }
  }

  // Default: starter → block → function
  return { pred: 'starter', succ: 'function' }
}

export const PreviewCanvas = React.memo(function PreviewCanvas({
  config,
  isDark,
}: PreviewCanvasProps) {
  const { pred: predType, succ: succType } = useMemo(() => getNeighborTypes(config), [config])

  const predConfig = useMemo(() => (predType ? getBlock(predType) : null), [predType])
  const succConfig = useMemo(() => (succType ? getBlock(succType) : null), [succType])

  const hasPred = !!predConfig
  const hasSucc = !!succConfig

  // Edge anchor points
  const predRight = PRED_X + BLOCK_DIMENSIONS.ghost.w / 2 + 2
  const mainLeft = MAIN_X - BLOCK_DIMENSIONS.main.w / 2 - 2
  const mainRight = MAIN_X + BLOCK_DIMENSIONS.main.w / 2 + 2
  const succLeft = SUCC_X - BLOCK_DIMENSIONS.ghost.w / 2 - 2

  // Edge paths
  const predEdgePath = useMemo(
    () => (hasPred ? bezierPath(predRight, CY, mainLeft, CY) : ''),
    [hasPred, predRight, mainLeft]
  )
  const succEdgePath = useMemo(
    () => (hasSucc ? bezierPath(mainRight, CY, succLeft, CY) : ''),
    [hasSucc, mainRight, succLeft]
  )

  // Unique IDs for SVG references
  const uid = useMemo(() => Math.random().toString(36).slice(2, 7), [])
  const patternId = `bpt-grid-${uid}`
  const predEdgeId = `bpt-pe-${uid}`
  const succEdgeId = `bpt-se-${uid}`

  return (
    <div className="px-4 pt-3">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(18,20,24,0.96) 0%, rgba(24,27,31,0.92) 100%)'
            : 'linear-gradient(180deg, rgba(251,252,253,0.96) 0%, rgba(244,247,250,0.94) 100%)',
        }}
      >
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {/* ── Defs ─────────────────────────────────────────────── */}
          <defs>
            <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle
                cx="7"
                cy="7"
                r="0.8"
                fill={isDark ? '#94a3b8' : '#64748b'}
                fillOpacity={isDark ? 0.12 : 0.12}
              />
            </pattern>
          </defs>

          {/* ── Background ───────────────────────────────────────── */}
          <rect width={W} height={H} fill={isDark ? '#171a1e' : '#f6f8fb'} rx={12} />
          <rect
            width={W}
            height={H}
            fill={isDark ? 'rgba(255,255,255,0.018)' : 'rgba(255,255,255,0.5)'}
            rx={12}
          />
          <rect width={W} height={H} fill={`url(#${patternId})`} rx={12} />

          {/* ── Predecessor → Main Edge ──────────────────────────── */}
          {hasPred && predEdgePath && (
            <PreviewEdge
              path={predEdgePath}
              color={predConfig!.bgColor}
              isDark={isDark}
              delay={0}
              pathId={predEdgeId}
            />
          )}

          {/* ── Main → Successor Edge ────────────────────────────── */}
          {hasSucc && succEdgePath && (
            <PreviewEdge
              path={succEdgePath}
              color={config.bgColor}
              isDark={isDark}
              delay={1.2}
              pathId={succEdgeId}
            />
          )}

          {/* ── Predecessor Block (ghost) ─────────────────────────── */}
          {predConfig && (
            <PreviewBlockNode
              config={predConfig}
              x={PRED_X}
              y={CY}
              variant="ghost"
              isDark={isDark}
            />
          )}

          {/* ── Main Block (focused) ─────────────────────────────── */}
          <PreviewBlockNode config={config} x={MAIN_X} y={CY} variant="main" isDark={isDark} />

          {/* ── Successor Block (ghost) ──────────────────────────── */}
          {succConfig && (
            <PreviewBlockNode
              config={succConfig}
              x={SUCC_X}
              y={CY}
              variant="ghost"
              isDark={isDark}
            />
          )}

          {/* ── Starter: no predecessor, show entry arrow ─────────── */}
          {!hasPred && (
            <g opacity={0.4}>
              <line
                x1={12}
                y1={CY}
                x2={mainLeft - 8}
                y2={CY}
                stroke={isDark ? '#94a3b8' : '#64748b'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeLinecap="round"
                style={{
                  animation: 'bpt-flow-dash 0.8s linear infinite',
                }}
              />
              <polygon
                points={`${mainLeft - 8},${CY - 4} ${mainLeft - 2},${CY} ${mainLeft - 8},${CY + 4}`}
                fill={isDark ? '#94a3b8' : '#64748b'}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
})
