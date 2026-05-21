export default function DocsLoading() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#0A0A0A]">
      {/* Nav placeholder */}
      <div className="h-16 w-full border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <div className="h-7 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex gap-4">
            <div className="h-8 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>

      {/* Content area */}
      <section className="mx-auto w-full max-w-[1220px] px-4 pt-30 sm:px-6 lg:px-8 lg:pt-38">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          {/* Sidebar skeleton */}
          <aside className="hidden lg:block">
            <div className="space-y-3 rounded-[28px] border border-zinc-200/50 bg-white/60 p-5 dark:border-zinc-700/50 dark:bg-zinc-800/40">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
                  style={{ width: `${60 + Math.random() * 35}%` }}
                />
              ))}
            </div>
          </aside>

          {/* Content skeleton */}
          <div className="space-y-4 rounded-[28px] border border-zinc-200/50 bg-white/60 p-6 dark:border-zinc-700/50 dark:bg-zinc-800/40 lg:p-8">
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="space-y-2 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-700/70"
                  style={{ width: `${70 + Math.random() * 30}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
