'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Hash,
  Layers,
  Loader2,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { KnowledgeDocument } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('DocumentDetailPanel')

interface Chunk {
  id: string
  chunkIndex: number
  content: string
  tokenCount: number | null
  metadata: Record<string, any> | null
  createdAt: Date
}

interface DocumentWithChunks extends KnowledgeDocument {
  chunks: Chunk[]
}

interface DocumentDetailPanelProps {
  documentId: string | null
  open: boolean
  onClose: () => void
}

export function DocumentDetailPanel({ documentId, open, onClose }: DocumentDetailPanelProps) {
  const [document, setDocument] = useState<DocumentWithChunks | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set())
  const [copiedChunk, setCopiedChunk] = useState<number | null>(null)

  useEffect(() => {
    if (documentId && open) {
      loadDocument()
    }
  }, [documentId, open])

  const loadDocument = async () => {
    if (!documentId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge/documents?documentId=${documentId}&withChunks=true`)
      if (!res.ok) throw new Error('Failed to load document')
      const data = await res.json()
      setDocument(data.document)
    } catch (error: any) {
      logger.error('Failed to load document details', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleChunk = (index: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const expandAll = () => {
    if (document?.chunks) {
      setExpandedChunks(new Set(document.chunks.map((_, i) => i)))
    }
  }

  const collapseAll = () => {
    setExpandedChunks(new Set())
  }

  const copyChunk = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content)
    setCopiedChunk(index)
    setTimeout(() => setCopiedChunk(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    const base =
      'text-[11px] font-logo font-medium px-2 py-0.5 rounded-md border inline-flex items-center gap-1'
    switch (status) {
      case 'ready':
        return (
          <span
            className={`${base} text-[#4A7A68] bg-[#4A7A68]/[0.06] border-[#4A7A68]/10 dark:text-[#94B8A6] dark:bg-[#94B8A6]/[0.06] dark:border-[#94B8A6]/10`}
          >
            <CheckCircle className="h-3 w-3" strokeWidth={1.5} />
            Ready
          </span>
        )
      case 'processing':
        return (
          <span className={`${base} text-[#3B82F6] bg-[#3B82F6]/[0.06] border-[#3B82F6]/10`}>
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            Processing
          </span>
        )
      case 'pending':
        return (
          <span className={`${base} text-[#F59E0B] bg-[#F59E0B]/[0.06] border-[#F59E0B]/10`}>
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Pending
          </span>
        )
      case 'failed':
        return (
          <span
            className={`${base} silver-glass-chip smoky-glass-chip border-rose-500/[0.16] bg-rose-500/[0.06] text-rose-600 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08] dark:text-rose-200`}
          >
            <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
            Failed
          </span>
        )
      default:
        return (
          <span className={`${base} text-zinc-400 bg-zinc-400/[0.06] border-zinc-400/10`}>
            {status}
          </span>
        )
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] p-0 border-l border-black/[0.06] dark:border-white/[0.06] bg-transparent rounded-l-[16px]">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
              <FileText
                className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]"
                strokeWidth={1.5}
              />
            </div>
            <SheetTitle className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
              Document Details
            </SheetTitle>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2
              className="h-5 w-5 animate-spin text-[#4A7A68] dark:text-[#94B8A6]"
              strokeWidth={1.5}
            />
            <span className="text-[12px] font-logo text-zinc-500 dark:text-white/70">
              Loading document...
            </span>
          </div>
        ) : document ? (
          <ScrollArea className="h-[calc(100dvh-80px)]">
            <div className="p-5 space-y-5">
              {/* Document Info */}
              <div>
                <h3 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white truncate mb-2.5">
                  {document.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {getStatusBadge(document.status)}
                  <span className="text-[11px] font-logo font-medium px-2 py-0.5 rounded-md border border-black/[0.04] dark:border-white/[0.04] text-zinc-500 dark:text-white/70 bg-[#fafafa] dark:bg-white/[0.02]">
                    {document.fileType || document.type}
                  </span>
                  <span className="text-[11px] font-logo font-medium px-2 py-0.5 rounded-md border border-black/[0.04] dark:border-white/[0.04] text-zinc-500 dark:text-white/70 bg-[#fafafa] dark:bg-white/[0.02]">
                    {formatFileSize(document.fileSize ?? null)}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: Layers,
                    label: 'Chunks',
                    value: document.chunkCount || 0,
                    color: '#3B82F6',
                  },
                  {
                    icon: Hash,
                    label: 'Tokens',
                    value: document.totalTokens?.toLocaleString() || '0',
                    color: '#F59E0B',
                  },
                  {
                    icon: Clock,
                    label: 'Processed',
                    value: document.processedAt
                      ? new Date(document.processedAt).toLocaleDateString()
                      : '—',
                    color: '#4A7A68',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] p-3.5 text-center"
                  >
                    <div
                      className="h-7 w-7 rounded-md flex items-center justify-center mx-auto mb-2"
                      style={{
                        backgroundColor: `${stat.color}08`,
                        border: `1px solid ${stat.color}15`,
                      }}
                    >
                      <stat.icon
                        className="h-3.5 w-3.5"
                        style={{ color: stat.color }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="text-[14px] font-logo font-semibold text-zinc-700 dark:text-white/85">
                      {stat.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {document.errorMessage && (
                <div className="silver-glass-pane smoky-glass-pane rounded-xl border border-rose-500/[0.16] bg-rose-500/[0.05] p-3.5 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="smoky-glass-chip flex h-6 w-6 items-center justify-center rounded-[9px] border border-rose-500/[0.16] bg-rose-500/[0.08] dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08]">
                      <AlertCircle
                        className="h-3.5 w-3.5 text-rose-500 dark:text-rose-300"
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className="text-[12px] font-logo font-semibold text-rose-600 dark:text-rose-200">
                      Error
                    </span>
                  </div>
                  <p className="text-[12px] font-logo text-rose-700/75 dark:text-rose-100/70 leading-relaxed">
                    {document.errorMessage}
                  </p>
                </div>
              )}

              {/* Chunks Section */}
              {document.chunks && document.chunks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers
                        className="h-3.5 w-3.5 text-zinc-400 dark:text-white/60"
                        strokeWidth={1.5}
                      />
                      <h4 className="text-[13px] font-logo font-semibold text-zinc-700 dark:text-white/85">
                        Chunks ({document.chunks.length})
                      </h4>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={expandAll}
                        className="text-[11px] font-logo text-zinc-500 dark:text-white/70 hover:text-zinc-700 dark:hover:text-white/90 px-2 py-1 rounded transition-colors"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={collapseAll}
                        className="text-[11px] font-logo text-zinc-500 dark:text-white/70 hover:text-zinc-700 dark:hover:text-white/90 px-2 py-1 rounded transition-colors"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {document.chunks.map((chunk, index) => (
                      <Collapsible
                        key={chunk.id}
                        open={expandedChunks.has(index)}
                        onOpenChange={() => toggleChunk(index)}
                      >
                        <div className="rounded-lg border border-black/[0.04] dark:border-white/[0.04] overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#fafafa] dark:hover:bg-white/[0.01] transition-colors text-left">
                              <div className="flex items-center gap-2.5">
                                {expandedChunks.has(index) ? (
                                  <ChevronDown
                                    className="h-3 w-3 text-zinc-400 dark:text-white/60"
                                    strokeWidth={1.5}
                                  />
                                ) : (
                                  <ChevronRight
                                    className="h-3 w-3 text-zinc-400 dark:text-white/60"
                                    strokeWidth={1.5}
                                  />
                                )}
                                <span className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85">
                                  Chunk {chunk.chunkIndex + 1}
                                </span>
                                <span className="text-[10px] font-logo text-zinc-500 dark:text-white/70 px-1.5 py-0.5 rounded bg-zinc-100/50 dark:bg-white/[0.03]">
                                  {chunk.tokenCount || 0} tokens
                                </span>
                              </div>
                              <div
                                role="button"
                                tabIndex={0}
                                aria-label="Copy chunk"
                                className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:text-white/60 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyChunk(chunk.content, index)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    copyChunk(chunk.content, index)
                                  }
                                }}
                              >
                                {copiedChunk === index ? (
                                  <Check className="h-2.5 w-2.5 text-[#4A7A68]" strokeWidth={2} />
                                ) : (
                                  <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                                )}
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-0 border-t border-black/[0.03] dark:border-white/[0.03] bg-[#fafafa] dark:bg-white/[0.01]">
                              <pre className="text-[12px] whitespace-pre-wrap font-mono text-zinc-600 dark:text-white/75 leading-relaxed max-h-48 overflow-y-auto mt-2.5">
                                {chunk.content}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {document.metadata && Object.keys(document.metadata).length > 0 && (
                <div>
                  <h4 className="text-[13px] font-logo font-semibold text-zinc-700 dark:text-white/85 mb-2">
                    Metadata
                  </h4>
                  <pre className="text-[11px] font-mono bg-[#fafafa] dark:bg-white/[0.01] border border-black/[0.04] dark:border-white/[0.04] p-3 rounded-lg overflow-x-auto text-zinc-500 dark:text-white/70">
                    {JSON.stringify(document.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <FileText className="h-5 w-5 text-zinc-400 dark:text-white/60" strokeWidth={1.5} />
            <span className="text-[12px] font-logo text-zinc-400 dark:text-white/60">
              No document selected
            </span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
