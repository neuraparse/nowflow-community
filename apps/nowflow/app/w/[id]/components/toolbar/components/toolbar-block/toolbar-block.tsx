import { createElement, type CSSProperties, useCallback } from 'react'
import { TeamsIcon } from '@/components/icons'
import {
  ModernAgentIcon,
  ModernApiIcon,
  ModernConditionIcon,
  ModernDataIcon,
  ModernFunctionIcon,
  ModernModelIcon,
  ModernRouterIcon,
  ModernStartIcon,
} from '@/components/modern-icons'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { categoryEngine } from '@/blocks'
import { CATEGORY_METADATA } from '@/blocks'
import type { BlockConfig } from '@/blocks/types'
import { BlockPreviewTooltip } from '../block-preview-tooltip/block-preview-tooltip'

export type ToolbarBlockProps = {
  config: BlockConfig
}

/** Resolve a human-readable primary category label for a block */
function getPrimaryCategoryLabel(config: BlockConfig): string {
  const enriched = categoryEngine.enrichBlock(config)
  const primaryCat = enriched.primaryCategories[0]
  if (primaryCat) {
    return CATEGORY_METADATA[primaryCat]?.name ?? primaryCat
  }
  // Fallback to legacy category
  const legacyMap: Record<string, string> = {
    agents: 'AI Agents',
    tools: 'Integrations',
    data: 'Data & Files',
    blocks: 'Core Flow',
    integrations: 'Integrations',
  }
  return legacyMap[config.category] ?? config.category
}

function resolveToolbarIcon(config: BlockConfig) {
  switch (config.type) {
    case 'agent':
      return ModernAgentIcon
    case 'function':
      return ModernFunctionIcon
    case 'router':
      return ModernRouterIcon
    case 'api':
      return ModernApiIcon
    case 'starter':
      return ModernStartIcon
    case 'condition':
      return ModernConditionIcon
    case 'data':
      return ModernDataIcon
    case 'model':
      return ModernModelIcon
    case 'teams':
      return TeamsIcon
    default:
      if (typeof config.icon === 'function') return config.icon
      return config.icon || ModernDataIcon
  }
}

export function ToolbarBlock({ config }: ToolbarBlockProps) {
  const ModernIcon = resolveToolbarIcon(config)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: config.type }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleClick = useCallback(() => {
    if (config.type === 'connectionBlock') return
    const event = new CustomEvent('add-block-from-toolbar', {
      detail: { type: config.type },
    })
    window.dispatchEvent(event)
  }, [config.type])

  // ── Standard Block Card ────────────────────────────────────────────────────
  const categoryLabel = getPrimaryCategoryLabel(config)

  return (
    <BlockPreviewTooltip config={config}>
      <div
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        data-block-type={config.type}
        data-block-category={config.category}
        style={{ '--workflow-library-card-accent': config.bgColor || '#22d3ee' } as CSSProperties}
        className={cn(
          'workflow-editor-block-library-card smoky-glass-pane block-library-surface group flex h-full min-h-[96px] flex-col items-start gap-2 overflow-hidden rounded-[12px] p-3 transition-all duration-200 cursor-pointer active:cursor-grabbing transform-gpu hover:-translate-y-px',
          workflowEditorTheme.toolboxSurface,
          'hover:border-white/12 hover:bg-[var(--workflow-editor-bg-hover)]'
        )}
      >
        <div className="flex items-center gap-2.5 w-full min-w-0">
          <div
            className="workflow-editor-block-library-card-icon relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] ring-1 ring-white/35"
            style={{
              background: `linear-gradient(135deg, ${config.bgColor}E0, ${config.bgColor}B0)`,
              boxShadow: `0 10px 24px ${config.bgColor}1f, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            {createElement(ModernIcon, {
              className: `text-white transition-all duration-200 group-hover:scale-105 ${
                config.type === 'agent' ? 'w-[24px] h-[24px]' : 'w-[22px] h-[22px]'
              }`,
              'aria-hidden': true,
            })}
          </div>
          <div className="workflow-editor-block-library-card-copy flex min-w-0 flex-col gap-0.5 w-full min-h-[48px]">
            <h3
              className="workflow-editor-block-library-card-title line-clamp-2 w-full break-words text-[12px] font-logo font-semibold leading-tight text-[color:var(--workflow-editor-text)] transition-colors duration-200 group-hover:text-white"
              title={config.name}
            >
              {config.name}
            </h3>
            <p
              className="workflow-editor-block-library-card-description line-clamp-2 break-words text-[10px] font-logo leading-tight text-[color:var(--workflow-editor-text-muted)] transition-colors duration-200 group-hover:text-[color:var(--workflow-editor-text)]"
              title={config.description}
            >
              {config.description}
            </p>
          </div>
        </div>
        <div className="workflow-editor-block-library-card-footer mt-auto w-full flex items-center justify-between">
          <div
            className={cn(
              'workflow-editor-block-library-card-tag smoky-glass-chip block-library-chip rounded-[10px] px-2 py-1 text-[9px] font-logo font-semibold uppercase tracking-[0.18em]',
              workflowEditorTheme.toolboxChip,
              workflowEditorTheme.soft
            )}
          >
            {categoryLabel}
          </div>
        </div>
      </div>
    </BlockPreviewTooltip>
  )
}
