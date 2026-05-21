'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Edit3, Eye, LogOut, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { useNotificationStore } from '@/stores/notifications/store'
import { WorkflowCollaborator } from '@/app/api/workflows/[id]/collaborators/route'

const logger = createLogger('CollaboratorsModal')

interface CollaboratorsModalProps {
  workflowId: string
  trigger?: React.ReactNode
}

export function CollaboratorsModal({ workflowId, trigger }: CollaboratorsModalProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collaborators, setCollaborators] = useState<WorkflowCollaborator[]>([])
  const [ownerId, setOwnerId] = useState<string>('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer')
  const { addNotification } = useNotificationStore()

  const isOwner = session?.user?.id === ownerId
  const isCollaborator = collaborators.some((c) => c.userId === session?.user?.id)

  // Load collaborators
  const loadCollaborators = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/collaborators`)
      if (!response.ok) {
        throw new Error('Failed to load collaborators')
      }
      const data = await response.json()
      setCollaborators(data.collaborators || [])
      setOwnerId(data.owner || '')
    } catch (error: any) {
      logger.error('Failed to load collaborators', { error: error.message })
      addNotification('error', 'Failed to load collaborators', workflowId)
    }
  }, [workflowId, addNotification])

  // Load on open
  useEffect(() => {
    if (open) {
      loadCollaborators()
    }
  }, [open, loadCollaborators])

  // Add collaborator
  const handleAddCollaborator = useCallback(async () => {
    if (!email.trim()) {
      addNotification('error', 'Please enter an email address', workflowId)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add collaborator')
      }

      addNotification('info', `Collaborator added: ${email}`, workflowId)
      setEmail('')
      setRole('viewer')
      await loadCollaborators()
    } catch (error: any) {
      logger.error('Failed to add collaborator', { error: error.message })
      addNotification('error', error.message, workflowId)
    } finally {
      setLoading(false)
    }
  }, [email, role, workflowId, addNotification, loadCollaborators])

  // Remove collaborator
  const handleRemoveCollaborator = useCallback(
    async (userId: string, userName: string) => {
      if (!confirm(`Remove ${userName} from this workflow?`)) {
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/workflows/${workflowId}/collaborators?userId=${userId}`,
          {
            method: 'DELETE',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to remove collaborator')
        }

        addNotification('info', `Removed ${userName}`, workflowId)
        await loadCollaborators()
      } catch (error: any) {
        logger.error('Failed to remove collaborator', { error: error.message })
        addNotification('error', 'Failed to remove collaborator', workflowId)
      } finally {
        setLoading(false)
      }
    },
    [workflowId, addNotification, loadCollaborators]
  )

  // Update collaborator role
  const handleUpdateRole = useCallback(
    async (userId: string, newRole: 'viewer' | 'editor', userName: string) => {
      setLoading(true)
      try {
        const response = await fetch(`/api/workflows/${workflowId}/collaborators/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        })

        if (!response.ok) {
          throw new Error('Failed to update role')
        }

        addNotification('info', `Updated ${userName}'s role to ${newRole}`, workflowId)
        await loadCollaborators()
      } catch (error: any) {
        logger.error('Failed to update role', { error: error.message })
        addNotification('error', 'Failed to update role', workflowId)
      } finally {
        setLoading(false)
      }
    },
    [workflowId, addNotification, loadCollaborators]
  )

  // Leave workflow (for collaborators)
  const handleLeaveWorkflow = useCallback(async () => {
    if (!session?.user?.id) return
    if (!confirm('Are you sure you want to leave this workflow? You will lose access.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/collaborators?userId=${session.user.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to leave workflow')
      }

      addNotification('info', 'You have left the workflow', workflowId)
      setOpen(false)
      // Redirect to home or workspace
      router.push('/w')
    } catch (error: any) {
      logger.error('Failed to leave workflow', { error: error.message })
      addNotification('error', 'Failed to leave workflow', workflowId)
    } finally {
      setLoading(false)
    }
  }, [workflowId, session, addNotification, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Collaborators
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-[16px]"
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10]">
              <Users className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-black/85 dark:text-white/90">
                Manage Collaborators
              </DialogTitle>
              <DialogDescription className="text-[11px] font-logo text-black/40 dark:text-white/45 mt-0.5">
                Invite people to collaborate on this workflow
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-5 overflow-hidden px-6 py-5">
          {/* Leave Workflow Button (for collaborators) */}
          {isCollaborator && !isOwner && (
            <div className="p-3.5 border border-red-500/[0.12] dark:border-red-400/[0.10] rounded-xl bg-red-500/[0.04] dark:bg-red-400/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-logo font-medium text-black/75 dark:text-white/80">
                    Leave Workflow
                  </p>
                  <p className="text-[11px] font-logo text-black/40 dark:text-white/45">
                    You will lose access to this workflow
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLeaveWorkflow}
                  disabled={loading}
                  className="h-7 px-3 text-[11px] font-logo font-medium rounded-lg text-red-600/70 dark:text-red-400/80 hover:bg-red-500/[0.06] dark:hover:bg-red-400/[0.08] border border-red-500/[0.12] dark:border-red-400/[0.10]"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Leave
                </Button>
              </div>
            </div>
          )}

          {/* Add Collaborator Form (owner only) */}
          {isOwner && (
            <div className="flex flex-col gap-3 p-3.5 border border-black/[0.06] dark:border-white/[0.06] rounded-xl bg-black/[0.01] dark:bg-white/[0.02]">
              <Label className="text-[11px] font-logo font-semibold uppercase tracking-wider text-black/40 dark:text-white/45">
                Invite Collaborator
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                    disabled={loading}
                    className="h-8 text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-28 h-8 text-[12px] font-logo rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-black/60 dark:text-white/65"
                    >
                      {role === 'viewer' ? (
                        <>
                          <Eye className="h-3 w-3 mr-1.5" />
                          Viewer
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-3 w-3 mr-1.5" />
                          Editor
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="rounded-xl border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1b1b1b] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                    <DropdownMenuItem
                      onClick={() => setRole('viewer')}
                      className="text-[12px] font-logo rounded-lg"
                    >
                      <Eye className="h-3 w-3 mr-2" />
                      Viewer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRole('editor')}
                      className="text-[12px] font-logo rounded-lg"
                    >
                      <Edit3 className="h-3 w-3 mr-2" />
                      Editor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleAddCollaborator}
                  disabled={loading || !email.trim()}
                  className="h-8 px-3 text-[12px] font-logo font-semibold rounded-lg bg-[#4A7A68] hover:bg-[#3d6a59] dark:bg-[#94B8A6]/90 dark:hover:bg-[#94B8A6] text-white dark:text-[#1b1b1b] disabled:opacity-40"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Collaborators List */}
          <div className="flex-1 overflow-y-auto">
            <Label className="text-[11px] font-logo font-semibold uppercase tracking-wider text-black/40 dark:text-white/45 mb-3 block">
              Collaborators ({collaborators.length})
            </Label>
            {collaborators.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 mx-auto mb-2 text-black/15 dark:text-white/15" />
                <p className="text-[13px] font-logo text-black/45 dark:text-white/50">
                  No collaborators yet
                </p>
                <p className="text-[11px] font-logo text-black/30 dark:text-white/35">
                  Invite people to collaborate on this workflow
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.userId}
                    className="flex items-center justify-between p-2.5 border border-black/[0.04] dark:border-white/[0.04] rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] flex items-center justify-center">
                        <span className="text-[12px] font-logo font-semibold text-[#4A7A68] dark:text-[#94B8A6]">
                          {collaborator.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-logo font-medium text-black/80 dark:text-white/85">
                          {collaborator.name}
                        </div>
                        <div className="text-[11px] font-logo text-black/40 dark:text-white/45 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {collaborator.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loading}
                            className="h-7 px-2.5 text-[11px] font-logo rounded-lg border border-black/[0.06] dark:border-white/[0.06] text-black/55 dark:text-white/60"
                          >
                            {collaborator.role === 'viewer' ? (
                              <>
                                <Eye className="h-3 w-3 mr-1.5" />
                                Viewer
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3 w-3 mr-1.5" />
                                Editor
                              </>
                            )}
                            <ChevronDown className="h-3 w-3 ml-1.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-xl border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1b1b1b] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateRole(collaborator.userId, 'viewer', collaborator.name)
                            }
                            className="text-[12px] font-logo rounded-lg"
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            Viewer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateRole(collaborator.userId, 'editor', collaborator.name)
                            }
                            className="text-[12px] font-logo rounded-lg"
                          >
                            <Edit3 className="h-3 w-3 mr-2" />
                            Editor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleRemoveCollaborator(collaborator.userId, collaborator.name)
                            }
                            disabled={loading}
                            className="h-7 w-7 rounded-lg hover:bg-red-500/[0.06] dark:hover:bg-red-400/[0.08]"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500/60 dark:text-red-400/60" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[11px] font-logo">
                          Remove collaborator
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
