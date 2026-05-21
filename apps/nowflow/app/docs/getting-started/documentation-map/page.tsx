import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Documentation Map | NowFlow Docs',
  description: 'Navigate the internal documentation structure for NowFlow systems.',
}

const docMap = [
  {
    title: 'Workflow System',
    copy: 'Core workflow architecture, block system, execution runtime, and best practices.',
    href: '/docs/platform/workflow-system',
  },
  {
    title: 'Block Library',
    copy: 'Block registry, toolbox, search, categories, and usage examples.',
    href: '/docs/blocks',
  },
  {
    title: 'Console & History',
    copy: 'Run history, logging, debugging, and performance metrics.',
    href: '/docs/platform/observability',
  },
  {
    title: 'Security & Compliance',
    copy: 'Security fixes, operational safeguards, and compliance notes.',
    href: '/docs/operations/security-compliance',
  },
]

const lifecycleSections = [
  {
    title: 'Plan',
    description: 'Clarify use cases, data sources, and governance requirements.',
  },
  {
    title: 'Build',
    description: 'Design workflows, select blocks, and validate inputs.',
  },
  {
    title: 'Ship',
    description: 'Deploy as API, embed, or chat with monitoring enabled.',
  },
  {
    title: 'Operate',
    description: 'Review run history, tune performance, and manage access.',
  },
]

const teamGuide = [
  {
    title: 'Product Teams',
    description: 'Builder UX, embedded experiences, and iteration cycles.',
    href: '/docs/platform/workflow-system',
  },
  {
    title: 'Engineering Teams',
    description: 'Deployments, integrations, and performance tuning.',
    href: '/docs/platform/deployment',
  },
  {
    title: 'Ops & Support',
    description: 'Observability, governance, and compliance controls.',
    href: '/docs/platform/observability',
  },
  {
    title: 'Security & Compliance',
    description: 'Authentication, access policies, and compliance workflows.',
    href: '/docs/operations/security-compliance',
  },
]

export default function DocumentationMapPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Getting Started
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          Documentation{' '}
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Map</span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          This map mirrors how internal docs are organized, so teams can quickly find the right
          guides for each system area.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {docMap.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-6 transition-all duration-200 hover:border-black/[0.1] dark:hover:border-white/[0.1]"
          >
            <h2 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
              {item.title}
            </h2>
            <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
              {item.copy}
            </p>
            <p className="mt-4 text-[11px] text-zinc-300 dark:text-white/12 font-logo font-semibold uppercase tracking-[0.18em]">
              Open page
            </p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Lifecycle view
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {lifecycleSections.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-4"
            >
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Browse by team
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {teamGuide.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
