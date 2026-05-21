'use client'

import { useEffect } from 'react'

/**
 * Listens for custom 'update-subblock-value' events dispatched by sub-block components,
 * and forwards them to the sub-block store setter.
 */
export function useSubBlockValueEvents(
  setSubBlockValue: (blockId: string, subBlockId: string, value: any) => void
) {
  useEffect(() => {
    const handleSubBlockValueUpdate = (event: CustomEvent) => {
      const { blockId, subBlockId, value } = event.detail
      if (blockId && subBlockId) {
        setSubBlockValue(blockId, subBlockId, value)
      }
    }

    window.addEventListener('update-subblock-value', handleSubBlockValueUpdate as EventListener)

    return () => {
      window.removeEventListener(
        'update-subblock-value',
        handleSubBlockValueUpdate as EventListener
      )
    }
  }, [setSubBlockValue])
}

/**
 * Listens for custom context-menu events dispatched by block components:
 * - 'workflow-context-menu': opens a context menu at the specified position
 * - 'close-workflow-context-menu': closes the context menu
 */
export function useContextMenuEvents(
  setContextMenu: (
    menu: {
      x: number
      y: number
      targetType: 'canvas' | 'block' | 'group'
      targetId?: string
    } | null
  ) => void
) {
  useEffect(() => {
    const handleWorkflowContextMenu = (event: CustomEvent) => {
      const { x, y, targetType, targetId } = event.detail
      setContextMenu({ x, y, targetType, targetId })
    }

    const handleCloseContextMenu = () => {
      setContextMenu(null)
    }

    window.addEventListener('workflow-context-menu', handleWorkflowContextMenu as EventListener)
    window.addEventListener('close-workflow-context-menu', handleCloseContextMenu as EventListener)

    return () => {
      window.removeEventListener(
        'workflow-context-menu',
        handleWorkflowContextMenu as EventListener
      )
      window.removeEventListener(
        'close-workflow-context-menu',
        handleCloseContextMenu as EventListener
      )
    }
  }, [setContextMenu])
}
