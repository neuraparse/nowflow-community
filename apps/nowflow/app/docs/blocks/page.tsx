import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { registry } from '@/blocks/registry'
import { categoryOrder, getCategoryLabel } from './block-helpers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blocks Catalog | NowFlow Docs',
  description: 'Browse every NowFlow block with detailed inputs and usage guidance.',
}

interface BlocksCatalogPageProps {
  searchParams?:
    | Promise<{
        q?: string
        category?: string
        view?: string
        sort?: string
        oauth?: string
        examples?: string
        code?: string
        performance?: string
      }>
    | {
        q?: string
        category?: string
        view?: string
        sort?: string
        oauth?: string
        examples?: string
        code?: string
        performance?: string
      }
}

type ViewMode = 'cards' | 'compact'

type SortMode = 'name' | 'inputs' | 'outputs'

const blocks = Object.values(registry)

const categoryCounts = blocks.reduce<Record<string, number>>((acc, block) => {
  const category = block.category ?? 'blocks'
  acc[category] = (acc[category] ?? 0) + 1
  return acc
}, {})

const categoryList = [
  ...categoryOrder.filter((category) => categoryCounts[category]),
  ...Object.keys(categoryCounts)
    .filter((category) => !categoryOrder.includes(category))
    .sort((a, b) => a.localeCompare(b)),
]

const categoryDescriptions: Record<string, string> = {
  agents: 'Reasoning agents, evaluators, and multi-agent coordination.',
  tools: 'Utility blocks for parsing, transforms, and execution helpers.',
  integrations: 'Connect SaaS systems, CRMs, and external APIs.',
  data: 'Storage, database, and analytics blocks.',
  blocks: 'Core workflow utilities and control flow blocks.',
}

const categoryColors: Record<string, string> = {
  agents: '#8B5CF6',
  tools: '#F59E0B',
  integrations: '#3B82F6',
  data: '#10B981',
  blocks: '#4A7A68',
}

const normalize = (value: string) => value.trim().toLowerCase()

const getOutputLabel = (block: (typeof blocks)[number]) => {
  const outputType = block.outputs?.response?.type ?? 'json'
  return typeof outputType === 'string' ? outputType : 'json'
}

const getSortMode = (value?: string): SortMode => {
  if (value === 'inputs') return 'inputs'
  if (value === 'outputs') return 'outputs'
  return 'name'
}

const getViewMode = (value?: string): ViewMode => (value === 'compact' ? 'compact' : 'cards')

