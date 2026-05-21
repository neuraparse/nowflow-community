'use client'

import React, { memo, useCallback, useMemo, useState } from 'react'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks/index'
import { ConnectionPanel } from '../sub-block/components/connection-panel'
import { BlockContentAdvanced } from './block-content-advanced'
import { BlockContentCode } from './block-content-code'
import { BlockContentInfo } from './block-content-info'
import { BlockContentPerformance } from './block-content-performance'
import { BlockContentTabs } from './block-content-tabs'

export type BlockContentTab = 'config' | 'advanced' | 'code' | 'info' | 'performance'

interface BlockContentProps {
  blockId: string
  subBlockRows: any[]
  isConnecting: boolean
  children: React.ReactNode
}

// Memoized BlockContent component for better performance
export const BlockContent = memo<BlockContentProps>(
  ({ blockId, subBlockRows, isConnecting, children }) => {
    const [activeTab, setActiveTab] = useState<BlockContentTab>('config')

    // Memoized block configuration
    const blockConfig = useMemo(() => {
      const blockType = useWorkflowStore.getState().blocks[blockId]?.type
      return blockType ? getBlock(blockType) : null
    }, [blockId])

    // Memoized tab change handler
    const handleTabChange = useCallback((tab: BlockContentTab) => {
      setActiveTab(tab)
    }, [])

    // Memoized available tabs based on block configuration
    const availableTabs = useMemo(() => {
      const tabs: BlockContentTab[] = ['config']

      if (blockConfig?.tools?.access?.length) {
        tabs.push('advanced')
      }

      if (
        blockConfig?.type === 'function' ||
        blockConfig?.subBlocks?.some((sb) => sb.type === 'code')
      ) {
        tabs.push('code')
      }

      tabs.push('info')

      // Performance tab for blocks that support metrics
      if (['agent', 'api', 'function'].includes(blockConfig?.type || '')) {
        tabs.push('performance')
      }

      return tabs
    }, [blockConfig])

    // Memoized tab content renderer
    const renderTabContent = useMemo(() => {
      switch (activeTab) {
        case 'config':
          return (
            <div className="space-y-6">
              <ConnectionPanel blockId={blockId} />
              {children}
            </div>
          )
        case 'advanced':
          return <BlockContentAdvanced blockId={blockId} />
        case 'code':
          return <BlockContentCode blockId={blockId} />
        case 'info':
          return <BlockContentInfo blockId={blockId} />
        case 'performance':
          return <BlockContentPerformance blockId={blockId} />
        default:
          return null
      }
    }, [activeTab, blockId, children])

    return (
      <div className="space-y-4 relative z-[9999]">
        <BlockContentTabs
          blockId={blockId}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          availableTabs={availableTabs}
        />
        {renderTabContent}
      </div>
    )
  }
)

BlockContent.displayName = 'BlockContent'
