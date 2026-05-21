import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { registry } from '@/blocks/registry'
import { getCategoryLabel } from '../block-helpers'

export const dynamic = 'force-dynamic'

interface BlockDetailPageProps {
  params: Promise<{ blockType: string }> | { blockType: string }
}

export async function generateMetadata({ params }: BlockDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const blockType = resolvedParams?.blockType ?? ''
  const block = registry[blockType]
  if (!block) {
    return { title: 'Block Not Found | NowFlow Docs' }
  }

  return {
    title: `${block.name || block.type} | NowFlow Blocks`,
    description: block.description || `Details and usage for the ${block.type} block.`,
  }
}

const buildUsageSteps = (blockType: string, hasOAuth: boolean, hasInputs: boolean) => {
  const steps = [
    'Add the block to your workflow and connect it to the upstream step.',
    hasOAuth
      ? 'Connect the required credentials or OAuth provider before running.'
      : 'Configure any required credentials or tokens in the inputs.',
    hasInputs
      ? 'Fill in required inputs and optional parameters for the run.'
      : 'Confirm default settings or add optional inputs as needed.',
    'Run a test execution, inspect outputs, and iterate before deploying.',
    `Deploy the ${blockType} block with monitoring enabled in production.`,
  ]

  return steps
}

export default async function BlockDetailPage({ params }: BlockDetailPageProps) {
  const resolvedParams = await params
  const blockType = resolvedParams?.blockType ?? ''
  const block = registry[blockType]
  if (!block) {
    notFound()
  }

  const categoryLabel = getCategoryLabel(block.category)
  const subBlocks = block.subBlocks ?? []
  const hasOAuth = subBlocks.some((subBlock) => subBlock.type === 'oauth-input')
  const usageSteps = buildUsageSteps(block.type, hasOAuth, subBlocks.length > 0)
  const responseType = block.outputs?.response?.type ?? 'json'
  const responseTypeLabel =
    typeof responseType === 'string' ? responseType : JSON.stringify(responseType, null, 2)
  const Icon = block.icon
  const dependsOn = block.outputs?.response?.dependsOn

  const inputs = block.inputs ? Object.entries(block.inputs) : []
  const toolAccess = block.tools?.access ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <Link
            href="/docs/blocks"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15 font-logo hover:text-[#4A7A68] dark:hover:text-[#8CB09C] transition-colors duration-200 group"
          >
            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            Catalog
          </Link>
        </div>

        <div className="flex items-start gap-5 mb-5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ backgroundColor: `${block.bgColor || '#4A7A68'}15` }}
          >
            {Icon ? (
              <Icon className="h-5 w-5 text-zinc-600 dark:text-white/40" />
            ) : (
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-400 dark:text-white/40 font-logo">
                NF
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
              {block.name || block.type}
            </h1>
            <p className="text-[13px] text-zinc-400 dark:text-white/40 font-logo mt-1 leading-relaxed max-w-lg">
              {block.description}
            </p>
            {block.longDescription && (
              <p className="text-[12px] text-zinc-300 dark:text-white/15 font-logo mt-1">
                {block.longDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[10px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15">
            {categoryLabel}
          </span>
          <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[10px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15">
            {block.type}
          </span>
          {block.version && (
            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[10px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15">
              {block.version}
            </span>
          )}
          {block.supportsCode && (
            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[10px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15">
              Code
            </span>
          )}
          {block.supportsPerformance && (
            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[10px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/15">
              Performance
            </span>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Usage
        </h2>
        <ol className="space-y-2">
          {usageSteps.map((step, i) => (
            <li
              key={step}
              className="flex items-start gap-3 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3"
            >
              <span className="text-[11px] font-serif italic text-zinc-300 dark:text-white/10 mt-0.5 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[13px] text-zinc-500 dark:text-white/30 font-logo">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Inputs (UI) */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Inputs (UI)
        </h2>
        {subBlocks.length === 0 ? (
          <p className="text-[13px] text-zinc-400 dark:text-white/40 font-logo">
            This block does not define UI inputs.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subBlocks.map((subBlock, index) => (
              <div
                key={`${block.type}-${subBlock.id}-${index}`}
                className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[13px] font-semibold text-zinc-700 dark:text-white/50 font-logo">
                    {subBlock.title || subBlock.id}
                  </h3>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/10 font-logo">
                    {subBlock.type}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-400 dark:text-white/40 font-logo">
                  {subBlock.description && <p>{subBlock.description}</p>}
                  {subBlock.placeholder && <p>Placeholder: {subBlock.placeholder}</p>}
                  {subBlock.layout && <p>Layout: {subBlock.layout}</p>}
                  {subBlock.provider && <p>Provider: {subBlock.provider}</p>}
                  {subBlock.validation?.required && <p className="text-[#F59E0B]">Required</p>}
                  {subBlock.hidden && <p>Hidden by default</p>}
                  {subBlock.condition && (
                    <p>
                      Condition: {subBlock.condition.field} ={' '}
                      {JSON.stringify(subBlock.condition.value)}
                      {subBlock.condition.and && (
                        <>
                          {' '}
                          AND {subBlock.condition.and.field} ={' '}
                          {JSON.stringify(subBlock.condition.and.value)}
                        </>
                      )}
                    </p>
                  )}
                  {subBlock.options && (
                    <p>
                      Options:{' '}
                      {Array.isArray(subBlock.options)
                        ? subBlock.options
                            .slice(0, 4)
                            .map((option) =>
                              typeof option === 'string' ||
                              typeof option === 'number' ||
                              typeof option === 'boolean'
                                ? option
                                : option.label
                            )
                            .join(', ')
                        : 'Dynamic options'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inputs (API) */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
          Inputs (API)
        </h2>
        {inputs.length === 0 ? (
          <p className="text-[13px] text-zinc-400 dark:text-white/40 font-logo">
            This block does not expose API parameters.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {inputs.map(([key, config]) => (
              <div
                key={key}
                className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[13px] font-semibold text-zinc-700 dark:text-white/50 font-logo">
                    {key}
                  </h3>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/10 font-logo">
                    {config.type}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-400 dark:text-white/40 font-logo">
                  <p>
                    {config.required ? (
                      <span className="text-[#F59E0B]">Required</span>
                    ) : (
                      'Optional'
                    )}
                  </p>
                  {config.requiredForToolCall && <p>Required for tool calls</p>}
                  {config.description && <p>{config.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Outputs */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-4">
          Outputs
        </h2>
        <p className="text-[12px] text-zinc-400 dark:text-white/40 font-logo mb-3">
          Primary response type:
        </p>
        <pre className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-4 text-[12px] font-mono text-zinc-500 dark:text-white/30 overflow-x-auto">
          {responseTypeLabel}
        </pre>
        {dependsOn && (
          <div className="mt-4 text-[11px] text-zinc-300 dark:text-white/15 font-logo space-y-1">
            <p>Conditional output based on: {dependsOn.subBlockId}</p>
            <p>
              When empty: {JSON.stringify(dependsOn.condition?.whenEmpty ?? 'json')} | When filled:{' '}
              {JSON.stringify(dependsOn.condition?.whenFilled ?? 'json')}
            </p>
          </div>
        )}
        {block.outputs?.response?.visualization && (
          <p className="mt-3 text-[11px] text-zinc-300 dark:text-white/15 font-logo">
            Visualization: {block.outputs.response.visualization.type}
          </p>
        )}
      </section>

      {/* Tool Access */}
      {toolAccess.length > 0 && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
          <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-4">
            Tool Access
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {toolAccess.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[11px] font-logo font-medium text-zinc-400 dark:text-white/40"
              >
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Compliance */}
      {block.compliance?.enabled && (
        <section className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/[0.03] dark:border-[#F59E0B]/10 dark:bg-[#F59E0B]/[0.02] p-7 sm:p-9">
          <h2 className="text-lg font-logo font-semibold text-[#92400E] dark:text-[#FDE68A] tracking-tight mb-3">
            Compliance Notice
          </h2>
          <p className="text-[13px] text-[#92400E]/80 dark:text-[#FDE68A]/60 font-logo leading-relaxed">
            {block.compliance.disclaimer}
          </p>
          {block.compliance.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {block.compliance.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/[0.05] px-3 py-1 text-[11px] font-logo font-medium text-[#92400E] dark:text-[#FDE68A]/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Examples */}
      {block.examples && block.examples.length > 0 && (
        <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
          <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight mb-5">
            Examples
          </h2>
          <div className="space-y-4">
            {block.examples.map((example) => (
              <div
                key={example.title}
                className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5"
              >
                <h3 className="text-[13px] font-semibold text-zinc-700 dark:text-white/50 font-logo mb-1">
                  {example.title}
                </h3>
                <p className="text-[12px] text-zinc-400 dark:text-white/40 font-logo mb-3">
                  {example.description}
                </p>
                <pre className="rounded-lg border border-black/[0.04] dark:border-white/[0.04] bg-white dark:bg-white/[0.01] p-3 text-[11px] font-mono text-zinc-500 dark:text-white/30 overflow-x-auto">
                  {JSON.stringify(example.params, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
