import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type WorkspacePageHeaderProps = {
  eyebrow: string
  title: string
  accent?: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function WorkspacePageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
  className,
}: WorkspacePageHeaderProps) {
  return (
    <div
      className={cn(
        'workspace-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div>
        <p className="workspace-page-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-white/50 font-logo mb-3">
          {eyebrow}
        </p>
        <h1 className="workspace-page-title text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          {title}
          {accent && (
            <>
              {' '}
              <span className="workspace-page-accent font-serif italic text-[#4A7A68] dark:text-[#94B8A6]">
                {accent}
              </span>
            </>
          )}
        </h1>
        {description && (
          <p className="workspace-page-description mt-2 text-[13px] text-zinc-500 dark:text-white/70 font-logo leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="workspace-page-actions flex items-center gap-3">{actions}</div>}
    </div>
  )
}