export default async function BlocksCatalogPage({ searchParams }: BlocksCatalogPageProps) {
  const resolvedParams = (await searchParams) ?? {}
  const query = resolvedParams.q ?? ''
  const categoryFilter = resolvedParams.category ?? ''
  const view = getViewMode(resolvedParams.view)
  const sort = getSortMode(resolvedParams.sort)
  const filterOAuth = resolvedParams.oauth === '1'
  const filterExamples = resolvedParams.examples === '1'
  const filterCode = resolvedParams.code === '1'
  const filterPerformance = resolvedParams.performance === '1'

  const normalizedQuery = normalize(query)
  const normalizedCategory = normalize(categoryFilter)

  const filteredBlocks = blocks.filter((block) => {
    const category = (block.category ?? 'blocks').toLowerCase()
    const matchesCategory = normalizedCategory ? category === normalizedCategory : true

    if (!matchesCategory) return false
    if (filterOAuth) {
      const hasOAuth = block.subBlocks?.some((subBlock) => subBlock.type === 'oauth-input')
      if (!hasOAuth) return false
    }
    if (filterExamples && !(block.examples && block.examples.length > 0)) {
      return false
    }
    if (filterCode && !block.supportsCode) {
      return false
    }
    if (filterPerformance && !block.supportsPerformance) {
      return false
    }

    if (!normalizedQuery) return true

    const haystack = [block.name, block.type, block.description, block.longDescription, category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })

  const compareBlocks = (a: (typeof blocks)[number], b: (typeof blocks)[number]) => {
    if (sort === 'inputs') {
      const diff = (b.subBlocks?.length ?? 0) - (a.subBlocks?.length ?? 0)
      if (diff !== 0) return diff
    }
    if (sort === 'outputs') {
      const outputDiff = getOutputLabel(a).localeCompare(getOutputLabel(b))
      if (outputDiff !== 0) return outputDiff
    }
    return (a.name || a.type).localeCompare(b.name || b.type)
  }

  const groupedBlocks = filteredBlocks.reduce<Record<string, typeof blocks>>((acc, block) => {
    const category = block.category ?? 'blocks'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(block)
    return acc
  }, {})

  const sortedCategories = [
    ...categoryList.filter((category) => groupedBlocks[category]?.length),
    ...Object.keys(groupedBlocks)
      .filter((category) => !categoryList.includes(category))
      .sort((a, b) => a.localeCompare(b)),
  ]

  const totalCount = blocks.length
  const filteredCount = filteredBlocks.length
  const hasResults = filteredCount > 0

  const activeFilters: string[] = []
  if (normalizedQuery) activeFilters.push(`Search: ${query}`)
  if (normalizedCategory) {
    activeFilters.push(`Category: ${getCategoryLabel(normalizedCategory)}`)
  }
  if (filterOAuth) activeFilters.push('OAuth')
  if (filterExamples) activeFilters.push('Examples')
  if (filterCode) activeFilters.push('Code')
  if (filterPerformance) activeFilters.push('Performance')

  return (
    <div className="space-y-8">
      {/* Header + search */}
      <section className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo mb-4">
          Blocks
        </p>
        <h1 className="text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15] mb-3">
          Blocks{' '}
          <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Catalog</span>
        </h1>
        <p className="text-[14px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed max-w-xl mb-1">
          Find blocks fast with filters, categories, and two viewing modes.
        </p>
        <p className="text-[12px] text-zinc-300 dark:text-white/15 font-logo">
          {filteredCount} of {totalCount} blocks shown
        </p>

        <form
          method="get"
          action="/docs/blocks"
          className="mt-6 grid gap-3 lg:grid-cols-[1fr_170px_150px_140px_auto]"
        >
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name, type, or description..."
            className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-4 py-2.5 text-[13px] font-logo text-zinc-700 dark:text-white/60 placeholder:text-zinc-300 dark:placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-[#4A7A68]/30 transition-colors duration-200"
          />
          <select
            name="category"
            defaultValue={categoryFilter}
            className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-3 py-2.5 text-[13px] font-logo text-zinc-700 dark:text-white/60 focus:outline-none focus:ring-1 focus:ring-[#4A7A68]/30"
          >
            <option value="">All categories</option>
            {categoryList.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)} ({categoryCounts[category] ?? 0})
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-3 py-2.5 text-[13px] font-logo text-zinc-700 dark:text-white/60 focus:outline-none focus:ring-1 focus:ring-[#4A7A68]/30"
          >
            <option value="name">Sort: Name</option>
            <option value="inputs">Sort: Inputs</option>
            <option value="outputs">Sort: Outputs</option>
          </select>
          <select
            name="view"
            defaultValue={view}
            className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-3 py-2.5 text-[13px] font-logo text-zinc-700 dark:text-white/60 focus:outline-none focus:ring-1 focus:ring-[#4A7A68]/30"
          >
            <option value="cards">Cards</option>
            <option value="compact">Compact</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-[11px] font-logo font-semibold uppercase tracking-[0.15em] text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              Apply
            </button>
            {(query ||
              categoryFilter ||
              filterOAuth ||
              filterExamples ||
              filterCode ||
              filterPerformance) && (
              <Link
                href="/docs/blocks"
                className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] px-4 py-2.5 text-[11px] font-logo font-semibold uppercase tracking-[0.15em] text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/50 transition-colors duration-200"
              >
                Clear
              </Link>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-wrap gap-4 pt-1 text-[12px] text-zinc-400 dark:text-white/40 font-logo">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="oauth"
                value="1"
                defaultChecked={filterOAuth}
                className="rounded accent-[#4A7A68]"
              />
              OAuth only
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="examples"
                value="1"
                defaultChecked={filterExamples}
                className="rounded accent-[#4A7A68]"
              />
              Has examples
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="code"
                value="1"
                defaultChecked={filterCode}
                className="rounded accent-[#4A7A68]"
              />
              Code enabled
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="performance"
                value="1"
                defaultChecked={filterPerformance}
                className="rounded accent-[#4A7A68]"
              />
              Performance
            </label>
          </div>
        </form>

        {activeFilters.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {activeFilters.map((item) => (
              <span
                key={item}
                className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[11px] font-logo text-zinc-400 dark:text-white/40"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Category overview cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categoryList.map((category) => (
          <a
            key={category}
            href={`#category-${category}`}
            className="group flex flex-col rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5 transition-all duration-200 hover:border-black/[0.1] dark:hover:border-white/[0.1]"
          >
            <div
              className="w-1.5 h-1.5 rounded-full mb-3"
              style={{ backgroundColor: categoryColors[category] || '#4A7A68' }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300 dark:text-white/12 font-logo mb-1">
              {getCategoryLabel(category)}
            </p>
            <p className="text-[18px] font-logo font-semibold text-zinc-800 dark:text-white mb-1">
              {categoryCounts[category] ?? 0} blocks
            </p>
            <p className="text-[12px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
              {categoryDescriptions[category] ?? 'Specialized workflow blocks and utilities.'}
            </p>
          </a>
        ))}
      </div>

      {/* Category quick nav */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white">
            Category Index
          </h2>
          <p className="text-[11px] text-zinc-300 dark:text-white/12 font-logo">
            {filteredCount} blocks
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((category) => (
            <a
              key={category}
              href={`#category-${category}`}
              className="rounded-full border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-3 py-1 text-[11px] font-logo font-medium text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/40 transition-colors duration-200"
            >
              {getCategoryLabel(category)} ({groupedBlocks[category]?.length ?? 0})
            </a>
          ))}
        </div>
      </div>

      {/* No results */}
      {!hasResults && (
        <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-8 text-center">
          <p className="text-[13px] text-zinc-400 dark:text-white/40 font-logo">
            No blocks match the current filters. Try clearing the search or selecting another
            category.
          </p>
        </div>
      )}

      {/* Block groups */}
      <div className="space-y-8">
        {sortedCategories.map((category) => {
          const items = groupedBlocks[category] || []
          const label = getCategoryLabel(category)
          const sortedItems = items.slice().sort(compareBlocks)
          const color = categoryColors[category] || '#4A7A68'

          return (
            <section
              key={category}
              id={`category-${category}`}
              className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <h2 className="text-[16px] font-logo font-semibold text-zinc-800 dark:text-white">
                    {label}
                  </h2>
                </div>
                <span className="text-[11px] text-zinc-300 dark:text-white/12 font-logo">
                  {sortedItems.length} blocks
                </span>
              </div>

              {view === 'compact' ? (
                <div className="space-y-1">
                  {sortedItems.map((block) => (
                    <Link
                      key={block.type}
                      href={`/docs/blocks/${block.type}`}
                      className="group flex flex-wrap items-center gap-4 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
                    >
                      <div className="min-w-[160px]">
                        <p className="text-[13px] font-semibold text-zinc-700 dark:text-white/60 font-logo group-hover:text-[#4A7A68] dark:group-hover:text-[#8CB09C] transition-colors duration-200">
                          {block.name || block.type}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-300 dark:text-white/10 font-logo">
                          {block.type}
                        </p>
                      </div>
                      <div className="flex-1 text-[12px] text-zinc-400 dark:text-white/40 font-logo">
                        {block.description || block.longDescription}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-logo text-zinc-300 dark:text-white/12">
                        <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2 py-0.5">
                          {block.subBlocks?.length ?? 0} inputs
                        </span>
                        <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2 py-0.5">
                          {getOutputLabel(block)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {sortedItems.map((block) => {
                    const Icon = block.icon
                    const subBlocks = block.subBlocks ?? []
                    const responseLabel = getOutputLabel(block)
                    const keyInputs = subBlocks.slice(0, 4)

                    return (
                      <div
                        key={block.type}
                        className="group rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] overflow-hidden transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
                      >
                        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-black/[0.03] dark:border-white/[0.03]">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${block.bgColor || color}15` }}
                          >
                            {Icon ? (
                              <Icon className="h-4.5 w-4.5 text-zinc-600 dark:text-white/40" />
                            ) : (
                              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-400 dark:text-white/40 font-logo">
                                NF
                              </span>
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/docs/blocks/${block.type}`}
                              className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo hover:text-[#4A7A68] dark:hover:text-[#8CB09C] transition-colors duration-200"
                            >
                              {block.name || block.type}
                            </Link>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-300 dark:text-white/10 font-logo">
                              {block.type}
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-4">
                          {block.description && (
                            <p className="text-[12px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed mb-3">
                              {block.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-logo text-zinc-300 dark:text-white/12 mb-3">
                            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2.5 py-0.5">
                              {label}
                            </span>
                            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2.5 py-0.5">
                              {subBlocks.length} inputs
                            </span>
                            <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2.5 py-0.5">
                              {responseLabel}
                            </span>
                            {block.supportsCode && (
                              <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2.5 py-0.5">
                                Code
                              </span>
                            )}
                            {block.supportsPerformance && (
                              <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2.5 py-0.5">
                                Performance
                              </span>
                            )}
                          </div>

                          {keyInputs.length > 0 && (
                            <div className="mb-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-200 dark:text-white/8 font-logo mb-1.5">
                                Key inputs
                              </p>
                              <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-300 dark:text-white/15 font-logo">
                                {keyInputs.map((subBlock, index) => (
                                  <span
                                    key={`${block.type}-${subBlock.id}-${index}`}
                                    className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2 py-0.5"
                                  >
                                    {subBlock.title || subBlock.id}
                                  </span>
                                ))}
                                {subBlocks.length > keyInputs.length && (
                                  <span className="rounded-full border border-black/[0.04] dark:border-white/[0.04] px-2 py-0.5">
                                    +{subBlocks.length - keyInputs.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <Link
                            href={`/docs/blocks/${block.type}`}
                            className="inline-flex items-center gap-1.5 text-[11px] font-logo font-semibold text-zinc-400 dark:text-white/40 hover:text-[#4A7A68] dark:hover:text-[#8CB09C] transition-colors duration-200"
                          >
                            View Details
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
