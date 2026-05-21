'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { ModernAccountIcon, ModernLockIcon } from '@/components/modern-account-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { client, signOut, useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'
import { RequestResetForm } from '@/app/(auth)/components/reset-password-form'
import { clearUserData } from '@/stores'

const logger = createLogger('Account')

interface SessionInfo {
  id: string
  token: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  ipAddress?: string
  userAgent?: string
}

interface AccountProps {
  onOpenChange: (open: boolean) => void
}

export function Account({ onOpenChange }: AccountProps) {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Reset password states
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('')
  const [isSubmittingResetPassword, setIsSubmittingResetPassword] = useState(false)
  const [resetPasswordStatus, setResetPasswordStatus] = useState<{
    type: 'success' | 'error' | null
    message: string
  }>({ type: null, message: '' })

  // Sessions states
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isRevokingOthers, setIsRevokingOthers] = useState(false)

  // Data export states
  const [isExporting, setIsExporting] = useState(false)

  // Account deletion states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setEditName(session.user.name || '')
      setResetPasswordEmail(session.user.email)
    }
  }, [session])

  // Load active sessions
  const loadSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true)
      const response = await fetch('/api/auth/list-sessions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setSessions(Array.isArray(data) ? data : data?.sessions || [])
      }
    } catch (error) {
      logger.error('Error loading sessions:', { error })
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      loadSessions()
    }
  }, [session, loadSessions])

  const handleRevokeOtherSessions = async () => {
    try {
      setIsRevokingOthers(true)
      await fetch('/api/auth/revoke-other-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await loadSessions()
    } catch (error) {
      logger.error('Error revoking other sessions:', { error })
    } finally {
      setIsRevokingOthers(false)
    }
  }

  const handleExportData = async () => {
    try {
      setIsExporting(true)

      // Aggregate data from multiple sources
      const [workflowsRes, settingsRes] = await Promise.allSettled([
        fetch('/api/workflows').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/user/settings').then((r) => (r.ok ? r.json() : null)),
      ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          name: session?.user?.name,
          email: session?.user?.email,
          createdAt: session?.user?.createdAt,
        },
        workflows: workflowsRes.status === 'fulfilled' ? workflowsRes.value : null,
        settings: settingsRes.status === 'fulfilled' ? settingsRes.value : null,
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `account-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('Error exporting data:', { error })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    try {
      setIsDeleting(true)
      const response = await fetch('/api/user/delete-account', { method: 'DELETE' })
      if (response.ok) {
        await clearUserData()
        router.push('/login')
      } else {
        logger.error('Failed to delete account')
      }
    } catch (error) {
      logger.error('Error deleting account:', { error })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteConfirmText('')
    }
  }

  const handleSignOut = async () => {
    try {
      const signOutPromise = signOut()
      await clearUserData()
      setTimeout(() => {
        router.push('/login?fromLogout=true')
      }, 100)
      await signOutPromise
    } catch (error) {
      logger.error('Error signing out:', { error })
      router.push('/login?fromLogout=true')
    }
  }

  const handleSaveName = async () => {
    if (!editName.trim() || editName === session?.user?.name) {
      setIsEditingName(false)
      return
    }

    try {
      setIsSavingName(true)
      await client.updateUser({ name: editName.trim() })
      setIsEditingName(false)
    } catch (error) {
      logger.error('Error updating name:', { error })
    } finally {
      setIsSavingName(false)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setEditName(session?.user?.name || '')
      setIsEditingName(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return // 5MB limit

    try {
      setIsUploadingAvatar(true)

      // Show preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Convert to base64 and update
      const base64 = await fileToBase64(file)
      await client.updateUser({ image: base64 })
    } catch (error) {
      logger.error('Error uploading avatar:', { error })
      setAvatarPreview(null)
    } finally {
      setIsUploadingAvatar(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [])

  const handleResetPassword = async () => {
    if (!resetPasswordEmail) {
      setResetPasswordStatus({ type: 'error', message: 'Please enter your email address' })
      return
    }

    try {
      setIsSubmittingResetPassword(true)
      setResetPasswordStatus({ type: null, message: '' })

      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetPasswordEmail,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to request password reset')
      }

      setResetPasswordStatus({ type: 'success', message: 'Password reset link sent to your email' })

      setTimeout(() => {
        setResetPasswordDialogOpen(false)
        setResetPasswordStatus({ type: null, message: '' })
      }, 2000)
    } catch (error) {
      logger.error('Error requesting password reset:', { error })
      setResetPasswordStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to request password reset',
      })
    } finally {
      setIsSubmittingResetPassword(false)
    }
  }

  const user = session?.user as (typeof session)['user'] & { role?: string }
  const avatarUrl = avatarPreview || user?.image
  const userInitials = (user?.name || 'U').slice(0, 2).toUpperCase()
  const roleLabel = user?.role === 'owner' ? 'Owner' : user?.role === 'admin' ? 'Manager' : 'User'

  if (isPending) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-[15px] font-logo font-semibold mb-4 text-zinc-800 dark:text-white flex items-center gap-2">
            <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
              <ModernAccountIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
            </span>
            Account
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center mb-4">
            <ModernAccountIcon className="h-8 w-8 text-zinc-400 dark:text-white/40" />
          </div>
          <h4 className="text-[15px] font-logo font-semibold mb-2">Not signed in</h4>
          <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-4">
            Sign in to manage your account settings.
          </p>
          <Button onClick={() => router.push('/login')} className="bg-primary/90 hover:bg-primary">
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernAccountIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Account
        </h3>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-6 ml-9">
          Manage your profile and account settings.
        </p>
      </div>

      {/* Profile Section */}
      <div className="silver-glass-pane flex items-start gap-5 rounded-lg bg-transparent p-4">
        {/* Avatar */}
        <div className="relative group shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            onClick={handleAvatarClick}
            className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-[#4A7A68]/20 dark:border-[#94B8A6]/20 shadow-sm group-hover:border-[#4A7A68]/40 dark:group-hover:border-[#94B8A6]/40 transition-all duration-200"
            disabled={isUploadingAvatar}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.name || 'Avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#4A7A68]/80 to-[#4A7A68] dark:from-[#94B8A6]/80 dark:to-[#94B8A6] text-white text-xl font-semibold">
                {userInitials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            {isUploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Name (editable) */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleSaveName}
                autoFocus
                className="h-8 text-base font-semibold focus-visible:ring-0"
                disabled={isSavingName}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveName}
                className="h-7 w-7 shrink-0"
                disabled={isSavingName}
              >
                <Check className="h-4 w-4 text-green-500" strokeWidth={1.5} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditName(user.name || '')
                  setIsEditingName(false)
                }}
                className="h-7 w-7 shrink-0"
              >
                <X className="h-4 w-4 text-zinc-400 dark:text-white/40" strokeWidth={1.5} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-zinc-800 dark:text-white truncate">
                {user.name || 'User'}
              </h4>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <Pencil
                  className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40 hover:text-[#4A7A68] dark:hover:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </button>
            </div>
          )}

          {/* Email */}
          <div className="flex items-center gap-1.5 text-[12px] font-logo text-zinc-400 dark:text-white/40">
            <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="truncate">{user.email}</span>
          </div>

          {/* Role Badge */}
          <div className="flex items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] text-[#4A7A68] dark:text-[#94B8A6] border border-[#4A7A68]/20 dark:border-[#94B8A6]/20">
              <Shield className="h-3 w-3" strokeWidth={1.5} />
              {roleLabel}
            </span>
            {user.createdAt && (
              <span className="inline-flex items-center gap-1 text-[12px] font-logo text-zinc-400 dark:text-white/40">
                <Calendar className="h-3 w-3" strokeWidth={1.5} />
                Joined{' '}
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => setResetPasswordDialogOpen(true)}
          className="silver-glass-pane w-full flex items-center gap-3 rounded-lg bg-transparent py-3 px-4 transition-all duration-200 text-left"
        >
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg">
            <KeyRound className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              Reset Password
            </p>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
              Change your account password via email.
            </p>
          </div>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 py-3 px-4 rounded-lg border border-red-200/50 bg-red-50/30 dark:bg-red-950/10 shadow-sm hover:shadow-md hover:border-red-300/50 transition-all duration-200 text-left"
        >
          <span className="bg-red-500/10 p-2 rounded-lg">
            <LogOut className="h-4 w-4 text-red-500" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-logo text-[12px] font-medium text-red-600 dark:text-red-400">
              Sign Out
            </p>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
              Sign out of your account on this device.
            </p>
          </div>
        </button>
      </div>

      {/* Active Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
            Active Sessions
          </h4>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeOtherSessions}
              disabled={isRevokingOthers}
              className="text-xs h-7"
            >
              {isRevokingOthers ? (
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Revoking...
                </span>
              ) : (
                'Sign out all other devices'
              )}
            </Button>
          )}
        </div>

        {isLoadingSessions ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 py-2">
            No active sessions found.
          </p>
        ) : (
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {sessions.map((s) => {
              const isCurrent = s.token === session?.session?.token
              const isMobile = s.userAgent?.toLowerCase().includes('mobile')
              const browserName = parseBrowserName(s.userAgent)
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border text-sm ${
                    isCurrent
                      ? 'border-[#4A7A68]/30 dark:border-[#94B8A6]/30 bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10]'
                      : 'border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03]'
                  }`}
                >
                  <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg shrink-0">
                    {isMobile ? (
                      <Smartphone
                        className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Laptop
                        className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]"
                        strokeWidth={1.5}
                      />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white truncate">
                        {browserName}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-logo text-zinc-400 dark:text-white/40">
                      {s.ipAddress && <span>{s.ipAddress}</span>}
                      <span>
                        Last active{' '}
                        {new Date(s.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="space-y-3">
        <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
          Data Export
        </h4>
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="silver-glass-pane w-full flex items-center gap-3 rounded-lg bg-transparent py-3 px-4 transition-all duration-200 text-left disabled:opacity-50"
        >
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg">
            {isExporting ? (
              <div className="h-4 w-4 border-2 border-[#4A7A68]/30 dark:border-[#94B8A6]/30 border-t-[#4A7A68] dark:border-t-[#94B8A6] rounded-full animate-spin" />
            ) : (
              <Download className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            )}
          </span>
          <div>
            <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              {isExporting ? 'Preparing export...' : 'Export My Data'}
            </p>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
              Download all your workflows, settings, and account data as JSON.
            </p>
          </div>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</h4>
        <div className="rounded-lg border border-red-200/60 dark:border-red-900/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-1">
                Permanently delete your account and all associated data. This action cannot be
                undone.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            Delete Account
          </Button>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[16px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <ModernLockIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
              <DialogTitle className="text-zinc-800 dark:text-white">Reset Password</DialogTitle>
            </div>
          </DialogHeader>
          <RequestResetForm
            email={resetPasswordEmail}
            onEmailChange={setResetPasswordEmail}
            onSubmit={handleResetPassword}
            isSubmitting={isSubmittingResetPassword}
            statusType={resetPasswordStatus.type}
            statusMessage={resetPasswordStatus.message}
            className="py-4"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-red-200/60 dark:border-red-900/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, all workflows, settings, and associated
              data. This action{' '}
              <span className="font-semibold text-zinc-800 dark:text-white">cannot be undone</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-1.5 block">
              Type{' '}
              <span className="font-mono font-semibold text-zinc-800 dark:text-white">DELETE</span>{' '}
              to confirm
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono border-red-200/60 dark:border-red-900/40 focus-visible:ring-red-500/30"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmText('')
                setDeleteDialogOpen(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Account Permanently'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseBrowserName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device'
  const ua = userAgent.toLowerCase()
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('edg/')) return 'Microsoft Edge'
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera'
  return 'Unknown Browser'
}
