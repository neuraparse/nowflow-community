'use client'

import { useState } from 'react'
import { Copy, Link2Off, RefreshCw, ToggleLeft, Trash2, Users, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { GroupTemplates } from '../workflow-group/group-templates'

interface SelectionToolbarProps {
  selectedNodeIds: string[]
  onClose?: () => void
}

export function SelectionToolbar({ selectedNodeIds, onClose }: SelectionToolbarProps) {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')

  const {
    createGroup,
    clearSelection,
    batchDeleteBlocks,
    duplicateBlock,
    toggleBlockEnabled,
    deleteGroup,
    blocks,
    groups,
    loops,
  } = useWorkflowStore(
    useShallow((s) => ({
      createGroup: s.createGroup,
      clearSelection: s.clearSelection,
      batchDeleteBlocks: s.batchDeleteBlocks,
      duplicateBlock: s.duplicateBlock,
      toggleBlockEnabled: s.toggleBlockEnabled,
      deleteGroup: s.deleteGroup,
      blocks: s.blocks,
      groups: s.groups,
      loops: s.loops,
    }))
  )

  // Separate selected blocks and groups
  const selectedBlocks = selectedNodeIds.filter((id) => !id.startsWith('group-'))
  const selectedGroups = selectedNodeIds
    .filter((id) => id.startsWith('group-'))
    .map((id) => id.replace('group-', ''))

  // Check if selected blocks form a loop
  const selectedBlocksInLoop = selectedBlocks.filter((blockId) => {
    return Object.values(loops).some((loop) => loop.nodes.includes(blockId))
  })

  // Check if all selected blocks are in the same loop
  const allInSameLoop =
    selectedBlocks.length > 0 &&
    selectedBlocks.every((blockId) => {
      const blockLoop = Object.values(loops).find((loop) => loop.nodes.includes(blockId))
      if (!blockLoop) return false
      const firstBlockLoop = Object.values(loops).find((loop) =>
        loop.nodes.includes(selectedBlocks[0])
      )
      return blockLoop?.id === firstBlockLoop?.id
    })

  if (selectedNodeIds.length < 1) {
    return null
  }

  const handleCreateGroup = () => {
    if (isCreatingGroup) {
      const name = groupName.trim() || undefined
      // Only create group with actual blocks (not group or loop nodes)
      if (selectedBlocks.length >= 2) {
        createGroup(selectedBlocks, name)
        setGroupName('')
        setIsCreatingGroup(false)
        clearSelection()
      }
    } else {
      setIsCreatingGroup(true)
    }
  }

  const handleCancelGroup = () => {
    setIsCreatingGroup(false)
    setGroupName('')
  }

  const handleDuplicateSelected = () => {
    selectedNodeIds.forEach((nodeId) => {
      duplicateBlock(nodeId)
    })
    clearSelection()
  }

  const handleDeleteSelected = () => {
    // Filter out group IDs and starter blocks
    const blockIdsToDelete = selectedNodeIds.filter(
      (id) => !id.startsWith('group-') && blocks[id]?.type !== 'starter'
    )

    if (blockIdsToDelete.length === 0) return

    if (confirm(`Are you sure you want to delete ${blockIdsToDelete.length} selected blocks?`)) {
      // Use batch delete for better performance and atomic state updates
      batchDeleteBlocks(blockIdsToDelete)
      clearSelection()
    }
  }

  const handleToggleEnabled = () => {
    // Check if all selected blocks are enabled
    const selectedBlocks = selectedNodeIds.map((id) => blocks[id]).filter(Boolean)
    const allEnabled = selectedBlocks.every((block) => block.enabled !== false)

    // Toggle all to opposite state
    selectedNodeIds.forEach((nodeId) => {
      toggleBlockEnabled(nodeId)
    })
  }

  const handleUngroupSelected = () => {
    // Find groups that contain any of the selected blocks
    const groupsToUngroup = new Set<string>()
    selectedBlocks.forEach((blockId) => {
      Object.entries(groups).forEach(([groupId, group]) => {
        if (group.nodeIds.includes(blockId)) {
          groupsToUngroup.add(groupId)
        }
      })
    })
    groupsToUngroup.forEach((groupId) => {
      deleteGroup(groupId)
    })
    if (groupsToUngroup.size > 0) {
      clearSelection()
    }
  }

  const handleDeleteGroups = () => {
    if (confirm(`Are you sure you want to delete ${selectedGroups.length} selected groups?`)) {
      selectedGroups.forEach((groupId) => {
        deleteGroup(groupId)
      })
      clearSelection()
    }
  }

  const handleClose = () => {
    clearSelection()
    onClose?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateGroup()
    } else if (e.key === 'Escape') {
      handleCancelGroup()
    }
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <Card
        className={cn(
          'shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
          'border border-black/[0.10] dark:border-white/[0.12] bg-white/95 dark:bg-[#1b1b1b]',
          'backdrop-blur-xl rounded-2xl',
          'animate-in slide-in-from-bottom-4 duration-300'
        )}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Selection Info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4A7A68]/[0.10] dark:bg-[#94B8A6]/[0.12] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </div>
            <div className="text-sm">
              <div className="font-logo font-semibold text-black/80 dark:text-white/90">
                {selectedBlocks.length > 0 && selectedGroups.length > 0
                  ? `${selectedBlocks.length} blocks, ${selectedGroups.length} groups selected`
                  : selectedBlocks.length > 0
                    ? `${selectedBlocks.length} blocks selected`
                    : `${selectedGroups.length} groups selected`}
              </div>
              <div className="text-[11px] font-logo text-black/50 dark:text-white/60">
                {[
                  ...selectedBlocks.map((id) => blocks[id]?.name).filter(Boolean),
                  ...selectedGroups.map((id) => groups[id]?.name).filter(Boolean),
                ].join(', ')}
              </div>
              {/* Loop indicator */}
              {selectedBlocksInLoop.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {allInSameLoop ? `All in same loop` : `${selectedBlocksInLoop.length} in loops`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-black/[0.08] dark:bg-white/[0.10]" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isCreatingGroup ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Group name (optional)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value.slice(0, 30))}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-48 h-8 text-sm"
                  maxLength={30}
                />
                <Button
                  size="sm"
                  onClick={handleCreateGroup}
                  className="h-8 bg-[#4A7A68] hover:bg-[#3d6557] dark:bg-[#94B8A6] dark:hover:bg-[#82a694] text-white dark:text-[#1b1b1b] font-logo"
                >
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelGroup} className="h-8">
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                {/* Show group creation only if blocks are selected */}
                {selectedBlocks.length >= 2 && (
                  <Button
                    size="sm"
                    onClick={handleCreateGroup}
                    className="h-8 bg-[#4A7A68] hover:bg-[#3d6557] dark:bg-[#94B8A6] dark:hover:bg-[#82a694] text-white dark:text-[#1b1b1b] font-logo"
                  >
                    <Users className="w-3 h-3 mr-1" strokeWidth={1.5} />
                    Group
                  </Button>
                )}

                {/* Ungroup: show if any selected blocks belong to a group */}
                {selectedBlocks.some((blockId) =>
                  Object.values(groups).some((g) => g.nodeIds.includes(blockId))
                ) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUngroupSelected}
                    className="h-8"
                  >
                    <Link2Off className="w-3 h-3 mr-1" strokeWidth={1.5} />
                    Ungroup
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDuplicateSelected}
                  className="h-8"
                >
                  <Copy className="w-3 h-3 mr-1" strokeWidth={1.5} />
                  Duplicate
                </Button>

                <Button size="sm" variant="outline" onClick={handleToggleEnabled} className="h-8">
                  <ToggleLeft className="w-3 h-3 mr-1" strokeWidth={1.5} />
                  Toggle
                </Button>

                <GroupTemplates selectedNodeIds={selectedNodeIds} />

                {/* Delete blocks */}
                {selectedBlocks.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteSelected}
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3 h-3 mr-1" strokeWidth={1.5} />
                    Delete Blocks
                  </Button>
                )}

                {/* Delete groups */}
                {selectedGroups.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteGroups}
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3 h-3 mr-1" strokeWidth={1.5} />
                    Delete Groups
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Close Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="h-8 w-8 p-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4 text-black/50 dark:text-white/60" strokeWidth={1.5} />
          </Button>
        </div>
      </Card>
    </div>
  )
}
