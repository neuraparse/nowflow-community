'use client'

import { useEffect, useState } from 'react'
import {
  ModernAlertIcon,
  ModernApiKeyIcon,
  ModernCheckIcon,
  ModernCopyIcon,
  ModernPlusIcon,
  ModernTrashIcon,
} from '@/components/modern-api-keys-icons'
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
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/lib/auth-client'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('ApiKeys')

interface ApiKeysProps {
  onOpenChange?: (open: boolean) => void
}

interface ApiKey {
  id: string
  name: string
  key: string
  lastUsed?: string
  createdAt: string
  expiresAt?: string
}

export function ApiKeys({ onOpenChange }: ApiKeysProps) {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<ApiKey | null>(null)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Fetch API keys
  const fetchApiKeys = async () => {
    if (!userId) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/user/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.keys || [])
      }
    } catch (error) {
      logger.error('Error fetching API keys:', { error })
    } finally {
      setIsLoading(false)
    }
  }

  // Generate a new API key
  const handleCreateKey = async () => {
    if (!userId || !newKeyName.trim()) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Show the new key dialog with the API key (only shown once)
        setNewKey(data.key)
        setShowNewKeyDialog(true)
        // Reset form
        setNewKeyName('')
        // Refresh the keys list
        fetchApiKeys()
      }
    } catch (error) {
      logger.error('Error creating API key:', { error })
    } finally {
      setIsCreating(false)
    }
  }

  // Delete an API key
  const handleDeleteKey = async () => {
    if (!userId || !deleteKey) return

    try {
      const response = await fetch(`/api/user/api-keys/${deleteKey.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh the keys list
        fetchApiKeys()
        // Close the dialog
        setShowDeleteDialog(false)
        setDeleteKey(null)
      }
    } catch (error) {
      logger.error('Error deleting API key:', { error })
    }
  }

  // Copy API key to clipboard
  const copyToClipboard = async (key: string) => {
    try {
      const { copyToClipboard: safeCopy } = await import('@/lib/utils')
      const success = await safeCopy(key)
      if (success) {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } else {
        logger.warn('Failed to copy to clipboard')
      }
    } catch (error) {
      logger.error('Copy to clipboard error:', error)
    }
  }

  // Load API keys on mount
  useEffect(() => {
    if (userId) {
      fetchApiKeys()
    }
  }, [userId])

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernApiKeyIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          API Keys
        </h2>
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isLoading}
          size="sm"
          className="gap-1.5 bg-primary/90 hover:bg-primary transition-all duration-200 shadow-sm"
        >
          <ModernPlusIcon className="h-4 w-4" />
          Create Key
        </Button>
      </div>

      <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 leading-relaxed ml-9 mt-1">
        API keys allow you to authenticate and trigger workflows. Keep your API keys secure. They
        have access to your account and workflows.
      </p>

      {isLoading ? (
        <div className="space-y-3 mt-6">
          <KeySkeleton />
          <KeySkeleton />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 mt-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
              <ModernApiKeyIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
            </div>
            <h3 className="mt-4 text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
              No API keys yet
            </h3>
            <p className="mt-2 text-[12px] font-logo text-zinc-400 dark:text-white/40 max-w-sm">
              You don&apos;t have any API keys yet. Create one to get started with the NowFlowSDK.
            </p>
            <Button
              variant="default"
              className="mt-4"
              onClick={() => setIsCreating(true)}
              size="sm"
            >
              <ModernPlusIcon className="h-4 w-4 mr-1.5" /> Create API Key
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {apiKeys.map((key) => (
            <Card
              key={key.id}
              className="silver-glass-pane p-4 transition-all duration-200 bg-transparent"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                      <ModernApiKeyIcon className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
                    </span>
                    <h3 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
                      {key.name}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2 ml-8">
                    <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                      Created: {formatDate(key.createdAt)} • Last used: {formatDate(key.lastUsed)}
                    </p>
                    <div className="text-xs px-2 py-0.5 bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] rounded-lg font-mono border border-black/[0.06] dark:border-white/[0.06]">
                      •••••{key.key.slice(-6)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDeleteKey(key)
                    setShowDeleteDialog(true)
                  }}
                  className="text-destructive hover:bg-red-50 hover:text-red-500 transition-all duration-200 h-8 w-8 rounded-full"
                >
                  <ModernTrashIcon className="h-4 w-4" />
                  <span className="sr-only">Delete key</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md rounded-[16px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <ModernApiKeyIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
              <DialogTitle className="text-zinc-800 dark:text-white">
                Create new API key
              </DialogTitle>
            </div>
            <DialogDescription>
              Name your API key to help you identify it later. This key will have access to your
              account and workflows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label
                htmlFor="keyName"
                className="font-logo text-[12px] text-zinc-800 dark:text-white"
              >
                API Key Name
              </Label>
              <Input
                id="keyName"
                placeholder="e.g., Development, Production, etc."
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="focus-visible:ring-primary border-black/[0.10] dark:border-white/[0.12] bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-all duration-200"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreating(false)}
              className="border-black/[0.10] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim()}
              className="bg-primary/90 hover:bg-primary transition-all duration-200 shadow-sm"
            >
              <ModernPlusIcon className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Dialog */}
      <Dialog
        open={showNewKeyDialog}
        onOpenChange={(open) => {
          setShowNewKeyDialog(open)
          if (!open) setNewKey(null)
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[16px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <ModernCheckIcon className="h-6 w-6 text-green-500" />
              <DialogTitle className="text-green-600">Your API key has been created</DialogTitle>
            </div>
            <DialogDescription>
              This is the only time you will see your API key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          {newKey && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label className="font-logo text-[12px] text-zinc-800 dark:text-white">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    readOnly
                    value={newKey.key}
                    className="font-mono text-sm pr-10 bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] border-black/[0.06] dark:border-white/[0.06] rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full transition-all duration-200"
                    onClick={() => copyToClipboard(newKey.key)}
                  >
                    {copySuccess ? (
                      <ModernCheckIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ModernCopyIcon className="h-4 w-4" />
                    )}
                    <span className="sr-only">Copy to clipboard</span>
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50/50 border border-amber-200/50 rounded-lg">
                  <ModernAlertIcon className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    For security, we don&apos;t store the complete key. You won&apos;t be able to
                    view it again.
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end">
            <Button
              onClick={() => {
                setShowNewKeyDialog(false)
                setNewKey(null)
              }}
              className="bg-primary/90 hover:bg-primary transition-all duration-200 shadow-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md rounded-[16px] border-rose-500/18">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <ModernTrashIcon className="h-6 w-6 text-red-500" />
              <AlertDialogTitle className="text-rose-600 dark:text-rose-300">
                Delete API Key
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              {deleteKey && (
                <>
                  Are you sure you want to delete the API key{' '}
                  <span className="font-semibold text-rose-600 dark:text-rose-300">
                    {deleteKey.name}
                  </span>
                  ? This action cannot be undone and any integrations using this key will no longer
                  work.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-end gap-2">
            <AlertDialogCancel
              onClick={() => setDeleteKey(null)}
              className="border-black/[0.10] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              className="border border-rose-500/18 bg-rose-600/90 text-white transition-all duration-200 shadow-sm hover:bg-rose-700/95 dark:border-rose-400/18 dark:bg-rose-500/85"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function KeySkeleton() {
  return (
    <Card className="p-4 border border-black/[0.04] dark:border-white/[0.04] bg-black/[0.02] dark:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <Skeleton className="h-6 w-6 rounded-full bg-black/[0.04] dark:bg-white/[0.04]" />
          <div>
            <Skeleton className="h-5 w-32 mb-2 bg-black/[0.04] dark:bg-white/[0.04]" />
            <Skeleton className="h-4 w-48 bg-black/[0.04] dark:bg-white/[0.04]" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-full bg-black/[0.04] dark:bg-white/[0.04]" />
      </div>
    </Card>
  )
}
