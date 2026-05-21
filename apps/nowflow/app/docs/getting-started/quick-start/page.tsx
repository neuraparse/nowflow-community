import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Quick Start | NowFlow Docs',
  description: 'Create a workspace, design a workflow, and deploy your first automation.',
}

const steps = [
  {
    num: '01',
    title: 'Create a workspace',
    copy: 'Define teams, projects, and permissions. Configure environments, secrets, and shared resources.',
  },
  {
    num: '02',
    title: 'Design a workflow',
    copy: 'Use the visual builder to drag-and-drop blocks and configure each step.',
  },
  {
    num: '03',
    title: 'Deploy and monitor',
    copy: 'Publish as an API, chat experience, or embedded UI. Track logs, metrics, and run history.',
  },
]

const checklist = [
  'Confirm workspace owners, roles, and access policies.',
  'Collect API keys and OAuth credentials for the blocks you plan to use.',
  'Decide the target runtime (API, chat, or embed UI).',
  'Prepare a test dataset or sample input payloads.',
]

const validation = [
  'Validate required inputs for every block before test execution.',
  'Check error handling paths and retries for critical steps.',
  'Review outputs for schema consistency and downstream compatibility.',
  'Enable logging and capture run history for debugging.',
]

const templates = [
  {
    title: 'Customer Support Triage',
    description: 'Ingest tickets, classify intent, and route responses with approvals.',
  },
  {
    title: 'Sales Outreach',
    description: 'Enrich leads, draft messaging, and send via multi-channel sequences.',
  },
  {
    title: 'Data Enrichment',
    description: 'Fetch records, enrich with external sources, and update a CRM.',
  },
]

export default function QuickStartPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo mb-4">
          Getting Started
        </p>
        <h1 className="text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15] mb-3">
          Quick <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Start</span>
        </h1>
        <p className="text-[14px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed max-w-xl">
          Get a production-ready workflow running in minutes. Use this checklist and flow to move
          from setup to deployment without missing the basics.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="relative rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-6"
          >
            <span className="text-[36px] font-serif italic leading-none text-zinc-200/60 dark:text-white/[0.04] select-none pointer-events-none">
              {step.num}
            </span>
            <h2 className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo mt-2 mb-1.5">
              {step.title}
            </h2>
            <p className="text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
              {step.copy}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Pre-flight checklist
        </h2>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              <span className="w-1 h-1 rounded-full bg-[#4A7A68] dark:bg-[#8CB09C] mt-2 shrink-0" />
              <span className="text-[13px] text-zinc-500 dark:text-white/30 font-logo">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Recommended validation
        </h2>
        <ul className="space-y-2">
          {validation.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              <span className="w-1 h-1 rounded-full bg-[#F59E0B] mt-2 shrink-0" />
              <span className="text-[13px] text-zinc-500 dark:text-white/30 font-logo">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Starter workflow ideas
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {templates.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5"
            >
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo mb-1.5">
                {item.title}
              </h3>
              <p className="text-[12px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
