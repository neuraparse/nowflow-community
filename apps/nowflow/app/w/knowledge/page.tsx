'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Code,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Image,
  LayoutGrid,
  List,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import type { KnowledgeSource, KnowledgeSourceVisibility } from '@/lib/knowledge/types'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkspaceEmptyState, WorkspacePageHeader } from '@/app/w/components/workspace-shell'
import { CreateSourceModal } from './components/create-source-modal'
import { UploadDocumentsModal } from './components/upload-documents-modal'

const logger = createLogger('KnowledgeSourcesPage')

type ViewMode = 'list' | 'grid'

// Document type icon badges for folder cards
const DOC_TYPE_ICONS = [
  { Icon: FileText, color: '#EF4444', bg: '#EF4444' }, // PDF
  { Icon: Database, color: '#4A7A68', bg: '#4A7A68' }, // Data
  { Icon: Image, color: '#8B5CF6', bg: '#8B5CF6' }, // Images
  { Icon: Code, color: '#3B82F6', bg: '#3B82F6' }, // Code
  { Icon: FolderOpen, color: '#F59E0B', bg: '#F59E0B' }, // Folders
]

export default function KnowledgeSourcesPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [uploadModalSource, setUploadModalSource] = useState<KnowledgeSource | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user) {
      loadSources(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, activeWorkspaceId])

  const loadSources = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeWorkspaceId) {
        params.set('workspaceId', activeWorkspaceId)
      }
      const response = await fetch(
        `/api/knowledge/sources${params.toString() ? `?${params.toString()}` : ''}`,
        { signal }
      )
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setSources(data.sources || [])
      }
    } catch (error: any) {
      if (isAbortLikeError(error, signal)) return
      logger.error('Failed to load knowledge sources', error)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const handleCreateSource = () => {
    setShowCreateModal(true)
  }

  const handleSourceCreated = () => {
    loadSources()
  }

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) {
      return
    }

    try {
      const response = await fetch(`/api/knowledge/sources?sourceId=${sourceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSources(sources.filter((s) => s.id !== sourceId))
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      logger.error('Failed to delete source', error)
      alert('Failed to delete source')
    }
  }

  const getVisibilityIcon = (visibility: KnowledgeSourceVisibility) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-3 w-3" strokeWidth={1.5} />
      case 'workspace':
        return <Users className="h-3 w-3" strokeWidth={1.5} />
      case 'private':
      default:
        return <Lock className="h-3 w-3" strokeWidth={1.5} />
    }
  }

  const getVisibilityStyle = (visibility: KnowledgeSourceVisibility) => {
    switch (visibility) {
      case 'public':
        return 'text-[#4A7A68] bg-[#4A7A68]/[0.06] border-[#4A7A68]/10'
      case 'workspace':
        return 'text-[#3B82F6] bg-[#3B82F6]/[0.06] border-[#3B82F6]/10'
      case 'private':
      default:
        return 'text-zinc-500 bg-zinc-500/[0.06] border-zinc-500/10'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // Get pseudo-random doc type icons based on source name hash
  const getSourceDocIcons = (source: KnowledgeSource) => {
    let hash = 0
    for (let i = 0; i < source.name.length; i++) {
      hash = source.name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const count = Math.max(
      2,
      Math.min(4, (source.documentCount || 0) > 0 ? Math.min(source.documentCount, 4) : 2)
    )
    const icons = []
    for (let i = 0; i < count; i++) {
      const idx = Math.abs((hash + i * 7) % DOC_TYPE_ICONS.length)
      icons.push(DOC_TYPE_ICONS[idx])
    }
    return icons
  }

  const filteredSources = sources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const containerClass = `workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
    isSidebarCollapsed ? 'pl-20' : 'pl-72'
  }`

  // Loading state
  if (isPending || loading) {
    return (
      <div className={containerClass}>
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-5 w-24 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-3" />
            <div className="h-8 w-56 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-4 w-72 rounded-md bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
          </div>

          {/* Search skeleton */}
          <div className="flex gap-2 mb-8">
            <div className="flex-1 h-10 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
            <div className="h-10 w-20 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
                <div className="h-[140px] bg-zinc-100/60 dark:bg-white/[0.03] animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-28 rounded bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderSourceDropdown = (source: KnowledgeSource) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:text-white/50 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/w/knowledge/${source.id}`)
          }}
          className="text-[13px] font-logo"
        >
          <Pencil className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            setUploadModalSource(source)
          }}
          className="text-[13px] font-logo"
        >
          <Upload className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Upload
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteSource(source.id)
          }}
          className="text-[13px] font-logo text-red-500 focus:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto">
        <WorkspacePageHeader
          eyebrow="Knowledge Base"
          title="Knowledge"
          accent="Sources"
          description="Curate and manage documents for your AI agents"
          className="mb-8"
          actions={
            <Button
              onClick={handleCreateSource}
              className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[13px] h-9 px-4 rounded-lg transition-colors flex-shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-2" strokeWidth={2} />
              New Source
            </Button>
          }
        />

        {/* Search + View Toggle */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-white/60"
              strokeWidth={1.5}
            />
            <Input
              placeholder="Search knowledge sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl font-logo text-[13px]"
            />
          </div>
          <div className="silver-glass-pane flex items-center rounded-xl bg-transparent p-1">
            <button
              onClick={() => setViewMode('list')}
              aria-label="Show knowledge sources as list"
              aria-pressed={viewMode === 'list'}
              className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
                  : 'text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70'
              }`}
            >
              <List className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Show knowledge sources as grid"
              aria-pressed={viewMode === 'grid'}
              className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
                  : 'text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredSources.length === 0 ? (
          <div className="silver-glass-panel rounded-xl border-dashed bg-transparent py-16 px-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center mb-5">
                <Database
                  className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo mb-1.5">
                No knowledge sources yet
              </h3>
              <p className="text-[13px] text-zinc-400 dark:text-white/50 font-logo mb-6 max-w-sm leading-relaxed">
                Create your first knowledge source to start adding documents for your agents.
              </p>
              <Button
                onClick={handleCreateSource}
                className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[13px] h-9 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mr-2" strokeWidth={2} />
                Create Knowledge Source
              </Button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View - Folder Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredSources.map((source) => {
              const docIcons = getSourceDocIcons(source)
              return (
                <div
                  key={source.id}
                  className="group relative cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  onClick={() => router.push(`/w/knowledge/${source.id}`)}
                >
                  {/* Folder Card */}
                  <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
                    {/* Folder Tab */}
                    <div className="relative">
                      <div className="absolute top-0 left-0 w-[45%] h-[18px]">
                        <svg
                          viewBox="0 0 120 18"
                          fill="none"
                          className="w-full h-full"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M0 4C0 1.79 1.79 0 4 0H90C92 0 94 1 95 3L100 12C101 14 103 15 105 15H120V18H0V4Z"
                            className="fill-zinc-200/80 dark:fill-white/[0.06]"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Folder Body */}
                    <div className="mt-[14px] rounded-t-xl bg-zinc-200/60 dark:bg-white/[0.05] border border-zinc-300/40 dark:border-white/[0.08] border-b-0">
                      <div className="relative h-[120px] flex items-center justify-center overflow-hidden rounded-t-xl">
                        {/* Folder inner content - stacked files illustration */}
                        <div className="relative w-full h-full flex items-end justify-center pb-3">
                          {/* Stacked document cards */}
                          <div className="relative flex items-end gap-1.5">
                            <div className="w-12 h-16 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/60 dark:border-white/10 flex items-center justify-center transform -rotate-3 translate-y-1">
                              <FileText
                                className="h-5 w-5 text-zinc-300 dark:text-white/20"
                                strokeWidth={1}
                              />
                            </div>
                            <div className="w-12 h-[72px] rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/60 dark:border-white/10 flex items-center justify-center transform rotate-1">
                              <FileText
                                className="h-5 w-5 text-zinc-300 dark:text-white/20"
                                strokeWidth={1}
                              />
                            </div>
                            <div className="w-12 h-16 rounded-md bg-white dark:bg-zinc-700 shadow-sm border border-zinc-200/60 dark:border-white/10 flex items-center justify-center transform rotate-3 translate-y-1">
                              <FileText
                                className="h-5 w-5 text-zinc-300 dark:text-white/20"
                                strokeWidth={1}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Doc type icon badges - bottom left */}
                        <div className="absolute bottom-2.5 left-3 flex items-center -space-x-1">
                          {docIcons.map((item, i) => (
                            <div
                              key={i}
                              className="h-6 w-6 rounded-full flex items-center justify-center border-2 border-zinc-200/80 dark:border-zinc-700"
                              style={{ backgroundColor: item.bg, zIndex: docIcons.length - i }}
                            >
                              <item.Icon className="h-3 w-3 text-white" strokeWidth={2} />
                            </div>
                          ))}
                        </div>

                        {/* Actions overlay - top right */}
                        <div className="absolute top-2 right-2 z-10">
                          {renderSourceDropdown(source)}
                        </div>

                        {/* Visibility badge */}
                        <div className="absolute top-2.5 left-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${getVisibilityStyle(source.visibility)}`}
                          >
                            {getVisibilityIcon(source.visibility)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer - Source info */}
                    <div className="px-4 py-3.5 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3
                            className="text-[13px] font-semibold text-zinc-800 dark:text-white font-logo truncate"
                            title={source.name}
                          >
                            {source.name}
                          </h3>
                          <p className="text-[12px] text-zinc-400 dark:text-white/50 font-logo mt-0.5">
                            {source.documentCount}{' '}
                            {source.documentCount === 1 ? 'Document' : 'Documents'}
                            {source.totalSize > 0 && (
                              <span className="text-zinc-300 dark:text-white/30">
                                {' '}
                                · {formatFileSize(source.totalSize)}
                              </span>
                            )}
                          </p>
                        </div>
                        <ArrowRight
                          className="h-3.5 w-3.5 text-zinc-300 dark:text-white/30 group-hover:text-[#4A7A68] dark:group-hover:text-[#94B8A6] transition-colors flex-shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* New Source Card */}
            <div
              className="group cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              onClick={handleCreateSource}
            >
              <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden border-dashed h-full min-h-[214px] flex flex-col items-center justify-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center group-hover:bg-[#4A7A68]/[0.1] dark:group-hover:bg-[#94B8A6]/[0.1] transition-colors">
                  <Plus className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                </div>
                <span className="text-[13px] font-logo font-medium text-zinc-400 dark:text-white/50 group-hover:text-[#4A7A68] dark:group-hover:text-[#94B8A6] transition-colors">
                  New Source
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_60px_40px] gap-4 px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold">
                Source
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Docs
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Size
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Agents
              </div>
              <div />
            </div>

            {/* Rows */}
            {filteredSources.map((source, index) => {
              const docIcons = getSourceDocIcons(source)
              return (
                <div
                  key={source.id}
                  className={`group flex sm:grid sm:grid-cols-[1fr_80px_80px_60px_40px] items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${
                    index < filteredSources.length - 1
                      ? 'border-b border-black/[0.04] dark:border-white/[0.04]'
                      : ''
                  }`}
                  onClick={() => router.push(`/w/knowledge/${source.id}`)}
                >
                  {/* Source info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-zinc-200/60 dark:bg-white/[0.05] border border-zinc-300/30 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0 relative">
                      <FolderOpen
                        className="h-4.5 w-4.5 text-zinc-400 dark:text-white/40"
                        strokeWidth={1.5}
                      />
                      {/* Mini doc icons */}
                      <div className="absolute -bottom-1 -right-1 flex items-center -space-x-0.5">
                        {docIcons.slice(0, 2).map((item, i) => (
                          <div
                            key={i}
                            className="h-3.5 w-3.5 rounded-full flex items-center justify-center border border-white dark:border-zinc-800"
                            style={{ backgroundColor: item.bg, zIndex: 2 - i }}
                          >
                            <item.Icon className="h-2 w-2 text-white" strokeWidth={2.5} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-[13px] font-semibold text-zinc-800 dark:text-white font-logo truncate"
                          title={source.name}
                        >
                          {source.name}
                        </h3>
                        <span
                          className={`hidden lg:inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md border flex-shrink-0 ${getVisibilityStyle(source.visibility)}`}
                        >
                          {getVisibilityIcon(source.visibility)}
                          {source.visibility}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-400 dark:text-white/60 font-logo truncate mt-0.5">
                        {source.description || 'No description'}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:block text-center">
                    <span className="text-[13px] font-semibold text-zinc-700 dark:text-white/85 font-logo">
                      {source.documentCount}
                    </span>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="text-[13px] text-zinc-500 dark:text-white/70 font-logo">
                      {formatFileSize(source.totalSize)}
                    </span>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="text-[13px] text-zinc-500 dark:text-white/70 font-logo">
                      {source.usageCount}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 flex-shrink-0">
                    {renderSourceDropdown(source)}
                    <ArrowRight
                      className="h-3.5 w-3.5 text-zinc-300 dark:text-white/30 group-hover:text-[#4A7A68] dark:group-hover:text-[#94B8A6] transition-colors"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Create Source Modal */}
        <CreateSourceModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={handleSourceCreated}
          workspaceId={activeWorkspaceId || undefined}
        />

        {/* Upload Documents Modal */}
        {uploadModalSource && (
          <UploadDocumentsModal
            open={!!uploadModalSource}
            onOpenChange={(open) => !open && setUploadModalSource(null)}
            sourceId={uploadModalSource.id}
            sourceName={uploadModalSource.name}
            onSuccess={handleSourceCreated}
          />
        )}
      </div>
    </div>
  )
}
