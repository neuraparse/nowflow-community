import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Deployment | NowFlow Docs',
  description: 'Deploy workflows as APIs, embeds, or chat experiences with version control.',
}

const deploymentSurfaces = [
  {
    title: 'API endpoints',
    description: 'Expose workflows as versioned HTTP APIs with schema validation and auth.',
  },
  {
    title: 'Embedded experiences',
    description: 'Ship guided UI embeds with prefilled inputs, theming, and guardrails.',
  },
  {
    title: 'Chat experiences',
    description: 'Deliver conversational flows with response templates and moderation.',
  },
  {
    title: 'Batch and webhooks',
    description: 'Trigger workflows on schedules or event streams with delivery guarantees.',
  },
]

const releasePipeline = [
  'Create a release branch and lock inputs to a stable contract.',
  'Run staging executions with synthetic and real payloads.',
  'Tag a version, publish to the target environment, and enable monitoring.',
  'Promote to production and watch early run quality and costs.',
]

const environmentStrategy = [
  {
    title: 'Environment isolation',
    description: 'Separate secrets, providers, and rate limits for dev, staging, and prod.',
  },
  {
    title: 'Version pinning',
    description: 'Pin model versions and block revisions to avoid drift on deployments.',
  },
  {
    title: 'Rollback safety',
    description: 'Keep a last-known-good release ready for one-click rollback.',
  },
]

const operationalGuardrails = [
  'Authentication and RBAC on every endpoint.',
  'Schema validation with consistent error payloads.',
  'Rate limits, concurrency caps, and cost budgets.',
  'Timeouts, retries, and circuit breakers for external calls.',
  'PII redaction and log sampling for sensitive runs.',
  'Audit trails for publish, rollout, and rollback actions.',
]

const readinessChecklist = [
  'All required secrets and OAuth providers are configured.',
  'Integration credentials are scoped with least privilege.',
  'Monitoring dashboards and alert thresholds are in place.',
  'Runbooks define rollback, hotfix, and escalation steps.',
  'Stakeholders validated output quality and formats.',
]

export default function DeploymentPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Platform
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Deployment</span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Deploy workflows safely with versioned releases, rollback-ready environments, and
          observability baked into every run.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Deployment surfaces
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {deploymentSurfaces.map((item) => (
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
          Release pipeline
        </h2>
        <ol className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {releasePipeline.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {environmentStrategy.map((item) => (
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
          Operational guardrails
        </h2>
        <div className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed md:grid-cols-2">
          {operationalGuardrails.map((item) => (
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
          Launch readiness checklist
        </h2>
        <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {readinessChecklist.map((item) => (
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
