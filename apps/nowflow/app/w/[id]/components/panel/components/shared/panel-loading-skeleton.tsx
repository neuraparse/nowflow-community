'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PanelLoadingSkeletonProps {
  /** Number of skeleton items to show */
  itemCount?: number
  /** Show header skeleton */
  showHeader?: boolean
  /** Show search bar skeleton */
  showSearch?: boolean
  /** Layout variant */
  variant?: 'card' | 'list' | 'timeline'
  className?: string
}

export function PanelLoadingSkeleton({
  itemCount = 4,
  showHeader = true,
  showSearch = false,
  variant = 'card',
  className,
}: PanelLoadingSkeletonProps) {
  return (
    <div className={cn('workflow-editor-panel-loading h-full flex flex-col', className)}>
      {/* Header Skeleton */}
      {showHeader && (
        <div className="flex-none border-b border-black/[0.06] dark:border-white/[0.06] px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-6 rounded-lg" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-6 rounded-lg" />
              <Skeleton className="h-6 w-6 rounded-lg" />
            </div>
          </div>
          {showSearch && <Skeleton className="h-7 w-full rounded-lg" />}
        </div>
      )}

      {/* Content Skeleton */}
      <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
        {variant === 'card' && (
          <>
            {Array.from({ length: itemCount }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </>
        )}

        {variant === 'list' && (
          <>
            {Array.from({ length: itemCount }).map((_, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3"
              >
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded" />
              </div>
            ))}
          </>
        )}

        {variant === 'timeline' && (
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-4 bottom-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />
            {Array.from({ length: itemCount }).map((_, i) => (
              <div key={i} className="relative flex gap-3 mb-2">
                <Skeleton className="h-2.5 w-2.5 rounded-full z-10 mt-3.5 flex-shrink-0" />
                <div className="flex-1 p-3 rounded-lg border border-black/[0.06] dark:border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
