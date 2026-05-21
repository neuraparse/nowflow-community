export default function WorkflowEditorLoading() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Top control bar skeleton */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-900/50">
        {/* Dot grid hint */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
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

      {/* Bottom toolbar skeleton */}
      <div className="flex h-12 items-center justify-center gap-2 border-t border-zinc-200 px-4 dark:border-zinc-800">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        ))}
      </div>
    </div>
  )
}
