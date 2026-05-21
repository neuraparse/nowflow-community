'use client'

import React, { useCallback, useState } from 'react'
import { type Node, type NodeProps, useReactFlow } from '@xyflow/react'
import { Edit2, Palette, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { GroupState } from '@/stores/workflows/workflow/types'

const GROUP_COLOR_PALETTE = [
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Orange', value: '#F97316' },
]

interface GroupZoneData extends Record<string, unknown> {
  group: GroupState
  bounds: { width: number; height: number }
}

type GroupZoneNode = Node<GroupZoneData, string>

/**
 * GroupZone — renders INSIDE the group container node.
 * The container's style (width, height, background, border) is set by React Flow
 * from the node's style property. This component renders the label bar absolutely
 * positioned above the container. Because it's the SAME node, label and container
 * move in perfect sync — zero lag.
 */
export const GroupZone = React.memo(function GroupZone({ id, data }: NodeProps<GroupZoneNode>) {
  const { group, bounds } = data
  const color = group.color || '#8B5CF6'

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(group.name)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)

  const updateGroupName = useWorkflowStore((s) => s.updateGroupName)
  const updateGroupColor = useWorkflowStore((s) => s.updateGroupColor)
  const deleteGroup = useWorkflowStore((s) => s.deleteGroup)

  const { setNodes } = useReactFlow()

  const handleNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditedName(group.name)
      setIsEditing(true)
    },
    [group.name]
  )

  const handleNameSubmit = useCallback(() => {
    const trimmedName = editedName.trim()
    if (trimmedName && trimmedName !== group.name) {
      updateGroupName(group.id, trimmedName)
    }
    setIsEditing(false)
  }, [editedName, group.name, group.id, updateGroupName])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        handleNameSubmit()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
      }
    },
    [handleNameSubmit]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteGroup(group.id)
    },
    [group.id, deleteGroup]
  )

  const handleSelectAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const nodeIdSet = new Set(group.nodeIds)

      if (e.ctrlKey || e.metaKey) {
        setNodes((nodes) =>
          nodes.map((n) => ({
            ...n,
            selected: n.selected || nodeIdSet.has(n.id),
          }))
        )
      } else {
        setNodes((nodes) =>
          nodes.map((n) => ({
            ...n,
            selected: nodeIdSet.has(n.id),
          }))
        )
      }
    },
    [group.nodeIds, setNodes]
  )

  return (
    <>
      {/* Draggable background — container node is draggable: true, React Flow
          natively handles mousedown → drag. handleNodesChange moves member blocks. */}
      <div className="absolute inset-0 cursor-grab active:cursor-grabbing rounded-2xl" />

      {/* Label bar — absolutely positioned ABOVE the container. */}
      <div
        className="absolute left-0 right-0 flex items-center justify-between"
        style={{
          top: -32,
          pointerEvents: 'auto',
        }}
      >
        {/* Left: Label pill */}
        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value.slice(0, 30))}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="h-6 w-32 text-[10px] font-logo font-semibold bg-white/90 dark:bg-black/60 border-none rounded-full px-2.5"
            maxLength={30}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer hover:brightness-110 active:brightness-95 transition-all duration-150 select-none"
            style={{ background: color }}
            onClick={handleSelectAll}
          >
            <span className="text-[10px] font-logo font-semibold text-white tracking-wide whitespace-nowrap">
              {group.name}
            </span>
            <span className="text-[9px] font-logo text-white/60 font-medium">
              {group.nodeIds.length}
            </span>
          </div>
        )}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-0.5">
          {/* Color Picker */}
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Palette className="h-2.5 w-2.5" style={{ color }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2.5"
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-5 gap-1.5">
                {GROUP_COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    className={cn(
                      'w-6 h-6 rounded-lg transition-all hover:scale-110',
                      group.color === c.value && 'ring-2 ring-offset-1 ring-gray-400'
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateGroupColor(group.id, c.value)
                      setIsColorPickerOpen(false)
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Rename */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity"
            onClick={handleNameClick}
          >
            <Edit2 className="h-2.5 w-2.5 text-zinc-500 dark:text-white/40" />
          </Button>

          {/* Delete group */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 opacity-60 hover:opacity-100 transition-opacity"
            onClick={handleDelete}
          >
            <Trash2 className="h-2.5 w-2.5 text-red-400" />
          </Button>
        </div>
      </div>
    </>
  )
})
