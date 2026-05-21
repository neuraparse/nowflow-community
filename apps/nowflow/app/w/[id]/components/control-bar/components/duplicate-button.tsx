'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkflowDuplicateIcon } from '@/components/workflow-control-icons'

interface DuplicateButtonProps {
  onDuplicate: () => void
}

const tooltipClass = 'bg-[#1b1b1b] text-white border-none text-[11px] font-logo'

export function DuplicateButton({ onDuplicate }: DuplicateButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-control-action="duplicate"
          variant="ghost"
          size="icon"
          onClick={onDuplicate}
          className="silver-glass-chip h-8 w-8 min-h-8 min-w-8 rounded-[10px] text-foreground/70 transition-all duration-200 hover:bg-black/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-0 dark:hover:bg-white/[0.06]"
          aria-label="Duplicate workflow"
        >
          <WorkflowDuplicateIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Duplicate Workflow</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={tooltipClass}>
        Duplicate workflow
      </TooltipContent>
    </Tooltip>
  )
}
