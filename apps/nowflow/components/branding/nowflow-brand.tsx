import * as React from 'react'
import { NowFlowLogoMark } from '@/components/branding/nowflow-logo-mark'
import { cn } from '@/lib/utils'

type BrandSize = 'sm' | 'md' | 'lg'

const markShellSizes: Record<BrandSize, string> = {
  sm: 'rounded-2xl p-1.5',
  md: 'rounded-2xl p-2',
  lg: 'rounded-[1.35rem] p-2.5',
}

const markSizes: Record<BrandSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const wordmarkSizes: Record<BrandSize, string> = {
  sm: 'text-[16px]',
  md: 'text-[24px]',
  lg: 'text-[28px]',
}

const subtitleSizes: Record<BrandSize, string> = {
  sm: 'text-[10px] tracking-[0.16em]',
  md: 'text-[11px] tracking-[0.18em]',
  lg: 'text-[11px] tracking-[0.2em]',
}

type NowFlowWordmarkProps = {
  className?: string
  size?: BrandSize
}

export function NowFlowWordmark({ className, size = 'md' }: NowFlowWordmarkProps) {
  return (
    <span
      className={cn(
        'font-logo font-medium leading-none tracking-[-0.03em]',
        wordmarkSizes[size],
        className
      )}
    >
      <span className="text-zinc-800 dark:text-white">Now</span>
      <span className="bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#7fa696] bg-clip-text text-transparent dark:from-[#a5c9b7] dark:via-[#92b9a7] dark:to-[#bdd8cb]">
        Flow
      </span>
    </span>
  )
}

type NowFlowBrandLockupProps = {
  badge?: React.ReactNode
  className?: string
  markClassName?: string
  markIdPrefix?: string
  markRef?: React.Ref<SVGSVGElement>
  showShell?: boolean
  showSubtitle?: boolean
  size?: BrandSize
  subtitle?: string
  subtitleClassName?: string
  wordmarkClassName?: string
}

export function NowFlowBrandLockup({
  badge,
  className,
  markClassName,
  markIdPrefix = 'nowflow-brand',
  markRef,
  showShell = true,
  showSubtitle = false,
  size = 'md',
  subtitle = 'Agentic Workflow Platform',
  subtitleClassName,
  wordmarkClassName,
}: NowFlowBrandLockupProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', className)}>
      <div className="group/logo relative flex shrink-0 items-center justify-center rounded-2xl p-2.5 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]">
        <div
          className="absolute -inset-[1px] rounded-[17px] opacity-25 transition-opacity duration-500 group-hover/logo:opacity-45"
          style={{
            background:
              'conic-gradient(from var(--border-angle, 0deg), transparent 0%, var(--ody-signal-coral, #ff7a59) 14%, var(--ody-signal-violet, #802fff) 34%, transparent 48%, var(--ody-signal-amber, #ff972f) 68%, var(--ody-signal-cyan, #00a1e0) 84%, transparent 100%)',
            animation: 'border-spin 6s linear infinite',
          }}
        />
        <div
          className={cn(
            showShell
              ? 'silver-glass-pane relative z-10 shadow-[0_10px_28px_rgba(24,24,27,0.08)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.24)]'
              : 'relative z-10',
            markShellSizes[size]
          )}
        >
          <div className="relative flex items-center justify-center">
            <NowFlowLogoMark
              ref={markRef}
              className={cn(markSizes[size], markClassName)}
              idPrefix={markIdPrefix}
            />
            {badge ? <div className="absolute -bottom-1.5 -right-1.5">{badge}</div> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <NowFlowWordmark className={wordmarkClassName} size={size} />
        {showSubtitle ? (
          <p
            className={cn(
              'font-logo font-medium uppercase text-zinc-400 dark:text-white/25',
              subtitleSizes[size],
              subtitleClassName
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}
