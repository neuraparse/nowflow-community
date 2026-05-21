'use client'

import { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface BlockContentSectionProps {
  title: string
  description?: string
  children: ReactNode
  defaultOpen?: boolean
  icon?: ReactNode
  className?: string
}

export function BlockContentSection({
  title,
  description,
  children,
  defaultOpen = true,
  icon,
  className,
}: BlockContentSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        'rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] overflow-hidden transform-gpu transition-all duration-300',
        className
      )}
      style={{
        willChange: 'transform, opacity',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-[12px] font-logo font-semibold hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-all duration-300 group">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="text-[#4A7A68] dark:text-[#94B8A6] p-1.5 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] group-hover:bg-[#4A7A68]/[0.12] dark:group-hover:bg-[#94B8A6]/[0.15] transition-colors duration-300">
              {icon}
            </div>
          )}
          <div>
            <div className="text-left font-logo font-semibold text-black/80 dark:text-white/90">
              {title}
            </div>
            {description && (
              <div className="text-[11px] font-logo text-black/40 dark:text-white/50 mt-0.5 leading-relaxed">
                {description}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 text-black/30 dark:text-white/40 transition-all duration-300 ui-open:rotate-180 group-hover:text-black/60 dark:group-hover:text-white/70"
          strokeWidth={1.5}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-2 text-sm">
        <div className="space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
