import { cn } from '@/lib/utils'

type WorkspaceLoadingSkeletonProps = {
  columns?: 1 | 2 | 3 | 4
  rows?: number
  className?: string
  cardClassName?: string
}

const columnClass: Record<1 | 2 | 3 | 4, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
}

export function WorkspaceLoadingSkeleton({
  columns = 4,
  rows = 4,
  className,
  cardClassName,
}: WorkspaceLoadingSkeletonProps) {
  const count = rows
  return (
    <div className={cn('grid gap-4', columnClass[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'silver-glass-panel h-24 rounded-xl bg-transparent animate-pulse',
            cardClassName
          )}
        />
      ))}
    </div>
  )
}
