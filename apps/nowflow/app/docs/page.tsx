import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Boxes, Rocket, Shield, Users, Workflow } from 'lucide-react'
import { registry } from '@/blocks/registry'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'NowFlow Docs',
  description:
    'NowFlow documentation hub: guides, platform capabilities, deployment, and the full block catalog.',
}

const blocks = Object.values(registry)

const quickLinks = [
  {
    title: 'Quick Start',
    description: 'Spin up a workspace, design your first workflow, and ship it fast.',
    href: '/docs/getting-started/quick-start',
    icon: Rocket,
  },
  {
    title: 'Documentation Map',
    description: 'See how docs are organized across workflow, builder, and platform systems.',
    href: '/docs/getting-started/documentation-map',
    icon: BookOpen,
  },
  {
    title: 'Deployment',
    description: 'Release workflows as APIs, embeds, or chat experiences.',
    href: '/docs/platform/deployment',
    icon: Workflow,
  },
]

const sectionCards = [
  {
    title: 'Platform Guides',
    description: 'Capabilities, resources, observability, and runtime behavior.',
    href: '/docs/platform/core-capabilities',
    hex: '#4A7A68',
  },
  {
    title: 'Operations',
    description: 'Security, authentication, and workspace access flows.',
    href: '/docs/operations/security-compliance',
    hex: '#F59E0B',
  },
  {
    title: 'Blocks Catalog',
    description: `${blocks.length} blocks with detailed usage, inputs, and configuration tips.`,
    href: '/docs/blocks',
    hex: '#6366F1',
  },
]

const onboardingSteps = [
  {
    num: '01',
    title: 'Define your goal',
    description: 'Clarify the outcome, success metrics, and data sources your workflow will use.',
  },
  {
    num: '02',
    title: 'Design the workflow',
    description: 'Choose blocks, add conditions, and validate inputs before running a test.',
  },
  {
    num: '03',
    title: 'Deploy with guardrails',
    description: 'Publish as API, chat, or embed UI and enable monitoring and rollback.',
  },
]

const rolePaths = [
  {
    title: 'Product & Design',
    description: 'Focus on builder UX, embedded experiences, and iterative testing.',
    href: '/docs/platform/workflow-system',
    icon: Users,
  },
  {
    title: 'Engineering',
    description: 'Prioritize integrations, APIs, deployment, and observability.',
    href: '/docs/platform/deployment',
    icon: Boxes,
  },
  {
    title: 'Ops & Support',
    description: 'Scale workflows safely with audit trails and operational controls.',
    href: '/docs/operations/security-compliance',
    icon: Workflow,
  },
  {
    title: 'Security & Compliance',
    description: 'Manage access policies, audits, and compliance requirements.',
    href: '/docs/operations/security-compliance',
    icon: Shield,
  },
]

export default function DocsHomePage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="silver-glass-panel signal-accent-frame rounded-[18px] p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="signal-accent-chip mb-4 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5">
              <span
                className="h-1.5 w-1.5 rounded-[2px]"
                style={{
                  background:
                    'linear-gradient(135deg, var(--ody-signal-coral, #ff7a59) 0%, var(--ody-signal-violet, #802fff) 52%, var(--ody-signal-cyan, #00a1e0) 100%)',
                }}
              />
              <span className="font-logo text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-white/38">
                NowFlow Documentation
              </span>
            </div>
            <h1 className="font-logo text-3xl font-light leading-[1.08] tracking-tight text-zinc-800 dark:text-white sm:text-4xl lg:text-[3.35rem]">
              Product docs with a more{' '}
              <span className="font-serif italic bg-[var(--ody-signal-line-soft)] bg-clip-text text-transparent">
                guided flow
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-zinc-500 dark:text-white/42 font-logo sm:text-[15px]">
              Navigate platform guides, block references, and deployment instructions in the same
              silver-glass system as the landing experience.
            </p>
          </div>

          <div className="silver-glass-pane min-w-[220px] rounded-[14px] p-4 sm:p-5">
            <p className="font-logo text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-white/24">
              Coverage
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="font-logo text-2xl font-light text-zinc-800 dark:text-white">
                  {blocks.length}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-white/38 font-logo">
                  Blocks documented
                </p>
              </div>
              <div>
                <div className="font-logo text-2xl font-light text-zinc-800 dark:text-white">3</div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-white/38 font-logo">
                  Core tracks
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="silver-glass-pane group rounded-[14px] p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,rgba(255,122,89,0.12),rgba(128,47,255,0.08)_48%,rgba(0,161,224,0.12))]">
                <item.icon
                  className="h-4 w-4 text-[#6b5df6] dark:text-[#9ea6ff]"
                  strokeWidth={1.8}
                />
              </div>
              <h2 className="font-logo text-[15px] font-semibold text-zinc-800 transition-colors duration-200 group-hover:text-[#6b5df6] dark:text-white dark:group-hover:text-[#9ea6ff]">
                {item.title}
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-white/40 font-logo">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="silver-glass-panel rounded-[18px] p-5 sm:p-7 lg:p-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-logo text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-white/24">
              Getting Started
            </p>
            <h2 className="mt-2 font-logo text-xl font-semibold tracking-tight text-zinc-800 dark:text-white sm:text-2xl">
              Three steps to production
            </h2>
          </div>
          <span className="silver-glass-chip hidden rounded-[10px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/34 font-logo sm:inline-flex">
            Guide Flow
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {onboardingSteps.map((item) => (
            <div key={item.title} className="silver-glass-pane relative rounded-[14px] p-5">
              <span className="pointer-events-none select-none font-serif text-[38px] italic leading-none text-zinc-300/60 dark:text-white/[0.06]">
                {item.num}
              </span>
              <h3 className="mt-3 font-logo text-[15px] font-semibold text-zinc-800 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-white/40 font-logo">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {sectionCards.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="silver-glass-panel group rounded-[16px] p-5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div
              className="mb-4 h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,122,89,0.7) 0%, rgba(128,47,255,0.55) 34%, rgba(255,151,47,0.5) 68%, rgba(0,161,224,0.55) 100%)',
              }}
            />
            <h2 className="font-logo text-[16px] font-semibold text-zinc-800 transition-colors duration-200 group-hover:text-[#6b5df6] dark:text-white dark:group-hover:text-[#9ea6ff]">
              {item.title}
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-white/40 font-logo">
              {item.description}
            </p>
            <ArrowRight className="mt-5 h-4 w-4 text-zinc-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#6b5df6] dark:text-white/24 dark:group-hover:text-[#9ea6ff]" />
          </Link>
        ))}
      </div>

      <section className="silver-glass-panel rounded-[18px] p-5 sm:p-7 lg:p-8">
        <p className="font-logo text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-white/24">
          By Role
        </p>
        <h2 className="mt-2 font-logo text-xl font-semibold tracking-tight text-zinc-800 dark:text-white sm:text-2xl">
          Pick your path
        </h2>
        <p className="mt-2 text-[13px] text-zinc-500 dark:text-white/40 font-logo">
          Choose the guide set that matches your role and project scope.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {rolePaths.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="silver-glass-pane group flex items-start gap-4 rounded-[14px] p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,rgba(255,122,89,0.12),rgba(128,47,255,0.08)_48%,rgba(0,161,224,0.12))]">
                <item.icon className="h-4 w-4 text-zinc-500 dark:text-white/42" strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="font-logo text-[14px] font-semibold text-zinc-800 transition-colors duration-200 group-hover:text-[#6b5df6] dark:text-white dark:group-hover:text-[#9ea6ff]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-white/40 font-logo">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
