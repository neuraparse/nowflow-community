'use client'

import { ModernStyleIcon } from '@/components/modern-action-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBlockStyleStore } from '@/stores/workflows/block-style/store'

interface BlockStyleButtonProps {
  blockId: string
}

export function BlockStyleButton({ blockId }: BlockStyleButtonProps) {
  const blockStyle = useBlockStyleStore((state) => state.getBlockStyle(blockId))
  const toggleBlockStyleEditor = useBlockStyleStore((state) => state.toggleBlockStyleEditor)
  const activeStyleEditorId = useBlockStyleStore((state) => state.activeStyleEditorId)

  // Check if this block's style editor is active
  const isActive = activeStyleEditorId === blockId

  // Get color based on border color
  const getButtonColor = () => {
    if (blockStyle.borderColor === 'default') return 'text-zinc-500 dark:text-white/40'

    switch (blockStyle.borderColor) {
      case 'blue':
        return 'text-blue-500'
      case 'green':
        return 'text-green-500'
      case 'red':
        return 'text-red-500'
      case 'yellow':
        return 'text-yellow-500'
      case 'purple':
        return 'text-purple-500'
      case 'orange':
        return 'text-orange-500'
      case 'teal':
        return 'text-teal-500'
      case 'pink':
        return 'text-pink-500'
      case 'indigo':
        return 'text-indigo-500'
      default:
        return 'text-zinc-500 dark:text-white/40'
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation() // Prevent card click event
            toggleBlockStyleEditor(blockId)
          }}
          className={`${isActive ? 'bg-accent' : ''} ${getButtonColor()} hover:text-primary/90 transition-colors duration-200`}
        >
          <ModernStyleIcon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Edit Block Style</TooltipContent>
    </Tooltip>
  )
}
