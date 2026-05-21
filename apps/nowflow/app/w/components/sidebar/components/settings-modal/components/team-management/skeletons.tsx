import { Skeleton } from '@/components/ui/skeleton'

// Skeleton component for team management loading state
export function TeamManagementSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="space-y-4">
        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 dark:border-white/[0.08]">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent p-4 dark:border-white/[0.08]">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between mt-4">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>

        <div className="silver-glass-pane rounded-lg border border-black/[0.06] bg-transparent dark:border-white/[0.08]">
          <Skeleton className="h-5 w-32 p-4 border-b" />
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-9 w-9" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Skeleton component for loading state in buttons
export function ButtonSkeleton() {
  return <Skeleton className="h-9 w-24" />
}

// Skeleton component for loading state in team seats
export function TeamSeatsSkeleton() {
  return (
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}
