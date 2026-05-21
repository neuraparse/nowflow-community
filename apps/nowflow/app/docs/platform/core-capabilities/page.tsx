import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Core Capabilities | NowFlow Docs',
  description: 'Understand the core platform capabilities and typical use cases.',
}

const capabilities = [
  'Extensible integrations and community-ready blocks for common workflow systems.',
  'Agentic orchestration with reasoning, evaluation, multi-agent, RAG, and autonomous blocks.',
  'Centralized runtime with versioning, rollback, monitoring, and secure deployment flows.',
  'Governance with role-based access, audit trails, secrets management, and compliance controls.',
]

const useCases = [
  {
    title: 'Customer Ops',
    copy: 'Support triage, multi-channel responses, ticket enrichment, and QA escalation flows.',
  },
  {
    title: 'Revenue Ops',
    copy: 'Lead scoring, outreach sequencing, onboarding automation, and pipeline health alerts.',
  },
  {
    title: 'Product Teams',
    copy: 'Agent orchestration, knowledge ingestion, dynamic UI embeds, and product copilots.',
  },
  {
    title: 'Enterprise',
    copy: 'On-prem runtime, compliance logging, region-based deployment, and audit readiness.',
  },
]

const capabilityPillars = [
  {
    title: 'Workflow Orchestration',
    description: 'Design and manage complex flows with conditions, loops, and routing.',
  },
  {
    title: 'Agentic Intelligence',
    description: 'Combine reasoning, evaluation, and tool use with multi-agent coordination.',
  },
  {
    title: 'Enterprise Runtime',
    description: 'Control environments, version releases, and compliance requirements.',
  },
  {
    title: 'Integration Network',
    description: 'Connect to data sources, SaaS tools, and custom APIs at scale.',
  },
]

const evaluationMetrics = [
  'Execution latency per workflow step.',
  'Success rate and retry frequency by block.',
  'Token usage and model cost by run.',
  'User-visible response quality and coverage.',
]

export default function CoreCapabilitiesPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Platform
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          Core{' '}
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Capabilities</span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          The NowFlow platform combines workflow orchestration, governance, and deployment tooling
          so teams can ship automation safely and at scale.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {capabilities.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed"
          >
            {item}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Capability pillars
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {capabilityPillars.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5"
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
          Use cases
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {useCases.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5"
            >
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          What to measure
        </h2>
        <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {evaluationMetrics.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
