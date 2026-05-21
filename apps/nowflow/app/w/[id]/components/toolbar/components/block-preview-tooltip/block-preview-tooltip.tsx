'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { categoryEngine } from '@/blocks'
import { CATEGORY_METADATA } from '@/blocks'
import type { BlockConfig } from '@/blocks/types'
import './preview-animations.css'
import { PreviewCanvas } from './preview-canvas'

// Human-readable labels for capability tags
const TAG_LABELS: Record<string, string> = {
  ai_reasoning: 'AI',
  rag: 'RAG',
  vision: 'Vision',
  data_processing: 'Data',
  data_storage: 'Storage',
  data_retrieval: 'Retrieval',
  data_transformation: 'Transform',
  conditional_logic: 'Conditions',
  iteration: 'Loop',
  routing: 'Routing',
  scheduling: 'Schedule',
  webhooks: 'Webhooks',
  oauth: 'OAuth',
  rest_api: 'REST',
  graphql: 'GraphQL',
  websockets: 'WebSocket',
  semantic_search: 'Semantic',
  image_generation: 'Image Gen',
  image_analysis: 'Vision',
  audio_generation: 'Audio',
  video_processing: 'Video',
  code_execution: 'Code',
  custom_functions: 'Functions',
}

interface BlockPreviewTooltipProps {
  config: BlockConfig
  children: React.ReactNode
}

export function BlockPreviewTooltip({ config, children }: BlockPreviewTooltipProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Enrich block for category + capability metadata
  const enriched = useMemo(() => categoryEngine.enrichBlock(config), [config])

  // Icon component resolver
  const IconComponent = useMemo(() => {
    if (typeof config.icon === 'function') return config.icon
    return null
  }, [config.icon])

  // Capability chips (max 4, known labels only)
  const chips = useMemo(
    () => enriched.capabilityTags.filter((t) => TAG_LABELS[t]).slice(0, 4),
    [enriched.capabilityTags]
  )

  // Primary category label
  const categoryLabel = useMemo(() => {
    const cat = enriched.primaryCategories[0]
    if (cat) return CATEGORY_METADATA[cat]?.name ?? cat
    return config.category
  }, [enriched, config.category])

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({ x: rect.right + 12, y: rect.top })
      }
      setIsVisible(true)
    }, 300)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Viewport boundary clamp — keep tooltip on screen
  useEffect(() => {
    if (isVisible && containerRef.current) {
      const tooltipWidth = 360
      const tooltipHeight = 300
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let newX = position.x
      let newY = position.y

      if (newX + tooltipWidth > viewportWidth) {
        const rect = containerRef.current.getBoundingClientRect()
        newX = rect.left - tooltipWidth - 16
      }
      if (newY + tooltipHeight > viewportHeight) {
        newY = Math.max(8, viewportHeight - tooltipHeight - 8)
      }

      if (newX !== position.x || newY !== position.y) {
        setPosition({ x: newX, y: newY })
      }
    }
  }, [isVisible, position.x, position.y])

  const totalChipsAvailable = enriched.capabilityTags.filter((t) => TAG_LABELS[t]).length

  const tooltipContent = isVisible && mounted && (
    <>
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          willChange: 'transform, opacity',
          animation: 'bpt-slide-in 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <div
          className={cn(
            'workflow-editor-portal-surface smoky-glass-panel block-library-shell w-[360px] overflow-hidden rounded-2xl',
            workflowEditorTheme.toolboxShell
          )}
        >
          {/* ─────────── HEADER ─────────── */}
          <div className="copilot-section flex items-center gap-3 border-b border-[color:var(--workflow-editor-border-soft)] px-4 py-3">
            <div
              className={cn(
                'smoky-glass-pane block-library-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                workflowEditorTheme.toolboxSurface
              )}
              style={{
                background: `linear-gradient(135deg, ${config.bgColor}E0, ${config.bgColor}B0)`,
                boxShadow: `0 10px 24px ${config.bgColor}22, inset 0 1px 0 rgba(255,255,255,0.24)`,
              }}
            >
              {IconComponent && <IconComponent className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4
                  className={cn(
                    'truncate text-[13px] font-logo font-semibold',
                    workflowEditorTheme.title
                  )}
                >
                  {config.name}
                </h4>
                {chips[0] && (
                  <span
                    className={cn(
                      'smoky-glass-chip block-library-chip shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-logo font-bold uppercase tracking-widest',
                      workflowEditorTheme.toolboxChip,
                      workflowEditorTheme.soft
                    )}
                  >
                    {TAG_LABELS[chips[0]]}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'mt-0.5 text-[10px] font-logo uppercase tracking-wide',
                  workflowEditorTheme.soft
                )}
              >
                {categoryLabel}
              </p>
            </div>
          </div>

          {/* ─────────── DESCRIPTION ─────────── */}
          <div className="px-4 pt-3">
            <p
              className={cn(
                'line-clamp-2 text-[11px] font-logo leading-relaxed',
                workflowEditorTheme.muted
              )}
            >
              {config.description}
            </p>
          </div>

          {/* ─────────── CANVAS PREVIEW (animated scene) ─────────── */}
          <PreviewCanvas config={config} isDark={isDark} />

          {/* ─────────── CAPABILITY CHIPS ─────────── */}
          {chips.length > 0 ? (
            <div className="px-4 pt-2.5 pb-4">
              <div className="flex flex-wrap gap-1">
                {chips.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      'smoky-glass-chip block-library-chip rounded-md px-1.5 py-0.5 text-[8.5px] font-logo font-semibold',
                      workflowEditorTheme.toolboxChip,
                      workflowEditorTheme.soft
                    )}
                  >
                    {TAG_LABELS[tag]}
                  </span>
                ))}
                {totalChipsAvailable > 4 && (
                  <span
                    className={cn(
                      'smoky-glass-chip block-library-chip rounded-md px-1.5 py-0.5 text-[8.5px] font-logo font-semibold',
                      workflowEditorTheme.toolboxChip,
                      workflowEditorTheme.soft
                    )}
                  >
                    +{totalChipsAvailable - 4}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="pb-3" />
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative h-full"
      >
        {children}
      </div>

      {mounted && typeof window !== 'undefined' && tooltipContent
        ? createPortal(tooltipContent, document.body)
        : null}
    </>
  )
}
