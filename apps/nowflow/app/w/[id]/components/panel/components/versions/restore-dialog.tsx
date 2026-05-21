import React from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Version } from './types'

interface RestoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedVersion: Version | null
  loading: boolean
  onRestore: (versionNumber: number) => void
}

export const RestoreDialog = React.memo(function RestoreDialog({
  open,
  onOpenChange,
  selectedVersion,
  loading,
  onRestore,
}: RestoreDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-500" />
            Restore Version
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to restore to <strong>v{selectedVersion?.versionNumber}</strong>
            {selectedVersion?.semanticVersion && ` (${selectedVersion.semanticVersion})`}? This will
            create a new version with the restored state. Your current work will be preserved in the
            version history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedVersion && onRestore(selectedVersion.versionNumber)}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
