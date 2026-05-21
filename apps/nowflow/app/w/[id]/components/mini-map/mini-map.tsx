'use client'

import { useState } from 'react'
import { MiniMap as ReactFlowMiniMap } from '@xyflow/react'
import { MaximizeIcon, MinimizeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebarStore } from '@/stores/sidebar/store'

interface MiniMapProps {
  className?: string
}

export function MiniMap({ className }: MiniMapProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { mode, isExpanded: isSidebarExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isSidebarExpanded : mode === 'collapsed' || mode === 'hover'

  // Toggle visibility of the mini map
  const toggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  return (
    <div
      className={`fixed z-10 ${className}`}
      style={{
        bottom: '20px',
        left: isSidebarCollapsed ? '74px' : '270px',
        transition: 'all 0.3s ease',
      }}
    >
      {isVisible ? (
        <div className="flex flex-col">
          <div className="flex items-center justify-between bg-background border border-border rounded-t-md p-1">
            <span className="text-xs font-medium text-muted-foreground px-2">Mini Map</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleVisibility}>
                  <MinimizeIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimize</TooltipContent>
            </Tooltip>
          </div>
          <div className="border border-t-0 border-border rounded-b-md overflow-hidden">
            <ReactFlowMiniMap
              nodeColor="#e2e2e2"
              nodeStrokeWidth={3}
              nodeBorderRadius={2}
              maskColor="rgba(240, 240, 240, 0.6)"
              className="bg-background"
              pannable
              zoomable
              ariaLabel="Workflow mini map"
              style={{ width: 200, height: 150 }}
            />
          </div>
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={toggleVisibility}
            >
              <MaximizeIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show Mini Map</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
