'use client'

import { useEffect } from 'react'
import { generateUUID } from '@/lib/utils'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

interface ClipboardEntry {
  block: {
    id: string
    type: string
    name: string
    position: { x: number; y: number }
    [key: string]: any
  }
  subBlockValues: Record<string, any>
}

interface UseWorkflowKeyboardShortcutsOptions {
  selectedEdgeId: string | null
  setSelectedEdgeId: (id: string | null) => void
  removeEdge: (id: string) => void
  syncEdgeRemove: (id: string) => void
  clearSelection: () => void
  blocks: Record<string, any>
  clipboard: ClipboardEntry[] | null
  setClipboard: (entries: ClipboardEntry[] | null) => void
  activeWorkflowId: string | null
  syncNodeRemove: (id: string) => void
}

/**
 * Handles all workflow-level keyboard shortcuts:
 * - Undo/Redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
 * - Duplicate (Cmd/Ctrl+D)
 * - Copy/Paste (Cmd/Ctrl+C/V)
 * - Delete (Delete/Backspace)
 * - Escape (clear selection)
 * - Select All (Cmd/Ctrl+A)
 */
export function useWorkflowKeyboardShortcuts({
  selectedEdgeId,
  setSelectedEdgeId,
  removeEdge,
  syncEdgeRemove,
  clearSelection,
  blocks,
  clipboard,
  setClipboard,
  activeWorkflowId,
  syncNodeRemove,
}: UseWorkflowKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input, textarea, or contenteditable element
      const activeElement = document.activeElement
      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.hasAttribute('contenteditable') ||
        activeElement?.closest('[contenteditable="true"]')

      // Check if right sidebar is open/focused
      const isDialogOpen = !!document.querySelector('[role="dialog"][data-state="open"]')

      // Check if focus is inside sidebar
      const isFocusInSidebar = activeElement?.closest('[data-right-sidebar]')

      // If user is in an editable element, allow native behavior
      const shouldBlockShortcuts = isEditableElement || isDialogOpen || isFocusInSidebar

      const isMod = event.metaKey || event.ctrlKey

      // Undo: Cmd/Ctrl+Z
      if (event.key === 'z' && isMod && !event.shiftKey) {
        if (shouldBlockShortcuts) return
        event.preventDefault()
        useWorkflowStore.getState().undo()
        return
      }

      // Redo: Cmd/Ctrl+Shift+Z
      if (event.key === 'z' && isMod && event.shiftKey) {
        if (shouldBlockShortcuts) return
        event.preventDefault()
        useWorkflowStore.getState().redo()
        return
      }

      // Duplicate: Cmd/Ctrl+D
      if (event.key === 'd' && isMod) {
        if (shouldBlockShortcuts) return
        event.preventDefault()
        const { selectedNodeIds: ids, duplicateBlock } = useWorkflowStore.getState()
        ids.forEach((nodeId) => {
          if (!nodeId.startsWith('group-') && !nodeId.startsWith('loop-')) {
            duplicateBlock(nodeId)
          }
        })
        return
      }

      // Copy: Cmd/Ctrl+C
      if (event.key === 'c' && isMod) {
        if (shouldBlockShortcuts) return
        const { selectedNodeIds: ids, blocks: storeBlocks } = useWorkflowStore.getState()
        const { workflowValues } = useSubBlockStore.getState()
        const wfId = activeWorkflowId
        if (ids.length === 0) return
        const copied = ids
          .filter((nodeId) => !nodeId.startsWith('group-') && !nodeId.startsWith('loop-'))
          .map((nodeId) => ({
            block: storeBlocks[nodeId],
            subBlockValues: (wfId ? workflowValues[wfId]?.[nodeId] : null) ?? {},
          }))
          .filter((entry) => Boolean(entry.block))
        if (copied.length > 0) setClipboard(copied)
        return
      }

      // Paste: Cmd/Ctrl+V
      if (event.key === 'v' && isMod) {
        if (shouldBlockShortcuts) return
        if (!clipboard || clipboard.length === 0) return
        event.preventDefault()
        const { addBlock: storeAddBlock, setSelectedNodes } = useWorkflowStore.getState()
        const wfId = activeWorkflowId
        const newIds: string[] = []
        clipboard.forEach(({ block, subBlockValues }) => {
          if (!block) return
          // Prevent pasting starter blocks (only one allowed)
          if (block.type === 'starter') return
          const newId = generateUUID()
          newIds.push(newId)
          storeAddBlock(newId, block.type, block.name, {
            x: block.position.x + 60,
            y: block.position.y + 60,
          })
          if (wfId && Object.keys(subBlockValues).length > 0) {
            useSubBlockStore.setState((state) => ({
              workflowValues: {
                ...state.workflowValues,
                [wfId]: {
                  ...state.workflowValues[wfId],
                  [newId]: JSON.parse(JSON.stringify(subBlockValues)),
                },
              },
            }))
          }
        })
        setSelectedNodes(newIds)
        return
      }

      // Delete edge
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeId) {
        if (isEditableElement) return
        removeEdge(selectedEdgeId)
        syncEdgeRemove(selectedEdgeId)
        setSelectedEdgeId(null)
        return
      }

      // Delete selected blocks
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isEditableElement) return
        const {
          selectedNodeIds: ids,
          removeBlock,
          blocks: storeBlocks,
        } = useWorkflowStore.getState()
        if (ids.length === 0) return
        ids.forEach((nodeId) => {
          if (
            !nodeId.startsWith('group-') &&
            !nodeId.startsWith('loop-') &&
            storeBlocks[nodeId]?.type !== 'starter'
          ) {
            removeBlock(nodeId)
            syncNodeRemove(nodeId)
          }
        })
        return
      }

      // Clear selection on Escape
      if (event.key === 'Escape') {
        if (isDialogOpen) return
        clearSelection()
        setSelectedEdgeId(null)
        return
      }

      // Select all blocks with Ctrl+A
      if (event.key === 'a' && isMod) {
        if (shouldBlockShortcuts) return
        event.preventDefault()
        const allBlockIds = Object.keys(blocks)
        const { setSelectedNodes } = useWorkflowStore.getState()
        setSelectedNodes(allBlockIds)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedEdgeId,
    removeEdge,
    clearSelection,
    blocks,
    clipboard,
    activeWorkflowId,
    setClipboard,
    syncEdgeRemove,
    setSelectedEdgeId,
    syncNodeRemove,
  ])
}
