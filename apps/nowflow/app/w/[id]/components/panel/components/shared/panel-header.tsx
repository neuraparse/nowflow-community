'use client'

import { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'

// Use a flexible type for icon components to support both Lucide icons and other icon components
type IconComponent = ComponentType<{ className?: string }>

type AccentColor = 'emerald' | 'blue' | 'purple' | 'slate' | 'amber' | 'pink'

const accentColors: Record<
  AccentColor,
  {
    dot: string
    badge: string
    iconHover: string
  }
> = {
  emerald: {
    dot: 'bg-[var(--workflow-editor-accent-brand)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-accent-brand)]',
  },
  blue: {
    dot: 'bg-[var(--workflow-editor-accent-info)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-accent-info)]',
  },
  purple: {
    dot: 'bg-[var(--workflow-editor-accent-violet)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-accent-violet)]',
  },
  slate: {
    dot: 'bg-[var(--workflow-editor-text-muted)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-text)]',
  },
  amber: {
    dot: 'bg-[var(--workflow-editor-accent-warning)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-accent-warning)]',
  },
  pink: {
    dot: 'bg-[var(--workflow-editor-accent-danger)]',
    badge: 'text-white/72',
    iconHover: 'hover:text-[var(--workflow-editor-accent-danger)]',
  },
}

interface PanelHeaderProps {
  title: string
  icon?: IconComponent
  count?: number
  accentColor?: AccentColor
  pulseDot?: boolean
  actions?: ReactNode
  secondaryContent?: ReactNode
  className?: string
}

export function PanelHeader({
  title,
  icon: Icon,
  count,
  accentColor = 'emerald',
  pulseDot = false,
  actions,
  secondaryContent,
  className,
}: PanelHeaderProps) {
  const colors = accentColors[accentColor]

  return (
    <div
      className={cn(
        'workflow-editor-panel-section-header flex-none border-b border-white/[0.05] bg-transparent px-3 py-2',
        className
      )}
    >
      <div className="flex min-h-7 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={cn(
              'workflow-editor-panel-section-title flex min-w-0 items-center gap-1.5 text-[12px] font-medium',
              workflowEditorTheme.muted
            )}
          >
            {pulseDot && (
              <div className={cn('h-1.5 w-1.5 rounded-full', colors.dot, 'animate-pulse')} />
            )}
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span className="truncate">{title}</span>
            {count !== undefined && (
              <span
                className={cn(
                  workflowEditorTheme.control,
                  'workflow-editor-panel-count silver-glass-chip smoky-glass-chip rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                  colors.badge
                )}
              >
                {count}
              </span>
            )}
          </div>
        </div>

        {actions && (
          <div className="workflow-editor-panel-section-actions flex shrink-0 items-center gap-1 overflow-x-auto no-scrollbar">
            {actions}
          </div>
        )}
      </div>

      {secondaryContent && (
        <div className="workflow-editor-panel-section-secondary mt-2">{secondaryContent}</div>
      )}
    </div>
  )
}

export type { AccentColor }
