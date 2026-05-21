'use client'

import { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { type AccentColor } from './panel-header'

// Use a flexible type for icon components
type IconComponent = ComponentType<{ className?: string }>

const iconBgColors: Record<AccentColor, string> = {
  emerald: '',
  blue: '',
  purple: '',
  slate: '',
  amber: '',
  pink: '',
}

const iconColors: Record<AccentColor, string> = {
  emerald: 'text-[var(--workflow-editor-accent-brand)]',
  blue: 'text-[var(--workflow-editor-accent-info)]',
  purple: 'text-[var(--workflow-editor-accent-violet)]',
  slate: 'text-[var(--workflow-editor-text-muted)]',
  amber: 'text-[var(--workflow-editor-accent-warning)]',
  pink: 'text-[var(--workflow-editor-accent-danger)]',
}

interface PanelEmptyStateProps {
  icon: IconComponent
  title: string
  description: string
  accentColor?: AccentColor
  ctaLabel?: string
  ctaOnClick?: () => void
  ctaIcon?: IconComponent
  className?: string
}

export function PanelEmptyState({
  icon: Icon,
  title,
  description,
  accentColor = 'emerald',
  ctaLabel,
  ctaOnClick,
  ctaIcon: CtaIcon,
  className,
}: PanelEmptyStateProps) {
  return (
    <div
      className={cn(
        'workflow-editor-panel-empty flex flex-col items-center justify-center px-4 py-10 text-center',
        className
      )}
    >
      <div
        className={cn(
          workflowEditorTheme.control,
          'workflow-editor-panel-empty-icon silver-glass-pane smoky-glass-pane mx-auto mb-3 flex h-10 w-10 items-center justify-center',
          iconBgColors[accentColor]
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', iconColors[accentColor])} />
      </div>
      <div className={cn('mb-1 text-[13px] font-medium', workflowEditorTheme.title)}>{title}</div>
      <div className={cn('max-w-[220px] text-[12px] leading-5', workflowEditorTheme.soft)}>
        {description}
      </div>
      {ctaLabel && ctaOnClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={ctaOnClick}
          className={cn(
            workflowEditorTheme.button,
            'workflow-editor-panel-empty-cta silver-glass-button smoky-glass-chip mt-4 h-8 rounded-md px-3 text-[12px]'
          )}
        >
          {CtaIcon && <CtaIcon className="mr-1.5 h-3.5 w-3.5" />}
          {ctaLabel}
        </Button>
      )}
    </div>
  )
}
