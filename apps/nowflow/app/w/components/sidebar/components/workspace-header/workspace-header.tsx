'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  GitPullRequestCreate,
  GitPullRequestCreateArrow,
  LogOut,
  Pencil,
  PenLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { AgentIcon } from '@/components/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { LoadingAgent } from '@/components/ui/loading-agent'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { signOut, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubscription } from '@/hooks/use-subscription'
import { invalidateWorkspacesCache, useWorkspaces, type Workspace } from '@/hooks/use-workspaces'
import { clearUserData } from '@/stores'

interface WorkspaceHeaderProps {
  onCreateWorkflow: () => void
  isCollapsed?: boolean
  onDropdownOpenChange?: (isOpen: boolean) => void
}

// New WorkspaceModal component
interface WorkspaceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateWorkspace: (name: string) => void
}

function WorkspaceModal({ open, onOpenChange, onCreateWorkspace }: WorkspaceModalProps) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (workspaceName.trim()) {
      setIsSubmitting(true)
      onCreateWorkspace(workspaceName.trim())
      setWorkspaceName('')
      setIsSubmitting(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="silver-glass-panel sm:max-w-[500px] flex flex-col gap-0 overflow-hidden p-0 rounded-[16px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b border-black/[0.06] bg-transparent px-6 py-4 dark:border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="silver-glass-pane flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-black/[0.06] dark:border-white/[0.08]">
                <Plus className="h-4 w-4 text-zinc-800 dark:text-white" />
              </div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                Create Workspace
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="silver-glass-chip h-8 w-8 rounded-[10px] p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pt-5 pb-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="space-y-3">
                <label
                  htmlFor="workspace-name"
                  className="text-[11px] font-semibold tracking-[0.1em] uppercase font-logo flex items-center gap-1.5"
                >
                  <span>Workspace Name</span>
                  <span className="text-[11px] font-normal normal-case tracking-normal text-zinc-400 dark:text-white/40">
                    (required)
                  </span>
                </label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                  className="h-10 w-full focus:ring-0"
                  autoFocus
                />
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                  Workspaces help you organize your workflows and collaborate with others.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="silver-glass-button h-9 px-4 border-black/[0.06] dark:border-white/[0.08]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!workspaceName.trim() || isSubmitting}
                  className={cn(
                    'silver-glass-button h-9 px-4 gap-2 font-medium',
                    'bg-[#4A7A68] hover:bg-[#3d6657] dark:bg-[#4A7A68] dark:hover:bg-[#3d6657]',
                    'shadow-[0_0_0_0_#4A7A68] hover:shadow-[0_0_0_4px_rgba(74,122,104,0.15)]',
                    'text-white transition-all duration-200',
                    'disabled:opacity-50 disabled:hover:bg-[#4A7A68] dark:disabled:hover:bg-[#4A7A68] disabled:hover:shadow-none'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </span>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Workspace</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// New WorkspaceEditModal component
interface WorkspaceEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateWorkspace: (id: string, name: string) => void
  workspace: Workspace | null
}

function WorkspaceEditModal({
  open,
  onOpenChange,
  onUpdateWorkspace,
  workspace,
}: WorkspaceEditModalProps) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (workspace && open) {
      setWorkspaceName(workspace.name)
    }
  }, [workspace, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (workspace && workspaceName.trim()) {
      setIsSubmitting(true)
      onUpdateWorkspace(workspace.id, workspaceName.trim())
      setWorkspaceName('')
      setIsSubmitting(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="silver-glass-panel sm:max-w-[500px] flex flex-col gap-0 overflow-hidden p-0 rounded-[16px]"
        hideCloseButton
      >
        <DialogHeader className="flex-shrink-0 border-b border-black/[0.06] bg-transparent px-6 py-4 dark:border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="silver-glass-pane flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-black/[0.06] dark:border-white/[0.08]">
                <Pencil className="h-4 w-4 text-zinc-800 dark:text-white" />
              </div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                Edit Workspace
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="silver-glass-chip h-8 w-8 rounded-[10px] p-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pt-5 pb-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="space-y-3">
                <label
                  htmlFor="workspace-name-edit"
                  className="text-[11px] font-semibold tracking-[0.1em] uppercase font-logo flex items-center gap-1.5"
                >
                  <span>Workspace Name</span>
                  <span className="text-[11px] font-normal normal-case tracking-normal text-zinc-400 dark:text-white/40">
                    (required)
                  </span>
                </label>
                <Input
                  id="workspace-name-edit"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                  className="h-10 w-full focus:ring-0"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="silver-glass-button h-9 px-4 border-black/[0.06] dark:border-white/[0.08]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !workspaceName.trim() || isSubmitting || workspaceName === workspace?.name
                  }
                  className={cn(
                    'silver-glass-button h-9 px-4 gap-2 font-medium',
                    'bg-[#4A7A68] hover:bg-[#3d6657] dark:bg-[#4A7A68] dark:hover:bg-[#3d6657]',
                    'shadow-[0_0_0_0_#4A7A68] hover:shadow-[0_0_0_4px_rgba(74,122,104,0.15)]',
                    'text-white transition-all duration-200',
                    'disabled:opacity-50 disabled:hover:bg-[#4A7A68] dark:disabled:hover:bg-[#4A7A68] disabled:hover:shadow-none'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceHeader({
  onCreateWorkflow,
  isCollapsed,
  onDropdownOpenChange,
}: WorkspaceHeaderProps) {
  // Get sidebar store state to check current mode
  const { mode, workspaceDropdownOpen, setAnyModalOpen } = useSidebarStore()

  // Keep local isOpen state in sync with the store (for internal component use)
  const [isOpen, setIsOpen] = useState(workspaceDropdownOpen)
  const { data: sessionData, isPending } = useSession()

  // Use shared hooks for subscription and workspaces (prevents duplicate API calls)
  const { isPro, loading: subscriptionLoading } = useSubscription()
  const { workspaces, loading: workspacesLoading, refetch: refetchWorkspaces } = useWorkspaces()

  const plan = isPro ? 'Pro Plan' : 'Free Plan'

  // Use client-side loading instead of isPending to avoid hydration mismatch
  const [isClientLoading, setIsClientLoading] = useState(true)
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  // Get workflowRegistry state and actions
  const {
    activeWorkspaceId,
    setActiveWorkspace: setActiveWorkspaceId,
    isLoading: isWorkflowsLoading,
  } = useWorkflowRegistry()

  const userName = sessionData?.user?.name || sessionData?.user?.email || 'User'

  // Combined loading state
  const isWorkspacesLoading = workspacesLoading || subscriptionLoading

  // Set isClientLoading to false after hydration
  useEffect(() => {
    setIsClientLoading(false)
  }, [])

  // Initialize active workspace when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      const matchingWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
      const workspaceToActivate = matchingWorkspace || workspaces[0]

      if (workspaceToActivate) {
        setActiveWorkspace(workspaceToActivate)
        if (workspaceToActivate.id !== activeWorkspaceId) {
          setActiveWorkspaceId(workspaceToActivate.id)
        }
      }
    }
  }, [workspaces, activeWorkspaceId])

  // Update active workspace when activeWorkspaceId changes (from registry or URL)
  useEffect(() => {
    if (activeWorkspaceId && workspaces.length > 0) {
      const matchingWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
      if (matchingWorkspace && matchingWorkspace.id !== activeWorkspace?.id) {
        setActiveWorkspace(matchingWorkspace)
      }
    }
  }, [activeWorkspaceId, workspaces]) // Only update local state, no API calls

  const switchWorkspace = (workspace: Workspace) => {
    // If already on this workspace, do nothing
    if (activeWorkspace?.id === workspace.id) {
      setIsOpen(false)
      return
    }

    setActiveWorkspace(workspace)
    setIsOpen(false)

    // Update the workflow registry store with the new active workspace
    setActiveWorkspaceId(workspace.id)

    // Update URL to include workspace ID
    router.push(`/w/${workspace.id}`)
  }

  const handleCreateWorkspace = async (name: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (data.workspace) {
        const newWorkspace = data.workspace as Workspace

        // Invalidate cache and refetch to get latest data
        invalidateWorkspacesCache()
        await refetchWorkspaces()

        setActiveWorkspace(newWorkspace)
        setActiveWorkspaceId(newWorkspace.id)

        // Update URL to include new workspace ID
        router.push(`/w/${newWorkspace.id}`)
      }
    } catch (err) {
      console.error('Error creating workspace:', err)
    }
  }

  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)

    try {
      const signOutPromise = signOut()
      await clearUserData()

      setTimeout(() => {
        router.push('/login?fromLogout=true')
      }, 100)

      await signOutPromise
    } catch (error) {
      console.error('Error signing out:', error)
      router.push('/login?fromLogout=true')
    } finally {
      setIsSigningOut(false)
      setIsOpen(false)
    }
  }

  const handleUpdateWorkspace = async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error('Failed to update workspace')
      }

      const { workspace } = await response.json()

      // Invalidate cache and refetch to get latest data
      invalidateWorkspacesCache()
      await refetchWorkspaces()

      // If active workspace was updated, update it too
      if (activeWorkspace?.id === workspace.id) {
        setActiveWorkspace({ ...activeWorkspace, name: workspace.name } as Workspace)
      }
    } catch (err) {
      console.error('Error updating workspace:', err)
    }
  }

  const handleDeleteWorkspace = async (id: string) => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete workspace')
      }

      // Invalidate cache and refetch to get latest data
      invalidateWorkspacesCache()
      await refetchWorkspaces()

      // If deleted workspace was active, switch to another workspace
      const remainingWorkspaces = workspaces.filter((w) => w.id !== id)
      if (activeWorkspace?.id === id && remainingWorkspaces.length > 0) {
        // Use the specialized method for handling workspace deletion
        const newWorkspaceId = remainingWorkspaces[0].id
        useWorkflowRegistry.getState().handleWorkspaceDeletion(newWorkspaceId)
        setActiveWorkspace(remainingWorkspaces[0])
      }

      setIsOpen(false)
    } catch (err) {
      console.error('Error deleting workspace:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditModal = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingWorkspace(workspace)
    setIsEditModalOpen(true)
  }

  // Determine URL for workspace links
  const workspaceUrl = activeWorkspace ? `/w/${activeWorkspace.id}` : '/w'

  // Notify parent component when dropdown opens/closes
  const handleDropdownOpenChange = (open: boolean) => {
    setIsOpen(open)
    // Inform the parent component about the dropdown state change
    if (onDropdownOpenChange) {
      onDropdownOpenChange(open)
    }
  }

  // Special handling for click interactions in hover mode
  const handleTriggerClick = (e: React.MouseEvent) => {
    // When in hover mode, explicitly prevent bubbling for the trigger
    if (mode === 'hover') {
      e.stopPropagation()
      e.preventDefault()
      // Toggle dropdown state
      handleDropdownOpenChange(!isOpen)
    }
  }

  // Handle modal open/close state
  useEffect(() => {
    // Update the modal state in the store
    setAnyModalOpen(isWorkspaceModalOpen || isEditModalOpen || isDeleting)
  }, [isWorkspaceModalOpen, isEditModalOpen, isDeleting, setAnyModalOpen])

  return (
    <div className={`${isCollapsed ? 'py-0.5 px-0' : 'py-0.5 px-0.5'}`}>
      {/* Workspace Modal */}
      <WorkspaceModal
        open={isWorkspaceModalOpen}
        onOpenChange={setIsWorkspaceModalOpen}
        onCreateWorkspace={handleCreateWorkspace}
      />

      {/* Edit Workspace Modal */}
      <WorkspaceEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onUpdateWorkspace={handleUpdateWorkspace}
        workspace={editingWorkspace}
      />

      <DropdownMenu open={isOpen} onOpenChange={handleDropdownOpenChange}>
        <div
          className={`group relative rounded-[4px] cursor-pointer ${isCollapsed ? 'flex justify-center items-center w-full' : ''}`}
          onClick={(e) => {
            // In hover mode, prevent clicks on the container from collapsing the sidebar
            if (mode === 'hover') {
              e.stopPropagation()
            }
          }}
          role="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleTriggerClick(e as any)
            }
          }}
        >
          {/* Hover background */}
          {!isCollapsed && (
            <div className="absolute inset-0 rounded-[4px] group-hover:bg-black/[0.03] dark:group-hover:bg-white/[0.03]" />
          )}

          {/* Content */}
          {isCollapsed ? (
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-full relative z-10">
                    <div className="silver-glass-pane flex h-8 w-8 items-center justify-center rounded-[4px] border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-[11px] font-logo font-semibold text-zinc-800 dark:text-white">
                        {isClientLoading || isWorkspacesLoading
                          ? '...'
                          : (activeWorkspace?.name || userName).substring(0, 1).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent
                side="right"
                className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
              >
                {activeWorkspace?.name || `${userName}'s Workspace`}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="relative">
              <DropdownMenuTrigger asChild>
                <div
                  className="flex items-center px-1.5 py-1 relative z-10 w-full"
                  onClick={handleTriggerClick}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                    {isClientLoading || isWorkspacesLoading ? (
                      <div className="flex items-center gap-2 text-[13px] font-logo text-black/45 dark:text-white/55">
                        <LoadingAgent size="sm" />
                        <span>Loading workspace...</span>
                      </div>
                    ) : (
                      <>
                        <div className="silver-glass-pane flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border-black/[0.06] dark:border-white/[0.08]">
                          <span className="text-[11px] font-logo font-semibold text-zinc-800 dark:text-white">
                            {(activeWorkspace?.name || userName).substring(0, 1).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {isWorkflowsLoading && (
                            <div className="flex-shrink-0">
                              <LoadingAgent size="sm" />
                            </div>
                          )}
                          <span className="truncate text-[13px] font-logo font-medium text-zinc-800 dark:text-white">
                            {activeWorkspace?.name || `${userName}'s Workspace`}
                          </span>
                          <ChevronDown
                            className="h-3 w-3 text-black/40 dark:text-white/55 flex-shrink-0"
                            strokeWidth={1.5}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </DropdownMenuTrigger>
            </div>
          )}
        </div>
        <DropdownMenuContent
          align="start"
          className="silver-glass-panel min-w-[260px] overflow-hidden rounded-[10px] p-0"
        >
          {/* Workspaces list */}
          <div className="py-1 max-h-[240px] overflow-y-auto">
            {isWorkspacesLoading ? (
              <div className="px-3 py-2 text-[11px] font-logo text-zinc-400 dark:text-white/40 flex items-center gap-2">
                <LoadingAgent size="sm" />
                <span>Loading workspaces...</span>
              </div>
            ) : (
              <div className="space-y-0.5 px-1">
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    className={`text-[13px] font-logo rounded px-1.5 py-1.5 cursor-pointer group relative ${
                      activeWorkspace?.id === workspace.id
                        ? 'silver-glass-chip bg-black/[0.04] text-zinc-800 font-semibold border border-black/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-white/[0.06] dark:border-white/[0.08] dark:text-white'
                        : 'silver-glass-chip text-zinc-800 dark:text-white'
                    }`}
                    onClick={() => switchWorkspace(workspace)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-12">
                      <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md shadow-sm ${
                          activeWorkspace?.id === workspace.id
                            ? 'silver-glass-pane border border-black/[0.06] bg-black/[0.08] dark:border-white/[0.08] dark:bg-white/[0.10]'
                            : 'silver-glass-pane border border-black/[0.06] bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]'
                        }`}
                      >
                        <span
                          className={`text-[11px] font-logo font-semibold ${
                            activeWorkspace?.id === workspace.id
                              ? 'text-zinc-800 dark:text-white'
                              : 'text-zinc-400 dark:text-white/40'
                          }`}
                        >
                          {workspace.name.substring(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <span className="truncate text-[13px] font-logo">{workspace.name}</span>
                    </div>

                    <div className="silver-glass-pane absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-[6px] px-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="silver-glass-chip h-5 w-5 rounded-md p-0 text-zinc-400 dark:text-white/40 dark:hover:text-white"
                        onClick={(e) => openEditModal(workspace, e)}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0 text-zinc-400 dark:text-white/40 hover:text-destructive hover:bg-destructive/10 rounded"
                            onClick={(e) => e.stopPropagation()}
                            disabled={isDeleting || workspaces.length <= 1}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{workspace.name}"? This action cannot
                              be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteWorkspace(workspace.id)
                              }}
                              className="smoky-glass-chip rounded-[6px] border border-rose-500/[0.18] bg-rose-500/[0.08] text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </div>

          {/* Create new workspace button */}
          <div className="border-t border-black/[0.06] p-1 dark:border-white/[0.08]">
            <Button
              variant="outline"
              size="sm"
              className="silver-glass-button flex h-8 w-full items-center justify-center gap-1 rounded-[4px] border-black/[0.06] text-[13px] font-semibold font-logo tracking-[0.02em] dark:border-white/[0.08]"
              onClick={() => setIsWorkspaceModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Workspace</span>
            </Button>
          </div>

          <DropdownMenuSeparator className="my-0" />
          <div className="p-0.5">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void handleSignOut()
              }}
              disabled={isSigningOut}
              className={cn(
                'cursor-pointer rounded px-1 py-1 text-[13px] font-logo',
                'text-destructive focus:bg-destructive/10 focus:text-destructive'
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isSigningOut ? 'Signing out…' : 'Log out'}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
