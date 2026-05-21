'use client'

import { useState } from 'react'
import { Code as CodeIcon, Info, Settings, Sliders, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks/index'

interface BlockContentTabsProps {
  blockId: string
  activeTab: string
  onTabChange: (tab: string) => void
  availableTabs?: string[]
}

export function BlockContentTabs({
  blockId,
  activeTab,
  onTabChange,
  availableTabs,
}: BlockContentTabsProps) {
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type || '')
  const blockConfig = getBlock(blockType)

  // Define available tabs based on block type
  const tabs = [
    { id: 'config', label: 'Configuration', icon: Sliders },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ]

  // Add code tab for blocks that support it
  if (blockConfig?.supportsCode) {
    tabs.push({ id: 'code', label: 'Code', icon: CodeIcon })
  }

  // Add info tab for all blocks
  tabs.push({ id: 'info', label: 'Info', icon: Info })

  // Add performance tab for blocks that support it
  if (blockConfig?.supportsPerformance) {
    tabs.push({ id: 'performance', label: 'Performance', icon: Zap })
  }

  return (
    <div className="silver-glass-pane mb-6 flex items-center space-x-0.5 overflow-x-auto rounded-2xl p-1.5 no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-logo font-medium rounded-lg transition-all duration-200 relative flex-shrink-0',
              isActive
                ? 'silver-glass-chip bg-black/[0.06] text-black/90 border border-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-white/[0.10] dark:border-white/[0.10] dark:text-white/95'
                : 'silver-glass-chip text-black/50 border border-transparent hover:text-black/80 dark:text-white/60 dark:hover:text-white/85'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 transition-colors duration-200',
                isActive ? 'text-[#4A7A68] dark:text-[#94B8A6]' : 'text-black/40 dark:text-white/50'
              )}
              strokeWidth={1.5}
            />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
