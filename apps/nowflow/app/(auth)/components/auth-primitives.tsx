import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AnimatedBorderCardProps = {
  children: ReactNode
  className?: string
  borderDurationSeconds?: number
  borderOpacity?: number
}

const borderSpinGradient =
  'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 45%, #4A7A6860 70%, transparent 100%)'

export const AnimatedBorderCard = ({
  children,
  className,
  borderDurationSeconds = 10,
  borderOpacity = 0.3,
}: AnimatedBorderCardProps) => {
  const borderStyle: CSSProperties = {
    background: borderSpinGradient,
    animation: `border-spin ${borderDurationSeconds}s linear infinite`,
  }

  return (
    <div className={cn('relative rounded-[26px]', className)}>
      <div
        className="absolute -inset-[1px] rounded-[26px]"
        style={{ ...borderStyle, opacity: borderOpacity }}
      />
      {children}
    </div>
  )
}

type AuthCardBadgeProps = {
  label: string
  className?: string
}

export const AuthCardBadge = ({ label, className }: AuthCardBadgeProps) => (
  <div className={cn('mb-4 flex justify-center', className)}>
    <div className="silver-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[#4A7A68] dark:bg-[#8CB09C]" />
      <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/35">
        {label}
      </span>
    </div>
  </div>
)

type AuthFormDividerProps = {
  label?: string
  className?: string
}

export const AuthFormDivider = ({
  label = 'Or continue with email',
  className,
}: AuthFormDividerProps) => (
  <div className={cn('relative', className)}>
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-black/[0.06] dark:border-white/[0.06]" />
    </div>
    <div className="relative flex justify-center text-xs">
      <span className="silver-glass-chip rounded-full px-3 py-1 font-tech text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-400 dark:text-white/25">
        {label}
      </span>
    </div>
  </div>
)

type AuthSubmitBorderProps = {
  children: ReactNode
  className?: string
}

export const AuthSubmitBorder = ({ children, className }: AuthSubmitBorderProps) => (
  <div className={cn('relative rounded-xl group/submit', className)}>
    <div
      className="absolute -inset-[1px] rounded-[13px] opacity-40 transition-opacity duration-500 group-hover/submit:opacity-70"
      style={{
        background:
          'conic-gradient(from var(--border-angle, 0deg), transparent 0%, #4A7A68 20%, transparent 40%, #4A7A6880 70%, transparent 90%)',
        animation: 'border-spin 4s linear infinite',
      }}
    />
    {children}
  </div>
)

export const authFieldLabelClassName =
  'font-tech text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/30'

export const authFieldInputClassName = cn(
  'h-12 rounded-xl border border-black/[0.06] dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] text-[14px] font-body text-zinc-800 dark:text-white shadow-none',
  'placeholder:text-zinc-500 dark:placeholder:text-white/20',
  'focus-visible:border-[#4A7A68]/30 focus-visible:ring-2 focus-visible:ring-[#4A7A68]/10 focus-visible:ring-offset-0',
  'transition-all duration-200'
)

export const authSubmitButtonClassName = cn(
  'silver-glass-button-strong relative z-10 h-12 w-full rounded-xl text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-zinc-900 dark:text-black',
  'active:scale-[0.99] disabled:opacity-60 transition-all duration-200'
)
