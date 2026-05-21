'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Columns3,
  Database,
  Download,
  LayoutGrid,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Rows3,
  Search,
  Table2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { WorkspacePageHeader } from '@/app/w/components/workspace-shell'

const logger = createLogger('DataTablesPage')

interface DataTableMeta {
  id: string
  name: string
  description: string | null
  icon: string
  rowCount: number
  columnCount: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

type ViewMode = 'list' | 'grid'

export default function DataTablesPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [tables, setTables] = useState<DataTableMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newTableDescription, setNewTableDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user) {
      loadTables(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, activeWorkspaceId])

  const loadTables = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId)
      const response = await fetch(`/api/tables${params.toString() ? `?${params}` : ''}`, {
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setTables(data.tables || [])
      }
    } catch (error) {
      if (isAbortLikeError(error, signal)) return
      logger.error('Failed to load tables', error)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTableName,
          description: newTableDescription || null,
          workspaceId: activeWorkspaceId,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setShowCreateDialog(false)
        setNewTableName('')
        setNewTableDescription('')
        router.push(`/w/tables/${data.table.id}`)
      }
    } catch (error) {
      logger.error('Failed to create table', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table? All data will be lost.')) return
    try {
      const response = await fetch(`/api/tables?id=${tableId}`, { method: 'DELETE' })
      if (response.ok) {
        setTables((prev) => prev.filter((t) => t.id !== tableId))
      }
    } catch (error) {
      logger.error('Failed to delete table', error)
    }
  }

  const filteredTables = tables.filter(
    (t) =>
      !t.isArchived &&
      (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const containerClass = `workspace-stage min-h-screen py-8 px-6 transition-all duration-300 ${
    isSidebarCollapsed ? 'pl-20' : 'pl-72'
  }`

  const renderTableDropdown = (table: DataTableMeta) => (
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
            router.push(`/w/tables/${table.id}`)
          }}
          className="text-[13px] font-logo"
        >
          <Pencil className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px] font-logo">
          <Download className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteTable(table.id)
          }}
          className="text-[13px] font-logo text-red-500 focus:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Loading state
  if (isPending || loading) {
    return (
      <div className={containerClass}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-5 w-20 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-3" />
            <div className="h-8 w-48 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-4 w-72 rounded-md bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
          </div>
          <div className="flex gap-2 mb-6">
            <div className="flex-1 h-10 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
            <div className="h-10 w-20 rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse" />
          </div>
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-4 ${i < 5 ? 'border-b border-black/[0.04] dark:border-white/[0.04]' : ''}`}
              >
                <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-4 w-36 rounded bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-56 rounded bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
                </div>
                <div className="hidden sm:flex items-center gap-6">
                  <div className="h-4 w-12 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                  <div className="h-4 w-12 rounded bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                </div>
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
          eyebrow="Data Management"
          title="Data"
          accent="Tables"
          description="Store and manage structured data for your workflows"
          className="mb-8"
          actions={
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[13px] h-9 px-4 rounded-lg transition-colors flex-shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 mr-2" strokeWidth={2} />
              New Table
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
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl font-logo text-[13px]"
            />
          </div>
          <div className="silver-glass-pane flex items-center rounded-xl bg-transparent p-1">
            <button
              onClick={() => setViewMode('list')}
              aria-label="Show tables as list"
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
              aria-label="Show tables as grid"
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
        {filteredTables.length === 0 ? (
          <div className="silver-glass-panel rounded-xl border-dashed bg-transparent py-16 px-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center mb-5">
                <Table2 className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </div>
              <h3 className="text-[15px] font-semibold text-zinc-800 dark:text-white font-logo mb-1.5">
                No data tables yet
              </h3>
              <p className="text-[13px] text-zinc-400 dark:text-white/50 font-logo mb-6 max-w-sm leading-relaxed">
                Create your first data table to store and manage structured data for your workflows.
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-[#4A7A68] hover:bg-[#3d6556] text-white font-logo text-[13px] h-9 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mr-2" strokeWidth={2} />
                Create Table
              </Button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px_40px] gap-4 px-5 py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold">
                Table
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Rows
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Columns
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo font-semibold text-center">
                Updated
              </div>
              <div />
            </div>

            {filteredTables.map((table, index) => (
              <div
                key={table.id}
                className={`group flex sm:grid sm:grid-cols-[1fr_80px_80px_100px_40px] items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${
                  index < filteredTables.length - 1
                    ? 'border-b border-black/[0.04] dark:border-white/[0.04]'
                    : ''
                }`}
                onClick={() => router.push(`/w/tables/${table.id}`)}
              >
                {/* Table info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#4A7A6808', border: '1px solid #4A7A6815' }}
                  >
                    <Database
                      className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-[13px] font-semibold text-zinc-800 dark:text-white font-logo truncate"
                      title={table.name}
                    >
                      {table.name}
                    </h3>
                    <p className="text-[12px] text-zinc-400 dark:text-white/60 font-logo truncate mt-0.5">
                      {table.description || 'No description'}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center justify-center gap-1">
                  <Rows3 className="h-3 w-3 text-zinc-300 dark:text-white/30" strokeWidth={1.5} />
                  <span className="text-[13px] font-semibold text-zinc-700 dark:text-white/85 font-logo">
                    {table.rowCount}
                  </span>
                </div>
                <div className="hidden sm:flex items-center justify-center gap-1">
                  <Columns3
                    className="h-3 w-3 text-zinc-300 dark:text-white/30"
                    strokeWidth={1.5}
                  />
                  <span className="text-[13px] text-zinc-500 dark:text-white/70 font-logo">
                    {table.columnCount}
                  </span>
                </div>
                <div className="hidden sm:block text-center">
                  <span className="text-[12px] text-zinc-400 dark:text-white/60 font-logo">
                    {new Date(table.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 flex-shrink-0">
                  {renderTableDropdown(table)}
                  <ArrowRight
                    className="h-3.5 w-3.5 text-zinc-300 dark:text-white/30 group-hover:text-[#4A7A68] dark:group-hover:text-[#94B8A6] transition-colors"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="silver-glass-panel group relative rounded-xl bg-transparent p-5 cursor-pointer transition-all duration-200"
                onClick={() => router.push(`/w/tables/${table.id}`)}
              >
                {/* Top */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#4A7A6808', border: '1px solid #4A7A6815' }}
                    >
                      <Database
                        className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-[14px] font-semibold text-zinc-800 dark:text-white font-logo truncate"
                        title={table.name}
                      >
                        {table.name}
                      </h3>
                      <span className="text-[11px] text-zinc-400 dark:text-white/60 font-logo mt-1 block">
                        {new Date(table.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {renderTableDropdown(table)}
                </div>

                {/* Description */}
                <p className="text-[12px] text-zinc-500 dark:text-white/70 font-logo leading-relaxed line-clamp-2 mb-4 min-h-[2.5em]">
                  {table.description || 'No description'}
                </p>

                {/* Separator */}
                <div className="h-px bg-black/[0.04] dark:bg-white/[0.04] mb-4" />

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-2 gap-6 flex-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo mb-0.5">
                        Rows
                      </div>
                      <div className="text-[14px] font-semibold text-zinc-700 dark:text-white/85 font-logo">
                        {table.rowCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/60 font-logo mb-0.5">
                        Columns
                      </div>
                      <div className="text-[14px] font-semibold text-zinc-700 dark:text-white/85 font-logo">
                        {table.columnCount}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-zinc-300 dark:text-white/40 group-hover:text-[#4A7A68] dark:group-hover:text-[#94B8A6] transition-colors flex-shrink-0 ml-2"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Table Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[480px] rounded-[16px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
                  <Table2
                    className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
                    Create New Table
                  </DialogTitle>
                  <p className="text-[12px] font-logo text-zinc-500 dark:text-white/70 mt-0.5">
                    Store structured data for your workflows
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-5">
              <div className="h-px bg-black/[0.04] dark:bg-white/[0.04] -mx-6" />

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/70 font-logo mb-1.5 block">
                  Table Name <span className="text-[#4A7A68]">*</span>
                </label>
                <input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g., Customer Leads"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTable()}
                  className="silver-glass-pane smoky-glass-pane glass-field w-full h-10 px-3 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 placeholder:text-zinc-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/70 font-logo mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={newTableDescription}
                  onChange={(e) => setNewTableDescription(e.target.value)}
                  placeholder="What is this table for?"
                  rows={2}
                  className="silver-glass-pane smoky-glass-pane glass-textarea w-full px-3 py-2.5 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 placeholder:text-zinc-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all resize-none"
                />
              </div>
            </div>

            <div className="h-px bg-black/[0.04] dark:bg-white/[0.04]" />
            <div className="px-6 py-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="silver-glass-chip h-9 px-4 rounded-lg bg-transparent text-[13px] font-logo font-medium text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!newTableName.trim() || creating}
                className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Table
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </>
                )}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
