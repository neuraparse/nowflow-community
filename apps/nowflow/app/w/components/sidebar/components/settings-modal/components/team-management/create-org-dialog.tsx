import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { APP_HOSTNAME } from '@/lib/config/app-urls'
import { ButtonSkeleton } from './skeletons'

interface CreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgName: string
  orgSlug: string
  onOrgNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onOrgSlugChange: (slug: string) => void
  onSubmit: () => void
  isCreating: boolean
  error: string | null
}

export function CreateOrgDialog({
  open,
  onOpenChange,
  orgName,
  orgSlug,
  onOrgNameChange,
  onOrgSlugChange,
  onSubmit,
  isCreating,
  error,
}: CreateOrgDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team Workspace</DialogTitle>
          <DialogDescription>
            Create a workspace for your team to collaborate on projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              Team Name
            </label>
            <Input value={orgName} onChange={onOrgNameChange} placeholder="My Team" />
          </div>

          <div className="space-y-2">
            <label className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              Team URL
            </label>
            <div className="flex items-center space-x-2">
              <div className="bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 rounded-l-lg text-[12px] font-logo text-zinc-400 dark:text-white/40">
                {APP_HOSTNAME}/team/
              </div>
              <Input
                value={orgSlug}
                onChange={(e) => onOrgSlugChange(e.target.value)}
                className="rounded-l-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!orgName || !orgSlug || isCreating}>
            {isCreating && <ButtonSkeleton />}
            <span className={isCreating ? 'ml-2' : ''}>Create Team Workspace</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
