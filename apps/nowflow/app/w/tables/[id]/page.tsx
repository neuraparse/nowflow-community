'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'

const logger = createLogger('TableDetailPage')

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 0)
  return String(value)
}

function CellValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-zinc-300 dark:text-white/30">—</span>
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value)
    return (
      <span
        className="font-mono text-[11px] text-zinc-500 dark:text-white/60 truncate block max-w-[300px]"
        title={str}
      >
        {str.length > 80 ? str.slice(0, 80) + '…' : str}
      </span>
    )
  }
  const str = String(value)
  return (
    <span
      className={str.length > 100 ? 'truncate block max-w-[300px]' : ''}
      title={str.length > 100 ? str : undefined}
    >
      {str.length > 100 ? str.slice(0, 100) + '…' : str}
    </span>
  )
}

interface Column {
  id: string
  name: string
  type: string
  order: number
  width?: number
  options?: any
  aiConfig?: any
}

interface Row {
  id: string
  data: Record<string, any>
  order: number
  createdAt: string
  updatedAt: string
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'ai_generated', label: 'AI Generated' },
]

export default function TableDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [table, setTable] = useState<any>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState('text')
  const [addingColumn, setAddingColumn] = useState(false)

  const loadTable = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tables/${id}?page=${page}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setTable(data.table)
        setColumns(data.columns)
        setRows(data.rows)
        setPagination(data.pagination)
      } else {
        router.push('/w/tables')
      }
    } catch (error) {
      logger.error('Failed to load table', error)
    } finally {
      setLoading(false)
    }
  }, [id, page, router])

  useEffect(() => {
    if (id) loadTable()
  }, [id, loadTable])

  const handleAddRow = async () => {
    try {
      const defaultData: Record<string, any> = {}
      columns.forEach((col) => {
        switch (col.type) {
          case 'number':
            defaultData[col.id] = 0
            break
          case 'boolean':
            defaultData[col.id] = false
            break
          default:
            defaultData[col.id] = ''
        }
      })

      const response = await fetch(`/api/tables/${id}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: defaultData }),
      })

      if (response.ok) {
        const data = await response.json()
        setRows((prev) => [...prev, data.row])
      }
    } catch (error) {
      logger.error('Failed to add row', error)
    }
  }

  const handleUpdateCell = async (rowId: string, columnId: string, value: any) => {
    try {
      const response = await fetch(`/api/tables/${id}/rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, data: { [columnId]: value } }),
      })

      if (response.ok) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId ? { ...row, data: { ...row.data, [columnId]: value } } : row
          )
        )
      }
    } catch (error) {
      logger.error('Failed to update cell', error)
    }
    setEditingCell(null)
  }

  const handleDeleteRow = async (rowId: string) => {
    try {
      const response = await fetch(`/api/tables/${id}/rows?rowId=${rowId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setRows((prev) => prev.filter((r) => r.id !== rowId))
      }
    } catch (error) {
      logger.error('Failed to delete row', error)
    }
  }

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return
    setAddingColumn(true)
    try {
      const response = await fetch(`/api/tables/${id}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColumnName, type: newColumnType }),
      })

      if (response.ok) {
        const data = await response.json()
        setColumns((prev) => [...prev, data.column])
        setShowAddColumnDialog(false)
        setNewColumnName('')
        setNewColumnType('text')
      }
    } catch (error) {
      logger.error('Failed to add column', error)
    } finally {
      setAddingColumn(false)
    }
  }

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Delete this column? Data in this column will be lost.')) return
    try {
      const response = await fetch(`/api/tables/${id}/columns?columnId=${columnId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setColumns((prev) => prev.filter((c) => c.id !== columnId))
      }
    } catch (error) {
      logger.error('Failed to delete column', error)
    }
  }

  const handleExportCSV = () => {
    if (!columns.length || !rows.length) return
    const headers = columns.map((c) => c.name).join(',')
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const val = row.data[col.id]
          const strVal = val === null || val === undefined ? '' : String(val)
          return strVal.includes(',') || strVal.includes('"')
            ? `"${strVal.replace(/"/g, '""')}"`
            : strVal
        })
        .join(',')
    )
    const csv = [headers, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table?.name || 'table'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div
        className={`workspace-stage min-h-screen py-6 px-6 transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-full mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-48 rounded-md bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
              <div className="h-3.5 w-32 rounded-md bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 overflow-hidden">
            <div className="h-10 border-b border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01]" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-10 border-b border-black/[0.03] dark:border-white/[0.03] px-4 flex items-center gap-4"
              >
                <div className="h-3 w-6 rounded bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
                <div className="h-3 flex-1 rounded bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
                <div className="h-3 w-32 rounded bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
                <div className="h-3 w-24 rounded bg-zinc-200/60 dark:bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage min-h-screen py-6 px-6 transition-all duration-300 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/w/tables')}
              className="silver-glass-chip h-9 w-9 rounded-lg bg-transparent flex items-center justify-center text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-[17px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
                {table?.name || 'Untitled Table'}
              </h1>
              <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60 mt-0.5">
                {pagination.total} rows · {columns.length} columns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="silver-glass-chip h-9 px-3.5 rounded-lg bg-transparent text-[13px] font-logo font-medium text-zinc-600 dark:text-white/80 hover:text-zinc-800 dark:hover:text-white/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
              Export
            </button>
            <button
              onClick={handleAddRow}
              className="h-9 px-3.5 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Add Row
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="silver-glass-panel rounded-xl bg-transparent overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="w-10 px-3 py-2.5 text-left text-[10px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50">
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className="px-3 py-2.5 text-left text-[10px] font-logo font-semibold uppercase tracking-wider text-zinc-400 dark:text-white/50 group"
                      style={{ minWidth: column.width || 200 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>{column.name}</span>
                          {column.type === 'ai_generated' && (
                            <Sparkles className="h-3 w-3 text-[#8B5CF6]" strokeWidth={1.5} />
                          )}
                          <span className="text-[9px] text-zinc-300 dark:text-white/30 font-normal normal-case tracking-normal">
                            {column.type}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-white/[0.04]">
                              <MoreHorizontal
                                className="h-3.5 w-3.5 text-zinc-400 dark:text-white/50"
                                strokeWidth={1.5}
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem
                              onClick={() => handleDeleteColumn(column.id)}
                              className="text-red-500 focus:text-red-500 text-[13px] font-logo cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                              Delete Column
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  ))}
                  <th className="w-10 px-3 py-2.5">
                    <button
                      onClick={() => setShowAddColumnDialog(true)}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-zinc-400 dark:text-white/40 hover:text-[#4A7A68] dark:hover:text-[#94B8A6] hover:bg-[#4A7A68]/[0.06] dark:hover:bg-[#94B8A6]/[0.06] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className="border-b border-black/[0.03] dark:border-white/[0.03] hover:bg-[#fafafa]/50 dark:hover:bg-white/[0.01] group"
                  >
                    <td className="px-3 py-2 text-[11px] font-logo text-zinc-300 dark:text-white/30">
                      {(page - 1) * 50 + rowIndex + 1}
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className="px-3 py-1.5">
                        {editingCell?.rowId === row.id && editingCell?.columnId === column.id ? (
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleUpdateCell(row.id, column.id, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCell(row.id, column.id, editValue)
                              if (e.key === 'Escape') setEditingCell(null)
                            }}
                            autoFocus
                            className="silver-glass-pane w-full h-8 px-2 rounded-md border-[#4A7A68]/30 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 focus:outline-none focus:ring-1 focus:ring-[#4A7A68]/20 transition-all"
                          />
                        ) : (
                          <div
                            className="px-2 py-1.5 min-h-[32px] text-[13px] font-logo text-zinc-700 dark:text-white/85 cursor-text rounded-md hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                            onClick={() => {
                              setEditingCell({ rowId: row.id, columnId: column.id })
                              setEditValue(formatCellValue(row.data[column.id]))
                            }}
                          >
                            {column.type === 'boolean' ? (
                              <input
                                type="checkbox"
                                checked={!!row.data[column.id]}
                                onChange={(e) =>
                                  handleUpdateCell(row.id, column.id, e.target.checked)
                                }
                                className="rounded border-black/[0.1] dark:border-white/[0.1] text-[#4A7A68] focus:ring-[#4A7A68]/20"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <CellValue value={row.data[column.id]} />
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
                          <Table2
                            className="h-4.5 w-4.5 text-[#4A7A68] dark:text-[#94B8A6]"
                            strokeWidth={1.5}
                          />
                        </div>
                        <div>
                          <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60">
                            No rows yet
                          </p>
                          <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                            Add your first row to get started
                          </p>
                        </div>
                        <button
                          onClick={handleAddRow}
                          className="silver-glass-chip h-8 px-3 rounded-lg bg-transparent text-[12px] font-logo font-medium text-zinc-600 dark:text-white/80 transition-colors inline-flex items-center gap-1.5 mt-1"
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.5} />
                          Add first row
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.04] dark:border-white/[0.04]">
              <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60">
                Page {page} of {pagination.totalPages} ({pagination.total} total rows)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="silver-glass-chip h-8 w-8 rounded-lg bg-transparent flex items-center justify-center text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="silver-glass-chip h-8 w-8 rounded-lg bg-transparent flex items-center justify-center text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add Column Dialog */}
        <Dialog open={showAddColumnDialog} onOpenChange={setShowAddColumnDialog}>
          <DialogContent className="sm:max-w-[420px] rounded-[16px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
                  <Columns3
                    className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
                    Add Column
                  </DialogTitle>
                  <p className="text-[12px] font-logo text-zinc-500 dark:text-white/70 mt-0.5">
                    Add a new column to your table
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
              <div className="h-px bg-black/[0.04] dark:bg-white/[0.04] -mx-6" />

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-1.5 block">
                  Column Name <span className="text-[#4A7A68]">*</span>
                </label>
                <input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="e.g., Email Address"
                  autoFocus
                  className="silver-glass-pane smoky-glass-pane glass-field w-full h-10 px-3 rounded-lg border-0 bg-transparent text-[13px] font-logo text-zinc-800 dark:text-white/90 placeholder:text-zinc-400 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white/90 font-logo mb-1.5 block">
                  Column Type
                </label>
                <Select value={newColumnType} onValueChange={setNewColumnType}>
                  <SelectTrigger className="h-10 rounded-lg text-[13px] font-logo text-zinc-800 dark:text-white/90 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {COLUMN_TYPES.map((type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="text-[13px] font-logo cursor-pointer"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-black/[0.04] dark:bg-white/[0.04]" />
            <div className="px-6 py-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddColumnDialog(false)}
                disabled={addingColumn}
                className="h-9 px-4 rounded-lg text-[13px] font-logo font-medium text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleAddColumn}
                disabled={addingColumn || !newColumnName.trim()}
                className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {addingColumn ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                    Adding...
                  </>
                ) : (
                  <>
                    Add Column
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
