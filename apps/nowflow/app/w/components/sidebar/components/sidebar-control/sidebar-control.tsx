'use client'

import { ModernCollapseIcon, ModernExpandIcon } from '@/components/modern-sidebar-icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useSidebarStore } from '@/stores/sidebar/store'

export function SidebarControl() {
  const { toggleExpanded, isExpanded } = useSidebarStore()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleExpanded}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[4px] cursor-pointer transition-all duration-200',
            workflowEditorTheme.iconButton
          )}
        >
          {isExpanded ? (
            <ModernCollapseIcon className="h-4 w-4" />
          ) : (
            <ModernExpandIcon className="h-4 w-4" />
          )}
          <span className="sr-only">{isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-[11px] font-logo">
        {isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      </TooltipContent>
    </Tooltip>
  )
}
