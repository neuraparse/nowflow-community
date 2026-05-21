import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workflow System | NowFlow Docs',
  description: 'Understand workflow structure, execution, and runtime controls.',
}

const systemHighlights = [
  'Workflow graph structure, block orchestration, and edge connections.',
  'Execution runtime with caching, retries, and evaluation layers.',
  'State management, versioning, and autosave behavior.',
  'Monitoring hooks, run history, and debugging entry points.',
]

const buildChecklist = [
  'Define the trigger and expected output for the workflow.',
  'Model the workflow using blocks, conditions, and loops.',
  'Validate each block output against downstream inputs.',
  'Run test executions and confirm error handling behavior.',
]

const coreObjects = [
  {
    title: 'Workflow',
    description: 'A connected graph of blocks representing the full automation.',
  },
  {
    title: 'Block',
    description: 'A single operation, integration, or AI action with inputs and outputs.',
  },
  {
    title: 'Edge',
    description: 'The connection that passes data and control between blocks.',
  },
  {
    title: 'Run',
    description: 'A single execution instance with logs, outputs, and timing.',
  },
]

const lifecycle = [
  'Initialize inputs and resolve credentials.',
  'Execute blocks in dependency order with retries.',
  'Collect outputs, evaluations, and intermediate states.',
  'Persist run history and surface metrics.',
]

const failureHandling = [
  'Define fallback paths for critical integrations.',
  'Use evaluators to detect invalid outputs early.',
  'Capture errors and isolate failing blocks for replay.',
  'Apply versioned releases and rollback when needed.',
]

export default function WorkflowSystemPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
          Platform
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          Workflow{' '}
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">System</span>
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          The workflow system powers orchestration, execution, and governance across NowFlow. Use
          this page to align architecture, runtime expectations, and rollout practices.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {systemHighlights.map((item) => (
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
          Core objects
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {coreObjects.map((item) => (
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
          Execution lifecycle
        </h2>
        <ol className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {lifecycle.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Build checklist
        </h2>
        <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {buildChecklist.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Failure handling
        </h2>
        <ul className="mt-4 grid gap-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          {failureHandling.map((item) => (
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
