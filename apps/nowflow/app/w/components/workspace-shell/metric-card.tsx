import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>

type WorkspaceMetricCardTrend = {
  label: string
  tone?: 'positive' | 'negative' | 'neutral'
}

type WorkspaceMetricCardProps = {
  icon: IconComponent
  label: string
  value: string
  color?: string
  trend?: WorkspaceMetricCardTrend
  className?: string
}

const trendToneClass: Record<NonNullable<WorkspaceMetricCardTrend['tone']>, string> = {
  positive:
    'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6] border-[#4A7A68]/[0.15] dark:border-[#94B8A6]/[0.15]',
  negative: 'bg-red-500/[0.08] text-red-600 dark:text-red-400 border-red-500/[0.15]',
  neutral:
    'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/60 border-black/[0.06] dark:border-white/[0.06]',
}

export function WorkspaceMetricCard({
  icon: Icon,
  label,
  value,
  color = '#4A7A68',
  trend,
  className,
}: WorkspaceMetricCardProps) {
  const tone = trend?.tone ?? 'neutral'
  return (
    <div
      className={cn(
        'workspace-metric-card silver-glass-panel rounded-xl bg-transparent p-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="workspace-metric-label text-[10px] font-logo uppercase tracking-wider text-zinc-400 dark:text-white/50 font-tech">
            {label}
          </p>
          <p className="workspace-metric-value text-2xl font-logo font-bold text-zinc-800 dark:text-white mt-1">
            {value}
          </p>
          {trend && (
            <span
              className={cn(
                'workspace-metric-trend mt-2 inline-flex items-center text-[10px] font-logo font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border',
                trendToneClass[tone]
              )}
            >
              {trend.label}
            </span>
          )}
        </div>
        <div
          className="workspace-metric-icon h-10 w-10 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${color}08`,
            border: `1px solid ${color}15`,
          }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}
