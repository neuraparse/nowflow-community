'use client'

import { Check, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBlockStyleStore } from '@/stores/workflows/block-style/store'
import { BlockCardTheme, BlockStyle } from '@/stores/workflows/block-style/types'

interface BlockStyleEditorProps {
  blockId: string
  onClose?: () => void
}

export function BlockStyleEditor({ blockId, onClose }: BlockStyleEditorProps) {
  const { getBlockStyle, setBlockStyle } = useBlockStyleStore()
  const blockStyle = getBlockStyle(blockId)

  // Card theme options
  const cardThemeOptions: {
    value: BlockCardTheme
    label: string
    description: string
    preview: string
  }[] = [
    {
      value: 'minimal',
      label: 'Minimal',
      description: 'Clean and simple design',
      preview: 'bg-white dark:bg-[#1b1b1b] border-2',
    },
    {
      value: 'glassmorphic',
      label: 'Glassmorphic',
      description: 'Gradient with transparency',
      preview:
        'bg-gradient-to-br from-white/95 to-white/90 dark:from-[#1b1b1b]/95 dark:to-[#1b1b1b]/90 border border-white/30',
    },
    {
      value: 'gradient',
      label: 'Gradient',
      description: 'Full gradient backgrounds',
      preview:
        'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2',
    },
    {
      value: 'neon',
      label: 'Neon',
      description: 'Glowing borders and effects',
      preview: 'bg-[#1b1b1b] border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]',
    },
    {
      value: 'flat',
      label: 'Flat',
      description: 'Flat design with solid colors',
      preview: 'bg-blue-100 dark:bg-blue-900 border-0',
    },
    {
      value: 'neumorphic',
      label: 'Neumorphic',
      description: 'Soft shadows and depth',
      preview:
        'bg-black/[0.06] dark:bg-white/[0.08] border-0 shadow-[8px_8px_16px_#bebebe,-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_#262626,-8px_-8px_16px_#404040]',
    },
  ]

  // Handle style changes
  const handleStyleChange = (changes: Partial<BlockStyle>) => {
    setBlockStyle(blockId, changes)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-logo font-semibold text-[13px] text-black/80 dark:text-white/90">
          Card Theme
        </h4>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>

      {/* Theme Selection */}
      <div className="grid grid-cols-2 gap-2">
        {cardThemeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-200 ${
              blockStyle.cardTheme === option.value
                ? 'border-[#4A7A68]/40 dark:border-[#94B8A6]/30 bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.08] ring-1 ring-[#4A7A68]/20 dark:ring-[#94B8A6]/15'
                : 'border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.10] dark:hover:border-white/[0.10] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            onClick={() => handleStyleChange({ cardTheme: option.value })}
          >
            {/* Preview - Smaller */}
            <div className="w-full h-10 rounded-md overflow-hidden">
              <div className={`w-full h-full ${option.preview}`}>
                <div className="flex items-center gap-1 p-1">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-blue-500" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1.5 bg-black/20 dark:bg-white/20 rounded w-3/4"></div>
                    <div className="h-1 bg-black/15 dark:bg-white/15 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Label */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-logo font-medium text-black/70 dark:text-white/80">
                {option.label}
              </span>
              {blockStyle.cardTheme === option.value && (
                <Check className="h-3 w-3 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end space-x-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useBlockStyleStore.getState().resetBlockStyle(blockId)
          }}
        >
          Reset
        </Button>
        {onClose && (
          <Button variant="default" size="sm" onClick={onClose}>
            <Check className="h-4 w-4 mr-1" strokeWidth={1.5} />
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
