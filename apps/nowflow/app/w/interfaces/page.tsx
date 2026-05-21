'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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

const logger = createLogger('InterfacesPage')

interface FormMeta {
  id: string
  name: string
  description: string | null
  slug: string
  status: string
  submitCount: number
  submissionCount: number
  isPublic: boolean
  workflowId: string | null
  dataTableId: string | null
  createdAt: string
  updatedAt: string
}

export default function InterfacesPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [forms, setForms] = useState<FormMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [newFormDescription, setNewFormDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user) {
      loadForms(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, activeWorkspaceId])

  const loadForms = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId)
      const response = await fetch(`/api/interfaces${params.toString() ? `?${params}` : ''}`, {
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setForms(data.forms || [])
      }
    } catch (error) {
      if (isAbortLikeError(error, signal)) return
      logger.error('Failed to load forms', error)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const handleCreateForm = async () => {
    if (!newFormName.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFormName,
          description: newFormDescription || null,
          workspaceId: activeWorkspaceId,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setShowCreateDialog(false)
        setNewFormName('')
        setNewFormDescription('')
        router.push(`/w/interfaces/${data.form.id}`)
      }
    } catch (error) {
      logger.error('Failed to create form', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form? All submissions will be lost.')) return
    try {
      const response = await fetch(`/api/interfaces?id=${formId}`, { method: 'DELETE' })
      if (response.ok) {
        setForms((prev) => prev.filter((f) => f.id !== formId))
      }
    } catch (error) {
      logger.error('Failed to delete form', error)
    }
  }

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/forms/${slug}`
    navigator.clipboard.writeText(url)
  }

  const filteredForms = forms.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border text-[#4A7A68] bg-[#4A7A68]/[0.06] border-[#4A7A68]/10">
            Published
          </span>
        )
      case 'archived':
        return (
          <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border text-zinc-400 bg-zinc-400/[0.06] border-zinc-400/10">
            Archived
          </span>
        )
      default:
        return (
          <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border text-[#F59E0B] bg-[#F59E0B]/[0.06] border-[#F59E0B]/10">
            Draft
          </span>
        )
    }
  }

  if (isPending || loading) {
    return (
      <div
        className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-200 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-5 w-16 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-3" />
            <div className="h-8 w-48 rounded-md bg-zinc-200/60 dark:bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-4 w-72 rounded-md bg-zinc-100 dark:bg-white/[0.03] animate-pulse" />
          </div>
          <div className="h-10 w-full max-w-md rounded-xl bg-white dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] animate-pulse mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="silver-glass-panel rounded-xl bg-transparent p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-32 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse mb-2" />
                    <div className="h-3 w-48 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
                  </div>
                </div>
                <div className="h-3 w-full rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse mb-2" />
                <div className="h-3 w-2/3 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-200 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <WorkspacePageHeader
          eyebrow="Tools"
          title="Form"
          accent="Interfaces"
          description="Build forms and interfaces to collect data and trigger workflows"
          className="mb-8"
          actions={
            <button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium inline-flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New Form
            </button>
          }
        />

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 rounded-lg border-0 bg-transparent pl-9 pr-3 text-[13px] font-logo text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/40 outline-none transition-colors"
          />
        </div>

        {/* Forms Grid */}
        {filteredForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-xl bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.08] flex items-center justify-center mb-4">
              <LayoutTemplate
                className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]"
                strokeWidth={1.5}
              />
            </div>
            <h3 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white mb-1">
              No forms yet
            </h3>
            <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60 text-center mb-4 max-w-md">
              Create your first form to collect data from users. Forms can be connected to workflows
              and data tables for automated processing.
            </p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredForms.map((formItem) => (
              <div
                key={formItem.id}
                className="silver-glass-panel group rounded-xl bg-transparent p-5 cursor-pointer transition-all duration-200"
                onClick={() => router.push(`/w/interfaces/${formItem.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white truncate">
                        {formItem.name}
                      </h3>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/[0.04] flex-shrink-0 transition-colors">
                        <MoreVertical className="h-4 w-4 text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        className="text-[13px] font-logo cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/w/interfaces/${formItem.id}`)
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {formItem.status === 'published' && (
                        <DropdownMenuItem
                          className="text-[13px] font-logo cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/forms/${formItem.id}`, '_blank')
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Live
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-[13px] font-logo cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopyLink(formItem.id)
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-[13px] font-logo cursor-pointer text-red-500 focus:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteForm(formItem.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60 line-clamp-2 mb-3">
                  {formItem.description || 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(formItem.status)}
                    <span className="text-[11px] font-logo text-zinc-400 dark:text-white/50">
                      {formItem.submissionCount ?? formItem.submitCount} submissions
                    </span>
                  </div>
                  <span className="text-[11px] font-logo text-zinc-400 dark:text-white/50">
                    {new Date(formItem.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Form Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[420px] rounded-[16px] p-0 overflow-hidden">
            <div className="p-6 pb-0">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.08] flex items-center justify-center">
                  <LayoutTemplate
                    className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                    Create New Form
                  </h2>
                  <p className="text-[12px] font-logo text-zinc-500 dark:text-white/60">
                    Create a new form to collect data from users and trigger workflows.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80 mb-1.5 block">
                    Form Name
                  </label>
                  <input
                    type="text"
                    value={newFormName}
                    onChange={(e) => setNewFormName(e.target.value)}
                    placeholder="e.g., Contact Form"
                    className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 rounded-lg border-0 bg-transparent px-3 text-[13px] font-logo text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/40 outline-none transition-colors"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateForm()}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80 mb-1.5 block">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    placeholder="What is this form for?"
                    className="silver-glass-pane smoky-glass-pane glass-field w-full h-9 rounded-lg border-0 bg-transparent px-3 text-[13px] font-logo text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/40 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="silver-glass-pane mt-4 flex items-center justify-between border-t border-black/[0.06] bg-transparent p-4">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-logo font-medium text-zinc-600 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateForm}
                disabled={!newFormName.trim() || creating}
                className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Form
                    <ArrowRight className="h-4 w-4" />
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
