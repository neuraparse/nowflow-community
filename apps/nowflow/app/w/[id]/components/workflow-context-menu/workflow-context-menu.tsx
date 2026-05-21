'use client'

import { useEffect, useState } from 'react'
import { Copy, Group, Play, Square, Trash2, Ungroup } from 'lucide-react'
import { createLogger } from '@/lib/logs/console-logger'
import { useExecutionStore } from '@/stores/execution/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getKeyboardShortcutText } from '../../hooks/use-keyboard-shortcuts'

const logger = createLogger('workflow-context-menu')

interface WorkflowContextMenuProps {
  x: number
  y: number
  onClose: () => void
  targetType: 'canvas' | 'block' | 'group'
  targetId?: string
  onCopy?: (ids: string[]) => void
}

export function WorkflowContextMenu({
  x,
  y,
  onClose,
  targetType,
  targetId,
  onCopy,
}: WorkflowContextMenuProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Store access — use getState() for action functions to avoid over-subscription
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds)
  const duplicateBlock = useWorkflowStore((s) => s.duplicateBlock)
  const createGroup = useWorkflowStore((s) => s.createGroup)
  const clearSelection = useWorkflowStore((s) => s.clearSelection)

  const deleteBlock = (useWorkflowStore as any).deleteBlock
  const ungroupNodes = (useWorkflowStore as any).ungroupNodes

  const { isExecuting } = useExecutionStore()

  // Show menu with animation
  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check if click is outside the context menu
      if (!target.closest('.workflow-context-menu')) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleCloseEvent = () => {
      onClose()
    }

    // Add a small delay to prevent immediate closing when menu opens
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, { capture: true })
      document.addEventListener('click', handleClickOutside, { capture: true })
      document.addEventListener('keydown', handleEscape)
      window.addEventListener('close-workflow-context-menu', handleCloseEvent)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, { capture: true })
      document.removeEventListener('click', handleClickOutside, { capture: true })
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('close-workflow-context-menu', handleCloseEvent)
    }
  }, [onClose])

  const handleCopyBlocks = () => {
    const ids =
      selectedNodeIds.length > 0
        ? selectedNodeIds
        : targetId && targetType === 'block'
          ? [targetId]
          : []
    if (ids.length > 0 && onCopy) {
      onCopy(ids)
      logger.debug('Copied blocks to clipboard:', ids)
    }
    onClose()
  }

  const handleDeleteBlocks = () => {
    const blocks = useWorkflowStore.getState().blocks
    if (selectedNodeIds.length > 0) {
      selectedNodeIds.forEach((nodeId) => {
        if (nodeId.startsWith('group-')) {
          // Handle group deletion
          const groupId = nodeId.replace('group-', '')
          ungroupNodes(groupId)
        } else if (blocks[nodeId]?.type !== 'starter') {
          deleteBlock(nodeId)
        }
      })
      clearSelection()
    } else if (targetId && targetType === 'block') {
      if (blocks[targetId]?.type !== 'starter') {
        deleteBlock(targetId)
      }
    }
    onClose()
  }

  const handleDuplicateBlock = () => {
    if (targetId && targetType === 'block') {
      duplicateBlock(targetId)
    } else if (selectedNodeIds.length > 0) {
      selectedNodeIds.forEach((nodeId) => {
        if (!nodeId.startsWith('group-')) {
          duplicateBlock(nodeId)
        }
      })
    }
    onClose()
  }

  const handleGroupBlocks = () => {
    if (selectedNodeIds.length > 1) {
      const blockIds = selectedNodeIds.filter((id) => !id.startsWith('group-'))
      if (blockIds.length > 1) {
        createGroup(blockIds, 'New Group')
        clearSelection()
      }
    }
    onClose()
  }

  const handleUngroupBlocks = () => {
    if (targetId && targetType === 'group') {
      const groupId = targetId.replace('group-', '')
      ungroupNodes(groupId)
    }
    onClose()
  }

  const handleExecuteWorkflow = () => {
    if (isExecuting) {
      onClose()
      return
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workflow-run-request'))
    }
    onClose()
  }

  // Menu items based on context
  const getMenuItems = () => {
    const items = []

    if (selectedNodeIds.length > 0 || (targetType === 'block' && targetId)) {
      items.push({
        icon: Copy,
        label: selectedNodeIds.length > 1 ? 'Duplicate Blocks' : 'Duplicate Block',
        action: handleDuplicateBlock,
        shortcut: 'Ctrl+D',
      })

      items.push({
        icon: Copy,
        label: selectedNodeIds.length > 1 ? 'Copy Blocks' : 'Copy Block',
        action: handleCopyBlocks,
        shortcut: 'Ctrl+C',
      })
    }

    if (selectedNodeIds.length > 1) {
      items.push({
        icon: Group,
        label: 'Group Blocks',
        action: handleGroupBlocks,
        shortcut: 'Ctrl+G',
      })
    }

    if (targetType === 'group' && targetId) {
      items.push({
        icon: Ungroup,
        label: 'Ungroup',
        action: handleUngroupBlocks,
        shortcut: 'Ctrl+Shift+G',
      })
    }

    // Separator
    if (items.length > 0) {
      items.push({ separator: true })
    }

    // Execution controls
    items.push({
      icon: isExecuting ? Square : Play,
      label: isExecuting ? 'Running...' : 'Run Workflow',
      action: handleExecuteWorkflow,
      shortcut: getKeyboardShortcutText('Enter', true),
      disabled: isExecuting,
    })

    if (selectedNodeIds.length > 0 || (targetId && targetType !== 'canvas')) {
      items.push({ separator: true })

      items.push({
        icon: Trash2,
        label: selectedNodeIds.length > 1 ? 'Delete Blocks' : 'Delete Block',
        action: handleDeleteBlocks,
        shortcut: 'Delete',
        destructive: true,
      })
    }

    return items
  }

  const menuItems = getMenuItems()

  return (
    <div
      className={`workflow-context-menu fixed z-[9999] bg-popover border border-border rounded-lg shadow-lg py-2 min-w-[200px] transition-all duration-200 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{
        left: x,
        top: y,
        transformOrigin: 'top left',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menuItems.map((item, index) => {
        if ('separator' in item) {
          return <div key={index} className="h-px bg-border my-1" />
        }

        const Icon = item.icon
        return (
          <button
            key={index}
            onClick={item.action}
            disabled={item.disabled}
            className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between group ${
              item.destructive ? 'text-destructive hover:text-destructive' : ''
            } ${item.disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {item.shortcut}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
