'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { NowFlowBrandLockup } from '@/components/branding/nowflow-brand'
import { cn } from '@/lib/utils'
import { ForceDark } from '@/app/force-dark'

export function AuthShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        'dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden',
        'odyssey-landing community-ui-framework community-ui-landing community-ui-auth bg-[#f3f3f1] dark:bg-[#0A0A0A] font-body',
        'px-4 py-8 sm:px-6 sm:py-10',
        className
      )}
    >
      <ForceDark />
      <div aria-hidden="true" className="community-ui-scene-backdrop" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div className="silver-glass-chip mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4A7A68] dark:bg-[#9bc8b3]" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Secure Access
            </span>
          </div>

          <Link href="/" className="focus-visible:outline-none" aria-label="Go to homepage">
            <NowFlowBrandLockup
              markIdPrefix="auth-nowflow"
              showSubtitle
              size="md"
              wordmarkClassName="font-light"
            />
          </Link>
        </div>

        {children}
      </div>
    </main>
  )
}
