import React from 'react'
import { Check, ChevronRight, Loader2, Pin, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { VersionTag } from './types'

interface CreateVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  name: string
  setName: (name: string) => void
  description: string
  setDescription: (description: string) => void
  semanticBump: 'major' | 'minor' | 'patch'
  setSemanticBump: (bump: 'major' | 'minor' | 'patch') => void
  tags: string[]
  setTags: (tags: string[]) => void
  isPinned: boolean
  setIsPinned: (pinned: boolean) => void
  releaseNotes: string
  setReleaseNotes: (notes: string) => void
  availableTags: VersionTag[]
  onCreate: () => void
}

export const CreateVersionDialog = React.memo(function CreateVersionDialog({
  open,
  onOpenChange,
  loading,
  name,
  setName,
  description,
  setDescription,
  semanticBump,
  setSemanticBump,
  tags,
  setTags,
  isPinned,
  setIsPinned,
  releaseNotes,
  setReleaseNotes,
  availableTags,
  onCreate,
}: CreateVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            Create Version
          </DialogTitle>
          <DialogDescription>
            Save a snapshot of your current workflow with semantic versioning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Version Name (optional)</Label>
            <Input
              placeholder="e.g., Before major refactor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What changes are in this version?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label>Version Bump</Label>
            <Select
              value={semanticBump}
              onValueChange={(v: 'major' | 'minor' | 'patch') => setSemanticBump(v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patch">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Patch</span>
                    <span className="text-zinc-500 dark:text-white/50 text-xs">
                      x.x.X - Bug fixes
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="minor">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Minor</span>
                    <span className="text-zinc-500 dark:text-white/50 text-xs">
                      x.X.0 - New features
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="major">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Major</span>
                    <span className="text-zinc-500 dark:text-white/50 text-xs">
                      X.0.0 - Breaking changes
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {availableTags.map((tag) => {
                const isSelected = tags.includes(tag.name)
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
                      if (isSelected) {
                        setTags(tags.filter((t) => t !== tag.name))
                      } else {
                        setTags([...tags, tag.name])
                      }
                    }}
                  >
                    {tag.name}
                  </Badge>
                )
              })}
            </div>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-zinc-600 dark:text-white/60 hover:text-zinc-800 dark:hover:text-white">
              <ChevronRight className="h-4 w-4 transition-transform ui-expanded:rotate-90" />
              Release Notes (optional)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Textarea
                placeholder="## Changes&#10;- Feature 1&#10;- Bug fix 2"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                className="font-mono text-sm"
                rows={4}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-2">
            <Switch checked={isPinned} onCheckedChange={setIsPinned} />
            <Label
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setIsPinned(!isPinned)}
            >
              <Pin className="h-4 w-4" />
              Pin this version
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
