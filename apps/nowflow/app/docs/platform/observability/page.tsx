import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Observability | NowFlow Docs',
  description: 'Track run history, logs, and performance metrics across workflows.',
}

const runInsights = [
  {
    title: 'Run timelines',
    description: 'Step-by-step execution history with inputs and outputs.',
  },
  {
    title: 'Error tracing',
    description: 'Stack traces, retries, and failure snapshots per block.',
  },
  {
    title: 'Cost and usage',
    description: 'Token, provider cost, and time spent per workflow.',
  },
  {
    title: 'Quality signals',
    description: 'Human ratings, eval scores, and regression tracking.',
  },
]

const metricsFocus = [
  'Latency p50/p95 per block and per workflow.',
  'Failure rate by dependency and provider.',
  'Token usage, cache hit ratio, and cost budgets.',
  'Queue depth, concurrency saturation, and timeouts.',
]

const debugToolkit = [
  'Replay executions with the same inputs.',
  'Compare outputs across versions or providers.',
  'Inspect intermediate state and block payloads.',
  'Export logs and evidence for incident review.',
]

const alertingGuides = [
  {
    title: 'SLO definitions',
    description: 'Set success, latency, and cost budgets per workflow.',
  },
  {
    title: 'Alert routing',
    description: 'Send alerts to Slack, PagerDuty, or email escalation paths.',
  },
  {
    title: 'Release monitoring',
    description: 'Track early-run quality for new deployments.',
  },
]

const optimizationLoop = [
  'Identify slow or costly blocks using run history.',
  'Enable caching or parallelization where safe.',
  'Tune prompts, providers, and tool timeouts.',
  'Deploy changes and watch metrics for improvement.',
]

export default function ObservabilityPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Platform
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">
            Observability
          </span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Monitor workflow health with run history, logs, and metrics designed for debugging and
          performance tuning.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Run insights
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {runInsights.map((item) => (
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
          Metrics to monitor
        </h2>
        <div className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed md:grid-cols-2">
          {metricsFocus.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {alertingGuides.map((item) => (
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
          Debugging toolkit
        </h2>
        <div className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed md:grid-cols-2">
          {debugToolkit.map((item) => (
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
          Optimization loop
        </h2>
        <ol className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {optimizationLoop.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
