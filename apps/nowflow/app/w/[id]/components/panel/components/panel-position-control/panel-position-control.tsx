'use client'

import {
  ModernFloatingPanelIcon,
  ModernPanelBottomIcon,
  ModernPanelRightIcon,
} from '@/components/modern-panel-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { usePanelStore } from '@/stores/panel/store'
import { PanelPosition } from '@/stores/panel/types'

interface PanelPositionControlProps {
  className?: string
}

export function PanelPositionControl({ className }: PanelPositionControlProps) {
  const position = usePanelStore((state) => state.position)
  const setPosition = usePanelStore((state) => state.setPosition)

  const handlePositionChange = (newPosition: PanelPosition) => {
    setPosition(newPosition)
  }

  return (
    <div
      className={cn('workflow-editor-panel-position-control flex items-center gap-0.5', className)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={position === 'right' ? 'secondary' : 'outline'}
            size="icon"
            className={cn(
              workflowEditorTheme.iconButton,
              position === 'right' && workflowEditorTheme.tabActive,
              'workflow-editor-panel-position-button h-6 w-6 rounded-md transition-all duration-200'
            )}
            data-active={position === 'right'}
            aria-pressed={position === 'right'}
            onClick={() => handlePositionChange('right')}
          >
            <ModernPanelRightIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Right Panel</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] font-logo">
          Right Panel
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={position === 'bottom' ? 'secondary' : 'outline'}
            size="icon"
            className={cn(
              workflowEditorTheme.iconButton,
              position === 'bottom' && workflowEditorTheme.tabActive,
              'workflow-editor-panel-position-button h-6 w-6 rounded-md transition-all duration-200'
            )}
            data-active={position === 'bottom'}
            aria-pressed={position === 'bottom'}
            onClick={() => handlePositionChange('bottom')}
          >
            <ModernPanelBottomIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Bottom Panel</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] font-logo">
          Bottom Panel
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={position === 'floating' ? 'secondary' : 'outline'}
            size="icon"
            className={cn(
              workflowEditorTheme.iconButton,
              position === 'floating' && workflowEditorTheme.tabActive,
              'workflow-editor-panel-position-button h-6 w-6 rounded-md transition-all duration-200'
            )}
            data-active={position === 'floating'}
            aria-pressed={position === 'floating'}
            onClick={() => handlePositionChange('floating')}
          >
            <ModernFloatingPanelIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Floating Panel</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] font-logo">
          Floating Panel
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
