'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Code,
  Database,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  HardDrive,
  Image,
  LayoutGrid,
  List,
  MoreVertical,
  Music,
  Search,
  Trash2,
  Video,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkspacePageHeader } from '@/app/w/components/workspace-shell'

const logger = createLogger('FilesPage')

interface FileRecord {
  id: string
  userId: string
  workspaceId: string | null
  name: string
  path: string
  mimeType: string
  size: number
  knowledgeDocumentId: string | null
  metadata: any
  status: 'active' | 'archived' | 'deleted'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type ViewMode = 'grid' | 'list'

const FILE_ICON_MAP: {
  test: (t: string) => boolean
  Icon: React.ComponentType<any>
  color: string
  label: string
}[] = [
  { test: (t) => t.startsWith('image/'), Icon: Image, color: '#4A7A68', label: 'Image' },
  { test: (t) => t.startsWith('video/'), Icon: Video, color: '#8B5CF6', label: 'Video' },
  { test: (t) => t.startsWith('audio/'), Icon: Music, color: '#EC4899', label: 'Audio' },
  {
    test: (t) => t.includes('zip') || t.includes('tar') || t.includes('rar'),
    Icon: Archive,
    color: '#F59E0B',
    label: 'Archive',
  },
  {
    test: (t) => t.includes('javascript') || t.includes('typescript') || t.includes('python'),
    Icon: Code,
    color: '#3B82F6',
    label: 'Code',
  },
  { test: (t) => t.includes('pdf'), Icon: FileText, color: '#EF4444', label: 'PDF' },
  {
    test: (t) => t.includes('document') || t.includes('word'),
    Icon: FileText,
    color: '#3B82F6',
    label: 'Document',
  },
  {
    test: (t) => t.includes('spreadsheet') || t.includes('excel') || t.includes('csv'),
    Icon: FileText,
    color: '#4A7A68',
    label: 'Spreadsheet',
  },
]

function getFileInfo(mimeType?: string) {
  if (!mimeType) return { Icon: File, color: '#71717A', label: 'File' }
  const match = FILE_ICON_MAP.find((m) => m.test(mimeType))
  return match
    ? { Icon: match.Icon, color: match.color, label: match.label }
    : { Icon: File, color: '#71717A', label: 'File' }
}

function getFileExtension(name: string) {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
}

export default function FilesPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [storageUsed, setStorageUsed] = useState(0)
  const [storageLimit, setStorageLimit] = useState(100 * 1024 * 1024)
  const storagePercent = (storageUsed / storageLimit) * 100

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user) {
      loadFiles(abortController.signal)
      loadStorageInfo(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, activeWorkspaceId])

  const loadFiles = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('status', 'active')
      const response = await fetch(
        `/api/files${params.toString() ? `?${params.toString()}` : ''}`,
        {
          signal,
        }
      )
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setFiles(data || [])
      }
    } catch (error: any) {
      if (isAbortLikeError(error, signal)) return
      logger.error('Failed to load files', error)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const loadStorageInfo = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/storage/info', { signal })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setStorageUsed(data.storage.used)
        setStorageLimit(data.storage.limit)
      }
    } catch (error: any) {
      if (isAbortLikeError(error, signal)) return
      logger.error('Failed to load storage info', error)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })

      if (response.ok) {
        setFiles(files.filter((f) => f.id !== fileId))
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      logger.error('Failed to delete file', error)
      alert('Failed to delete file')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filteredFiles = files.filter(
    (file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.mimeType?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group files by type for stats
  const fileTypeStats = filteredFiles.reduce(
    (acc, file) => {
      const { label } = getFileInfo(file.mimeType)
      acc[label] = (acc[label] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const renderFileDropdown = (file: FileRecord) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-all">
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="rounded-lg min-w-[140px]"
        onClick={(e) => e.stopPropagation()}
      >
        {file.knowledgeDocumentId && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              router.push('/w/knowledge')
            }}
            className="text-[13px] font-logo cursor-pointer"
          >
            <Database className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
            View in Knowledge
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteFile(file.id)
          }}
          className="text-red-500 focus:text-red-500 text-[13px] font-logo cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const containerClass = `workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
    isSidebarCollapsed ? 'pl-20' : 'pl-72'
  }`

  if (isPending || loading) {
    return (
      <div className={containerClass}>
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-5 w-16 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-3" />
            <div className="h-8 w-32 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-4 w-48 rounded-md bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="flex gap-3 mb-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="silver-glass-pane rounded-lg bg-transparent px-4 py-3 animate-pulse"
              >
                <div className="h-4 w-16 rounded bg-zinc-100 dark:bg-white/[0.04]" />
              </div>
            ))}
          </div>

          {/* Search skeleton */}
          <div className="flex gap-2 mb-6">
            <div className="flex-1 h-10 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
            <div className="h-10 w-20 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
          </div>

          {/* Table skeleton */}
          <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="px-5 py-3.5 border-b border-black/[0.03] dark:border-white/[0.03] flex items-center gap-4"
              >
                <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-48 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                </div>
                <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto">
        <WorkspacePageHeader
          eyebrow="Resources"
          title="Uploaded"
          accent="Files"
          description={`${filteredFiles.length} ${filteredFiles.length === 1 ? 'file' : 'files'} uploaded across your workspace`}
          className="mb-8"
          actions={
            <div className="silver-glass-pane flex items-center gap-3 rounded-xl bg-transparent px-4 py-3 flex-shrink-0">
              <HardDrive className="h-4 w-4 text-zinc-400 dark:text-white/50" strokeWidth={1.5} />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                    Storage
                  </span>
                  <span className="text-[11px] font-logo text-zinc-500 dark:text-white/60">
                    {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
                  </span>
                </div>
                <div className="w-32 h-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storagePercent < 80
                        ? 'bg-[#4A7A68]'
                        : storagePercent < 95
                          ? 'bg-[#F59E0B]'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(storagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          }
        />

        {/* File type stats pills */}
        {Object.keys(fileTypeStats).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(fileTypeStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([type, count]) => {
                const info = FILE_ICON_MAP.find((m) => m.label === type) || {
                  Icon: File,
                  color: '#71717A',
                }
                return (
                  <div
                    key={type}
                    className="silver-glass-chip flex items-center gap-1.5 rounded-lg bg-transparent px-3 py-1.5"
                  >
                    <info.Icon
                      className="h-3 w-3"
                      style={{ color: info.color }}
                      strokeWidth={1.5}
                    />
                    <span className="text-[11px] font-logo font-medium text-zinc-600 dark:text-white/70">
                      {count} {type}
                      {count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

        {/* Search & View Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-white/40"
              strokeWidth={1.5}
            />
            <input
              placeholder="Search files by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="silver-glass-pane smoky-glass-pane glass-field w-full h-10 rounded-xl border-0 bg-transparent pl-9 pr-3 text-[13px] font-logo text-zinc-700 dark:text-white/85 placeholder:text-zinc-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-0 transition-all"
            />
          </div>

          <div className="silver-glass-pane flex items-center rounded-xl bg-transparent p-1">
            {[
              { mode: 'list' as ViewMode, Icon: List },
              { mode: 'grid' as ViewMode, Icon: LayoutGrid },
            ].map(({ mode: m, Icon }) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                aria-label={`Show files as ${m}`}
                aria-pressed={viewMode === m}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === m
                    ? 'bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6]'
                    : 'text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {filteredFiles.length === 0 ? (
          <div className="silver-glass-panel rounded-xl border-dashed bg-transparent py-16 px-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center mb-5">
                <FolderOpen
                  className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo mb-1.5">
                No files yet
              </h3>
              <p className="text-[13px] text-zinc-400 dark:text-white/50 font-logo max-w-sm leading-relaxed">
                Upload files from blocks or knowledge sources to see them here.
              </p>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[1fr_90px_80px_100px_40px] gap-4 px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                Name
              </span>
              <span className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                Type
              </span>
              <span className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                Size
              </span>
              <span className="text-[11px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                Added
              </span>
              <span />
            </div>

            {filteredFiles.map((file, index) => {
              const { Icon, color } = getFileInfo(file.mimeType)
              const ext = getFileExtension(file.name)
              return (
                <div
                  key={file.id}
                  className={`group sm:grid sm:grid-cols-[1fr_90px_80px_100px_40px] flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${
                    index < filteredFiles.length - 1
                      ? 'border-b border-black/[0.04] dark:border-white/[0.04]'
                      : ''
                  }`}
                >
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center relative"
                      style={{ backgroundColor: `${color}08`, border: `1px solid ${color}12` }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color }} strokeWidth={1.5} />
                      {ext && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 text-[7px] font-logo font-bold uppercase px-1 py-px rounded"
                          style={{ backgroundColor: color, color: 'white' }}
                        >
                          {ext}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span
                        className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 block truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      {file.knowledgeDocumentId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-logo text-[#4A7A68] dark:text-[#94B8A6]">
                          <Database className="h-2.5 w-2.5" strokeWidth={1.5} />
                          Linked to Knowledge
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <span className="hidden sm:block text-[12px] font-logo text-zinc-400 dark:text-white/50 truncate">
                    {file.mimeType?.split('/')[1] || file.mimeType}
                  </span>

                  {/* Size */}
                  <span className="hidden sm:block text-[12px] font-logo text-zinc-500 dark:text-white/60">
                    {formatFileSize(file.size)}
                  </span>

                  {/* Date */}
                  <span className="hidden sm:block text-[12px] font-logo text-zinc-400 dark:text-white/50">
                    {formatDate(file.createdAt)}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {renderFileDropdown(file)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredFiles.map((file) => {
              const { Icon, color } = getFileInfo(file.mimeType)
              const ext = getFileExtension(file.name)
              return (
                <div
                  key={file.id}
                  className="silver-glass-panel rounded-xl bg-transparent overflow-hidden group transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* File icon area */}
                  <div className="relative flex h-[120px] items-center justify-center bg-zinc-100/40 dark:bg-white/[0.02]">
                    <div
                      className="h-16 w-16 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${color}08`, border: `1px solid ${color}12` }}
                    >
                      <Icon className="h-8 w-8" style={{ color }} strokeWidth={1.5} />
                    </div>

                    {/* Extension badge */}
                    {ext && (
                      <div className="absolute bottom-3 left-3">
                        <span
                          className="text-[9px] font-logo font-bold uppercase px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: color, color: 'white' }}
                        >
                          {ext}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {renderFileDropdown(file)}
                    </div>

                    {/* Knowledge badge */}
                    {file.knowledgeDocumentId && (
                      <div className="absolute top-2.5 left-3">
                        <span className="inline-flex items-center gap-1 text-[9px] font-logo font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-[#4A7A68]/10 bg-[#4A7A68]/[0.06] text-[#4A7A68] dark:border-[#94B8A6]/10 dark:bg-[#94B8A6]/[0.06] dark:text-[#94B8A6]">
                          <Database className="h-2.5 w-2.5" strokeWidth={1.5} />
                          Knowledge
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 border-t border-black/[0.04] dark:border-white/[0.04]">
                    <h3
                      className="text-[13px] font-logo font-medium text-zinc-700 dark:text-white/85 truncate mb-2"
                      title={file.name}
                    >
                      {file.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-logo text-zinc-500 dark:text-white/60">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                        {formatDate(file.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
