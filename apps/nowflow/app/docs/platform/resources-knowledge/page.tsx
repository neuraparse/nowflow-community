import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building,
  Clock,
  Columns,
  Database,
  FileText,
  Filter,
  Globe,
  Quote,
  Scan,
  Shield,
  Target,
  User,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Resources & Knowledge | NowFlow Docs',
  description: 'Manage documents, knowledge sources, embeddings, and retrieval resources.',
}

const sourceTypes = [
  {
    icon: FileText,
    title: 'Documents & Files',
    description: 'PDF, DOCX, Markdown, and HTML with metadata, tags, and owners.',
    color: '#4A7A68',
  },
  {
    icon: Database,
    title: 'Structured Datasets',
    description: 'Tables, CSV, SQL views, and analytics exports for retrieval.',
    color: '#8B5CF6',
  },
  {
    icon: Globe,
    title: 'External APIs',
    description: 'Live context from SaaS tools, CRMs, and internal services.',
    color: '#3B82F6',
  },
]

const ingestionSteps = [
  {
    step: '01',
    title: 'Collect & Define',
    description: 'Collect sources, assign owners, and define retention policies.',
  },
  {
    step: '02',
    title: 'Normalize & Extract',
    description: 'Normalize formats, extract metadata, and chunk content.',
  },
  {
    step: '03',
    title: 'Embed & Index',
    description: 'Generate embeddings and index into vector or hybrid stores.',
  },
  {
    step: '04',
    title: 'Validate & Score',
    description: 'Validate retrieval quality with test queries and scoring.',
  },
  {
    step: '05',
    title: 'Refresh & Sync',
    description: 'Schedule refresh or event-driven reindexing.',
  },
]

const memoryLayers = [
  {
    icon: Clock,
    title: 'Session Memory',
    description: 'Short-lived context captured per run or conversation.',
    color: '#3B82F6',
  },
  {
    icon: Building,
    title: 'Workspace Memory',
    description: 'Persistent facts shared across workflows and agents.',
    color: '#4A7A68',
  },
  {
    icon: User,
    title: 'Entity Memory',
    description: 'Customer or project profiles with versioned updates.',
    color: '#8B5CF6',
  },
]

const governanceControls = [
  {
    icon: Shield,
    title: 'Access Controls',
    description: 'Per-block retrieval filters on knowledge sources.',
  },
  {
    icon: Quote,
    title: 'Citations & Provenance',
    description: 'Full traceability for knowledge-backed outputs.',
  },
  {
    icon: Clock,
    title: 'Freshness Signals',
    description: 'Expiration windows for time-sensitive data.',
  },
  {
    icon: Scan,
    title: 'PII Detection',
    description: 'Automatic redaction before indexing.',
  },
  {
    icon: Target,
    title: 'Similarity Thresholds',
    description: 'Prevent irrelevant context injection.',
  },
]

const retrievalTuning = [
  {
    icon: Columns,
    title: 'Chunking Strategy',
    description: 'Tune chunk size and overlap to maximize recall.',
    color: '#4A7A68',
  },
  {
    icon: Filter,
    title: 'Metadata Filters',
    description: 'Filter by tags, owner, region, or language.',
    color: '#8B5CF6',
  },
  {
    icon: BarChart3,
    title: 'Ranking & Rerankers',
    description: 'Apply LLM or heuristic reranking for relevance.',
    color: '#F59E0B',
  },
]

export default function ResourcesKnowledgePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9 overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.04] dark:opacity-[0.02] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #4A7A68, transparent 65%)' }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
            Platform
          </p>
          <h1 className="mt-3 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
            Resources &{' '}
            <span className="font-serif italic text-[#4A7A68] dark:text-[#8CB09C]">Knowledge</span>
          </h1>
          <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed max-w-xl">
            Centralize documents, embeddings, and structured data so workflows can reason over
            trusted knowledge sources.
          </p>
        </div>
      </div>

      {/* Knowledge Source Types */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Knowledge Source Types
        </h2>
        <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Connect diverse data sources to power intelligent retrieval across your workflows.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {sourceTypes.map((item) => (
            <div
              key={item.title}
              className="group rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${item.color}08`,
                    border: `1px solid ${item.color}15`,
                  }}
                >
                  <item.icon className="h-4 w-4" style={{ color: item.color }} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ingestion Pipeline */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Ingestion Pipeline
        </h2>
        <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          A structured flow from raw data to production-ready knowledge.
        </p>
        <div className="mt-6 space-y-3">
          {ingestionSteps.map((item, index) => (
            <div
              key={item.step}
              className="group flex items-start gap-4 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-5 py-4 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <span className="font-serif italic text-[18px] text-[#4A7A68]/30 dark:text-[#8CB09C]/20 leading-none mt-0.5 select-none">
                {item.step}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                  {item.title}
                </h3>
                <p className="mt-1 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                  {item.description}
                </p>
              </div>
              {index < ingestionSteps.length - 1 && (
                <ArrowRight
                  className="h-3.5 w-3.5 text-zinc-200 dark:text-white/8 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  strokeWidth={1.5}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Memory Layers */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-4.5 w-4.5 text-[#4A7A68] dark:text-[#8CB09C]" strokeWidth={1.5} />
          <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
            Memory Layers
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed mb-6">
          Layered memory architecture for different persistence needs.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {memoryLayers.map((item) => (
            <div
              key={item.title}
              className="group relative rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg mb-4"
                style={{ backgroundColor: `${item.color}08`, border: `1px solid ${item.color}15` }}
              >
                <item.icon className="h-4 w-4" style={{ color: item.color }} strokeWidth={1.5} />
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Governance & Relevance */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Governance & Relevance
        </h2>
        <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Built-in controls to ensure security, accuracy, and compliance.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {governanceControls.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] px-4 py-3.5 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#4A7A68]/[0.06] dark:bg-[#8CB09C]/[0.06] mt-0.5">
                <item.icon
                  className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#8CB09C]"
                  strokeWidth={1.5}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-zinc-700 dark:text-white/70 font-logo">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-[12px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retrieval Tuning */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h2 className="text-lg font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
          Retrieval Tuning
        </h2>
        <p className="mt-2 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Fine-tune how knowledge is retrieved for optimal accuracy.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {retrievalTuning.map((item) => (
            <div
              key={item.title}
              className="group relative rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-5 transition-all duration-200 hover:border-black/[0.08] dark:hover:border-white/[0.08]"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg mb-4"
                style={{ backgroundColor: `${item.color}08`, border: `1px solid ${item.color}15` }}
              >
                <item.icon className="h-4 w-4" style={{ color: item.color }} strokeWidth={1.5} />
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo">
                {item.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
