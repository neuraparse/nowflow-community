export default function WorkspaceLoading() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="flex h-screen w-[52px] flex-col items-center gap-3 border-r border-zinc-200 bg-zinc-50 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
            />
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 items-center justify-center">
        <svg
          className="h-6 w-6 animate-spin text-zinc-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>
  )
}
