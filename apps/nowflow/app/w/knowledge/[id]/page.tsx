'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  FileText,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import type { KnowledgeDocument, KnowledgeSource } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { DocumentDetailPanel } from '../components/document-detail-panel'
import { UploadDocumentsModal } from '../components/upload-documents-modal'

// Lazy-load the knowledge graph viewer — pulls in @xyflow/react (~85KB).
// It renders below the documents table, so defer until interactive.
const KnowledgeGraphViewer = dynamic(
  () =>
    import('@/components/knowledge/knowledge-graph-viewer').then((m) => ({
      default: m.KnowledgeGraphViewer,
    })),
  { ssr: false, loading: () => null }
)

const logger = createLogger('KnowledgeSourceDetailPage')

interface SourceWithStats extends KnowledgeSource {
  recentDocuments?: KnowledgeDocument[]
  totalChunks?: number
  agentCount?: number
}

export default function KnowledgeSourceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sourceId = params.id as string
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [source, setSource] = useState<SourceWithStats | null>(null)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [processingDocs, setProcessingDocs] = useState<Set<string>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const copySourceId = async () => {
    await navigator.clipboard.writeText(sourceId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const loadSourceData = useCallback(
    async (silent = false, signal?: AbortSignal) => {
      try {
        if (!silent) setInitialLoading(true)

        const qp = new URLSearchParams()
        qp.set('sourceId', sourceId)
        qp.set('withStats', 'true')
        if (activeWorkspaceId) qp.set('workspaceId', activeWorkspaceId)

        const [sourceRes, docsRes] = await Promise.all([
          fetch(`/api/knowledge/sources?${qp.toString()}`, { signal }),
          fetch(`/api/knowledge/documents?sourceId=${sourceId}`, { signal }),
        ])

        if (!sourceRes.ok) throw new Error('Failed to load source')

        const sourceData = await sourceRes.json()
        if (signal?.aborted) return
        setSource(sourceData.source)

        if (docsRes.ok) {
          const docsData = await docsRes.json()
          if (signal?.aborted) return
          setDocuments(docsData.documents || [])
        }
      } catch (error: any) {
        if (isAbortLikeError(error, signal)) {
          return
        }

        logger.error('Failed to load source data', error)
      } finally {
        if (!signal?.aborted) {
          setInitialLoading(false)
        }
      }
    },
    [sourceId, activeWorkspaceId]
  )

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user && sourceId) {
      loadSourceData(false, abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, sourceId, loadSourceData])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (hasProcessing && !initialLoading) {
      pollRef.current = setInterval(() => loadSourceData(true), 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [documents, initialLoading, loadSourceData])

  const processDocument = async (documentId: string) => {
    if (processingDocs.has(documentId)) return
    setProcessingDocs((prev) => new Set(prev).add(documentId))
    setDocuments((prev) =>
      prev.map((d) => (d.id === documentId ? { ...d, status: 'processing' } : d))
    )

    try {
      const res = await fetch('/api/knowledge/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', documentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Processing failed')
      }
      await loadSourceData(true)
    } catch (error: any) {
      logger.error('Failed to process document', error)
      await loadSourceData(true)
    } finally {
      setProcessingDocs((prev) => {
        const next = new Set(prev)
        next.delete(documentId)
        return next
      })
    }
  }

  const processAllPending = async () => {
    const pending = documents.filter((d) => d.status === 'pending')
    for (const doc of pending) {
      await processDocument(doc.id)
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      const res = await fetch(`/api/knowledge/documents?documentId=${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      await loadSourceData(true)
    } catch (error: any) {
      logger.error('Failed to delete document', error)
      alert(`Error: ${error.message}`)
    }
  }

  const getStatusBadge = (status: string) => {
    const base = 'text-[11px] font-logo font-medium px-2 py-0.5 rounded-md border'
    switch (status) {
      case 'ready':
        return (
          <span
            className={`${base} text-[#4A7A68] bg-[#4A7A68]/[0.06] border-[#4A7A68]/10 dark:text-[#94B8A6] dark:bg-[#94B8A6]/[0.06] dark:border-[#94B8A6]/10 inline-flex items-center gap-1`}
          >
            <CheckCircle className="h-3 w-3" strokeWidth={1.5} />
            Ready
          </span>
        )
      case 'processing':
        return (
          <span
            className={`${base} text-[#3B82F6] bg-[#3B82F6]/[0.06] border-[#3B82F6]/10 inline-flex items-center gap-1`}
          >
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            Processing
          </span>
        )
      case 'pending':
        return (
          <span
            className={`${base} text-[#F59E0B] bg-[#F59E0B]/[0.06] border-[#F59E0B]/10 inline-flex items-center gap-1`}
          >
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Pending
          </span>
        )
      case 'failed':
        return (
          <span
            className={`${base} text-red-500 bg-red-500/[0.06] border-red-500/10 inline-flex items-center gap-1`}
          >
            <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
            Failed
          </span>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[11px] font-logo">
            {status}
          </Badge>
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

  const pendingCount = documents.filter((d) => d.status === 'pending').length
  const processingCount = documents.filter((d) => d.status === 'processing').length
  const inProgressCount = pendingCount + processingCount
  const readyCount = documents.filter((d) => d.status === 'ready').length
  const failedCount = documents.filter((d) => d.status === 'failed').length

  // Loading state
  if (isPending || initialLoading) {
    return (
      <div
        className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-72 rounded-md bg-zinc-50 dark:bg-white/[0.02] animate-pulse" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-5 w-10 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                    <div className="h-3 w-12 rounded bg-zinc-50 dark:bg-white/[0.02] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5">
            <div className="space-y-3">
              <div className="h-4 w-32 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse mb-4" />
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg bg-zinc-50 dark:bg-white/[0.02] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Not found state
  if (!source) {
    return (
      <div
        className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-6xl mx-auto text-center py-20">
          <div className="h-14 w-14 rounded-xl bg-red-500/[0.06] flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-6 w-6 text-red-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo mb-2">
            Knowledge Source Not Found
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-white/70 font-logo mb-6">
            This source may have been deleted or you don&apos;t have access.
          </p>
          <Button
            onClick={() => router.push('/w/knowledge')}
            variant="outline"
            className="font-logo text-[13px] h-9 rounded-lg border-black/[0.06] dark:border-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
            Back to Knowledge Sources
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/w/knowledge')}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-zinc-400 hover:text-zinc-600 dark:text-white/60 dark:hover:text-white/90 transition-colors flex-shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                {source.icon || '📄'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1
                    className="text-lg sm:text-xl font-logo font-semibold text-zinc-800 dark:text-white tracking-tight truncate"
                    title={source.name}
                  >
                    {source.name}
                  </h1>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-mono text-zinc-400 dark:text-white/60 hover:text-zinc-600 dark:hover:text-white/90 transition-colors"
                          onClick={copySourceId}
                        >
                          {copiedId ? (
                            <Check className="h-2.5 w-2.5 text-[#4A7A68]" strokeWidth={2} />
                          ) : (
                            <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                          )}
                          {sourceId.substring(0, 8)}...
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-[12px]">Click to copy Source ID for Agent block</p>
                        <p className="text-[10px] font-mono text-zinc-400 mt-1">{sourceId}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-[13px] text-zinc-500 dark:text-white/70 font-logo truncate mt-0.5">
                  {source.description || 'No description'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4 ml-11 sm:ml-12">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              className="font-logo text-[12px] h-8 rounded-lg border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] text-zinc-600 dark:text-white/70 hover:border-black/[0.1] flex-1 sm:flex-none"
            >
              <Upload className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
              Upload
            </Button>
            {pendingCount > 0 && (
              <Button
                size="sm"
                onClick={processAllPending}
                className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[12px] h-8 rounded-lg transition-colors flex-1 sm:flex-none"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                Process ({pendingCount})
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: FileText, label: 'Documents', value: documents.length, color: '#4A7A68' },
            {
              icon: Layers,
              label: 'Chunks',
              value: documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0),
              color: '#3B82F6',
            },
            {
              icon: Hash,
              label: 'Tokens',
              value: documents.reduce((sum, d) => sum + (d.totalTokens || 0), 0).toLocaleString(),
              color: '#F59E0B',
              hideOnMobile: true,
            },
            { icon: CheckCircle, label: 'Ready', value: readyCount, color: '#4A7A68' },
            {
              icon: Settings,
              label: 'Chunking',
              value: `${source.chunkSize} / ${source.chunkOverlap}`,
              color: '#8B5CF6',
              hideOnMobile: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 ${
                stat.hideOnMobile ? 'hidden sm:block' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${stat.color}08`,
                    border: `1px solid ${stat.color}15`,
                  }}
                >
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo truncate">
                    {stat.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo">
                    {stat.label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Processing Activity */}
        {inProgressCount > 0 && (
          <div className="rounded-xl border border-[#3B82F6]/10 bg-[#3B82F6]/[0.03] dark:bg-[#3B82F6]/[0.02] p-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3B82F6]" strokeWidth={1.5} />
                <span className="text-[13px] font-logo font-medium text-[#3B82F6]">
                  {processingCount > 0
                    ? `Processing ${processingCount} document(s)...`
                    : `${pendingCount} document(s) pending`}
                </span>
              </div>
              <span className="text-[12px] font-logo text-[#3B82F6]/60">
                {readyCount} / {documents.length} ready
              </span>
            </div>
            <Progress value={(readyCount / documents.length) * 100} className="h-1" />
          </div>
        )}

        {/* Documents Table */}
        <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-400 dark:text-white/60" strokeWidth={1.5} />
              <h2 className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white">
                Documents
              </h2>
              <span className="text-[12px] font-logo text-zinc-400 dark:text-white/60">
                ({documents.length})
              </span>
            </div>
          </div>

          <div className="p-5">
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center mx-auto mb-4">
                  <FileText
                    className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-[14px] font-logo font-medium text-zinc-700 dark:text-white/80 mb-1">
                  No documents yet
                </p>
                <p className="text-[12px] font-logo text-zinc-400 dark:text-white/50 mb-5">
                  Upload documents to build your knowledge base
                </p>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  size="sm"
                  className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[12px] h-8 rounded-lg"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                  Upload Documents
                </Button>
              </div>
            ) : (
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-transparent">
                        <TableHead className="w-[40%] text-[11px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60 font-semibold">
                          Name
                        </TableHead>
                        <TableHead className="hidden sm:table-cell text-[11px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60 font-semibold">
                          Size
                        </TableHead>
                        <TableHead className="text-center hidden md:table-cell text-[11px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60 font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              <Layers className="h-3 w-3" strokeWidth={1.5} />
                              Chunks
                            </TooltipTrigger>
                            <TooltipContent>Number of text chunks</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60 font-semibold">
                          Status
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider font-logo text-zinc-400 dark:text-white/60 font-semibold">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="cursor-pointer border-b border-black/[0.03] dark:border-white/[0.03] hover:bg-[#fafafa] dark:hover:bg-white/[0.01] transition-colors"
                          onClick={() => {
                            setSelectedDocumentId(doc.id)
                            setShowDetailPanel(true)
                          }}
                        >
                          <TableCell className="py-3">
                            <div className="min-w-0">
                              <div
                                className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 truncate max-w-[180px] sm:max-w-[250px] lg:max-w-[350px]"
                                title={doc.name}
                              >
                                {doc.name}
                              </div>
                              <div className="text-[11px] font-logo text-zinc-400 dark:text-white/60 sm:hidden">
                                {formatFileSize(doc.fileSize)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] font-logo text-zinc-500 dark:text-white/70 hidden sm:table-cell">
                            {formatFileSize(doc.fileSize)}
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell">
                            {doc.status === 'ready' ? (
                              <span className="text-[12px] font-logo font-medium text-zinc-500 dark:text-white/60 bg-zinc-100/50 dark:bg-white/[0.03] px-2 py-0.5 rounded">
                                {doc.chunkCount || 0}
                              </span>
                            ) : doc.status === 'processing' ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin text-[#3B82F6] mx-auto"
                                strokeWidth={1.5}
                              />
                            ) : (
                              <span className="text-zinc-300 dark:text-white/40">—</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex items-center justify-end gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {doc.status === 'ready' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:text-white/50 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedDocumentId(doc.id)
                                        setShowDetailPanel(true)
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>View chunks</TooltipContent>
                                </Tooltip>
                              )}
                              {(doc.status === 'pending' || doc.status === 'failed') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-[#4A7A68] dark:text-white/50 dark:hover:text-[#94B8A6] hover:bg-[#4A7A68]/[0.06] dark:hover:bg-[#94B8A6]/[0.06] transition-colors disabled:opacity-30"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        processDocument(doc.id)
                                      }}
                                      disabled={processingDocs.has(doc.id)}
                                    >
                                      {processingDocs.has(doc.id) ? (
                                        <Loader2
                                          className="h-3.5 w-3.5 animate-spin"
                                          strokeWidth={1.5}
                                        />
                                      ) : doc.status === 'failed' ? (
                                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                                      ) : (
                                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {doc.status === 'failed'
                                      ? 'Retry processing'
                                      : 'Process document'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-500 dark:text-white/50 dark:hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteDocument(doc.id)
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Delete document</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Failed Documents Alert */}
        {failedCount > 0 && (
          <div className="silver-glass-pane smoky-glass-pane animate-in fade-in rounded-xl border border-rose-500/[0.16] bg-rose-500/[0.05] p-4 duration-300 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-200">
              <div className="smoky-glass-chip flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[10px] border border-rose-500/[0.16] bg-rose-500/[0.08] dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08]">
                <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <span className="text-[13px] font-logo font-medium">
                {failedCount} document(s) failed to process
              </span>
            </div>
            <p className="ml-9 mt-1 text-[12px] font-logo text-rose-700/72 dark:text-rose-100/68">
              Click the retry button on each document to reprocess.
            </p>
          </div>
        )}

        {/* Knowledge Graph */}
        <KnowledgeGraphViewer sourceId={sourceId} />
      </div>

      {/* Upload Modal */}
      <UploadDocumentsModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        sourceId={sourceId}
        sourceName={source.name}
        onSuccess={() => loadSourceData(true)}
      />

      {/* Document Detail Panel */}
      <DocumentDetailPanel
        documentId={selectedDocumentId}
        open={showDetailPanel}
        onClose={() => {
          setShowDetailPanel(false)
          setSelectedDocumentId(null)
        }}
      />
    </div>
  )
}
