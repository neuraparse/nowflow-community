export default function LandingLoading() {
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

      {/* Hero placeholder */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-24">
        <div className="h-10 w-3/4 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-5 w-1/2 animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-700/70" />
        <div className="mt-4 h-10 w-36 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  )
}
