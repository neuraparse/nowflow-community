import React from 'react'
import { AlertCircle, AlertTriangle, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NoticeVariant = 'info' | 'warning' | 'success' | 'error' | 'default'

interface NoticeProps {
  children: React.ReactNode
  variant?: NoticeVariant
  className?: string
  icon?: React.ReactNode
  title?: string
}

const variantStyles = {
  default: {
    container: 'border-black/[0.08] dark:border-white/[0.08]',
    text: 'text-zinc-700 dark:text-white/72',
    title: 'text-zinc-800 dark:text-white/92 font-medium',
    icon: <Info className="mr-2 h-4 w-4 flex-shrink-0 text-zinc-500 dark:text-white/55" />,
  },
  info: {
    container: 'border-sky-500/16 dark:border-sky-400/18',
    text: 'text-sky-800 dark:text-sky-200/90',
    title: 'text-sky-800 dark:text-sky-200 font-medium',
    icon: <Info className="mr-2 h-4 w-4 flex-shrink-0 text-sky-500 dark:text-sky-300" />,
  },
  warning: {
    container: 'border-amber-500/16 dark:border-amber-400/18',
    text: 'text-amber-800 dark:text-amber-200/90',
    title: 'text-amber-800 dark:text-amber-200 font-medium',
    icon: (
      <AlertTriangle className="mr-2 h-4 w-4 flex-shrink-0 text-amber-500 dark:text-amber-300" />
    ),
  },
  success: {
    container: 'border-emerald-500/16 dark:border-emerald-400/18',
    text: 'text-emerald-800 dark:text-emerald-200/90',
    title: 'text-emerald-800 dark:text-emerald-200 font-medium',
    icon: <Check className="mr-2 h-4 w-4 flex-shrink-0 text-emerald-500 dark:text-emerald-300" />,
  },
  error: {
    container: 'border-rose-500/18 dark:border-rose-400/20',
    text: 'text-rose-700 dark:text-rose-200/92',
    title: 'text-rose-700 dark:text-rose-200 font-medium',
    icon: <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-rose-500 dark:text-rose-300" />,
  },
}

export function Notice({ children, variant = 'info', className, icon, title }: NoticeProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'flex rounded-md border bg-card px-3.5 py-3 shadow-sm',
        styles.container,
        className
      )}
    >
      <div className="flex items-start">
        {icon || styles.icon}
        <div className="flex-1">
          {title && <div className={cn('mb-1 text-sm', styles.title)}>{title}</div>}
          <div className={cn('text-sm', styles.text)}>{children}</div>
        </div>
      </div>
    </div>
  )
}
