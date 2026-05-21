import React from 'react'
import { format } from 'date-fns'
import { Check, FileText, Loader2, Lock, Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Version, VersionTag } from './types'

interface VersionDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingVersion: Version | null
  setEditingVersion: (version: Version | null) => void
  availableTags: VersionTag[]
  savingDetails: boolean
  onSave: () => void
}

export const VersionDetailsDialog = React.memo(function VersionDetailsDialog({
  open,
  onOpenChange,
  editingVersion,
  setEditingVersion,
  availableTags,
  savingDetails,
  onSave,
}: VersionDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Version Details
            {editingVersion && (
              <Badge variant="outline" className="ml-2">
                v{editingVersion.versionNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {editingVersion && (
          <div className="space-y-4 py-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editingVersion.name || ''}
                onChange={(e) => setEditingVersion({ ...editingVersion, name: e.target.value })}
                className="mt-1"
                disabled={editingVersion.isLocked}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={editingVersion.description || ''}
                onChange={(e) =>
                  setEditingVersion({ ...editingVersion, description: e.target.value })
                }
                className="mt-1"
                rows={2}
                disabled={editingVersion.isLocked}
              />
            </div>

            <div>
              <Label>Release Notes (Markdown)</Label>
              <Textarea
                value={editingVersion.releaseNotes || ''}
                onChange={(e) =>
                  setEditingVersion({ ...editingVersion, releaseNotes: e.target.value })
                }
                className="mt-1 font-mono text-sm"
                rows={4}
                placeholder="## Changes&#10;- Feature 1&#10;- Bug fix 2"
                disabled={editingVersion.isLocked}
              />
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableTags.map((tag) => {
                  const isSelected = editingVersion.tags?.includes(tag.name)
                  return (
                    <Badge
                      key={tag.slug}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? tag.color : 'transparent',
                        borderColor: tag.color,
                        color: isSelected ? 'white' : tag.color,
                      }}
                      onClick={() => {
                        if (editingVersion.isLocked) return
                        const newTags = isSelected
                          ? editingVersion.tags.filter((t) => t !== tag.name)
                          : [...(editingVersion.tags || []), tag.name]
                        setEditingVersion({ ...editingVersion, tags: newTags })
                      }}
                    >
                      {tag.name}
                    </Badge>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingVersion.isPinned}
                  onCheckedChange={(checked) =>
                    setEditingVersion({ ...editingVersion, isPinned: checked })
                  }
                />
                <Label className="flex items-center gap-1">
                  <Pin className="h-4 w-4" />
                  Pinned
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingVersion.isLocked}
                  onCheckedChange={(checked) =>
                    setEditingVersion({ ...editingVersion, isLocked: checked })
                  }
                />
                <Label className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Locked
                </Label>
              </div>
            </div>

            {editingVersion.isLocked && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This version is locked. Unlock it to make changes.
              </p>
            )}

            <div className="pt-2 text-xs text-zinc-500 dark:text-white/50 space-y-1">
              <p>Created: {format(new Date(editingVersion.createdAt), 'PPpp')}</p>
              {editingVersion.semanticVersion && (
                <p>Semantic Version: {editingVersion.semanticVersion}</p>
              )}
              {editingVersion.changeSummary?.summary && (
                <p>Changes: {editingVersion.changeSummary.summary}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={savingDetails || editingVersion?.isLocked}>
            {savingDetails ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
