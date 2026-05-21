import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>

type WorkspaceEmptyStateProps = {
  icon: IconComponent
  title?: string
  description: string
  action?: ReactNode
  className?: string
}

export function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: WorkspaceEmptyStateProps) {
  return (
    <div
      className={cn(
        'workspace-empty-state silver-glass-panel rounded-xl bg-transparent py-12 text-center',
        className
      )}
    >
      <div className="workspace-empty-state-icon h-10 w-10 rounded-xl bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.08] flex items-center justify-center mx-auto mb-3">
        <Icon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
      </div>
      {title && (
        <p className="workspace-empty-state-title text-[13px] font-logo font-medium text-zinc-700 dark:text-white/80 mb-1">
          {title}
        </p>
      )}
      <p className="workspace-empty-state-description text-[13px] font-logo text-zinc-500 dark:text-white/60">
        {description}
      </p>
      {action && (
        <div className="workspace-empty-state-action mt-4 flex justify-center">{action}</div>
      )}
    </div>
  )
}
