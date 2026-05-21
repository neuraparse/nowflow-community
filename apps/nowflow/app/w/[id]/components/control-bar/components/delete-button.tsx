'use client'

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowDeleteIcon } from '@/components/workflow-control-icons'

interface DeleteButtonProps {
  disabled: boolean
  onDelete: () => void
}

const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

export function DeleteButton({ disabled, onDelete }: DeleteButtonProps) {
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              data-control-action="delete"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="silver-glass-chip h-8 w-8 min-h-8 min-w-8 rounded-[10px] border border-transparent text-foreground/70 transition-all duration-200 hover:bg-red-500/[0.08] hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-0 disabled:opacity-40 dark:hover:bg-red-500/[0.12] dark:hover:text-red-400"
              aria-label="Delete workflow"
            >
              <WorkflowDeleteIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Delete Workflow</span>
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>
          Delete Workflow
        </TooltipContent>
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this workflow? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="smoky-glass-chip rounded-[10px] border border-rose-500/[0.18] bg-rose-500/[0.08] text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
