import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Security & Compliance | NowFlow Docs',
  description: 'Security practices, compliance guardrails, and operational safeguards.',
}

const securityPillars = [
  {
    title: 'Identity and access',
    description:
      'Session controls, role-aware permissions, and upgrade paths for managed identity.',
  },
  {
    title: 'Data protection',
    description: 'Encryption, redaction, and retention policies for sensitive data.',
  },
  {
    title: 'Network controls',
    description:
      'Self-hosted network control, with private deployment options available separately.',
  },
  {
    title: 'Auditability',
    description: 'Change history, approvals, and execution trails.',
  },
]

const complianceWorkflow = [
  'Tag workflows with data classification and regulatory scope.',
  'Attach evidence and approvals before managed releases.',
  'Run eval suites for regulated or customer-facing outputs.',
  'Export audit packages for internal or external reviews.',
]

const dataProtections = [
  'Field-level redaction rules for logs and exports.',
  'Credential storage with scoped access.',
  'PII detection during ingestion and retrieval.',
  'Retention windows per workspace and workflow.',
]

const operationalControls = [
  {
    title: 'Emergency stop',
    description: 'Disable workflows or blocks instantly if risk is detected.',
  },
  {
    title: 'Approval gates',
    description: 'Require sign-off for risky changes and deployments.',
  },
  {
    title: 'Execution limits',
    description: 'Cap concurrency, cost, and rate at the workspace level.',
  },
  {
    title: 'Scoped sharing',
    description: 'Restrict access by team, project, or data tier.',
  },
]

const auditArtifacts = [
  'Workflow change history and version diffs.',
  'Execution logs with timestamps and operator metadata.',
  'Access events and permission updates.',
  'Compliance tags and review outcomes.',
]

export default function SecurityCompliancePage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Operations
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          Security &{' '}
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Compliance</span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Keep workflows secure with policy-driven access controls, audit trails, and compliance
          documentation tailored for regulated environments.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Security pillars
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {securityPillars.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5"
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
          Compliance workflow
        </h2>
        <ol className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {complianceWorkflow.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {operationalControls.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5"
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

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Data protection controls
        </h2>
        <div className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed md:grid-cols-2">
          {dataProtections.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Audit artifacts
        </h2>
        <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {auditArtifacts.map((item) => (
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
