'use client'

import { useEffect, useRef } from 'react'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { consumeRemoteSubBlockChange } from '@/hooks/use-realtime-collaboration'

const SYNCED_BLOCK_KEYS = ['name', 'enabled', 'isMinimized', 'isWide'] as const

/**
 * Syncs sub-block value changes to collaborators in real-time.
 * Subscribes to the subblock store and broadcasts changes via syncNodeDataChange.
 * Debounced per field (300ms) to avoid flooding during typing.
 * Skips changes that came from remote (echo-loop prevention).
 */
export function useSubBlockCollaborationSync(
  activeWorkflowId: string | null,
  syncNodeDataChange: (blockId: string, subBlockId: string, value: any) => void
) {
  const prevSubBlockValuesRef = useRef<Record<string, Record<string, any>> | null>(null)

  useEffect(() => {
    const debounceTimers = new Map<string, NodeJS.Timeout>()

    const unsubscribe = useSubBlockStore.subscribe((state) => {
      if (!activeWorkflowId) return
      const current = state.workflowValues[activeWorkflowId]
      if (!current) return
      const previous = prevSubBlockValuesRef.current
      prevSubBlockValuesRef.current = current
      if (!previous) return
      // Diff to find which block/subBlock changed
      for (const blockId of Object.keys(current)) {
        const curBlock = current[blockId]
        const prevBlock = previous[blockId]
        if (!curBlock || curBlock === prevBlock) continue
        for (const subBlockId of Object.keys(curBlock)) {
          if (curBlock[subBlockId] !== prevBlock?.[subBlockId]) {
            // Skip changes that originated from a remote collaborator
            if (consumeRemoteSubBlockChange(blockId, subBlockId)) continue

            // Debounce per field to avoid flooding during typing
            const key = `${blockId}:${subBlockId}`
            const existing = debounceTimers.get(key)
            if (existing) clearTimeout(existing)
            debounceTimers.set(
              key,
              setTimeout(() => {
                syncNodeDataChange(blockId, subBlockId, curBlock[subBlockId])
                debounceTimers.delete(key)
              }, 300)
            )
          }
        }
      }
    })

    return () => {
      unsubscribe()
      debounceTimers.forEach((t) => clearTimeout(t))
    }
  }, [activeWorkflowId, syncNodeDataChange])
}

/**
 * Syncs block-level config changes (name, enabled, isMinimized, isWide) to collaborators.
 */
export function useBlockConfigCollaborationSync(
  syncBlockConfig: (blockId: string, key: string, value: any) => void
) {
  const prevBlocksRef = useRef<Record<string, any> | null>(null)

  useEffect(() => {
    const unsubscribe = useWorkflowStore.subscribe((state) => {
      const currentBlocks = state.blocks
      if (!currentBlocks) return
      const previousBlocks = prevBlocksRef.current
      prevBlocksRef.current = currentBlocks
      if (!previousBlocks) return
      for (const blockId of Object.keys(currentBlocks)) {
        const cur = currentBlocks[blockId]
        const prev = previousBlocks[blockId]
        if (!cur || cur === prev) continue
        for (const key of SYNCED_BLOCK_KEYS) {
          if ((cur as any)[key] !== (prev as any)?.[key]) {
            syncBlockConfig(blockId, key, (cur as any)[key])
          }
        }
      }
    })
    return unsubscribe
  }, [syncBlockConfig])
}
