import { ENTERPRISE_REQUEST_LABEL, ENTERPRISE_URL } from '@/lib/community/enterprise'

export const dynamic = 'force-dynamic'

export default async function ApplicationPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-16 font-logo text-zinc-800 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-[8px] border border-black/[0.08] bg-black/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/55">
          Enterprise
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Application surfaces</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-white/55">
          Hosted application surfaces, password-protected deployment pages, and managed public
          workflow endpoints are available in NowFlow Enterprise.
        </p>
        <a
          href={ENTERPRISE_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-[6px] bg-[#4A7A68] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3d6556]"
        >
          {ENTERPRISE_REQUEST_LABEL}
        </a>
      </section>
    </main>
  )
}
