import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RemoveMemberDialogState } from './use-team-management'

interface RemoveMemberDialogProps {
  state: RemoveMemberDialogState
  onStateChange: (state: RemoveMemberDialogState) => void
  onConfirm: (shouldReduceSeats: boolean) => void
}

export function RemoveMemberDialog({ state, onStateChange, onConfirm }: RemoveMemberDialogProps) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) onStateChange({ ...state, open: false })
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Team Member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove {state.memberName} from the team?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="reduce-seats"
              className="rounded-lg"
              checked={state.shouldReduceSeats}
              onChange={(e) =>
                onStateChange({
                  ...state,
                  shouldReduceSeats: e.target.checked,
                })
              }
            />
            <label htmlFor="reduce-seats" className="text-[12px] font-logo">
              Also reduce seat count in my subscription
            </label>
          </div>
          <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-1">
            If selected, your team seat count will be reduced by 1, lowering your monthly billing.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              onStateChange({
                open: false,
                memberId: '',
                memberName: '',
                shouldReduceSeats: false,
              })
            }
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(state.shouldReduceSeats)}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
