import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { NOTE_COLORS } from './lib/helpers'
import { type NoteColor } from './types'

type StickyNoteBlockProps = {
  id: string
  name: string
  enabled: boolean
  isDark: boolean
}

export const StickyNoteBlock = React.memo(function StickyNoteBlock({
  id,
  name,
  enabled,
  isDark,
}: StickyNoteBlockProps) {
  const updateBlockName = useWorkflowStore((state) => state.updateBlockName)
  const removeBlock = useWorkflowStore((state) => state.removeBlock)
  const activeWorkflowId = useWorkflowRegistry((s) => s.activeWorkflowId)

  const [editingNoteTitle, setEditingNoteTitle] = useState(false)
  const [noteTitleDraft, setNoteTitleDraft] = useState('')

  // ─── Sticky-note subblock values ─
  // O(1) direct lookup via activeWorkflowId instead of O(n) Object.keys scan.
  const { noteValue, colorKey } = useSubBlockStore(
    useShallow((s) => {
      const blockData = activeWorkflowId ? s.workflowValues[activeWorkflowId]?.[id] : null
      return {
        noteValue: (blockData?.['content'] ?? '') as string,
        colorKey: (blockData?.['color'] ?? 'amber') as NoteColor,
      }
    })
  )

  const color = NOTE_COLORS[colorKey] ?? NOTE_COLORS.amber
  const bg = isDark ? color.bgDark : color.bg
  const textColor = isDark ? color.textDark : color.text

  return (
    <div
      className={cn(
        'group relative w-56 min-h-[120px] rounded-xl border-2 transition-[border-color,box-shadow,opacity] duration-300',
        !enabled && 'opacity-40 grayscale'
      )}
      style={{
        background: bg,
        borderColor: color.border,
        boxShadow: `0 2px 12px ${color.dot}25`,
      }}
    >
      {/* Header bar — drag handle */}
      <div
        className="workflow-drag-handle flex items-center gap-2 px-3 py-2 border-b cursor-grab active:cursor-grabbing"
        style={{ borderColor: color.headerBorder }}
      >
        {/* macOS dots + color palette on hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.dot }} />
          <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: color.dot }} />
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-1 transition-opacity duration-150">
            {(Object.entries(NOTE_COLORS) as [NoteColor, typeof NOTE_COLORS.amber][]).map(
              ([key, c]) => (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation()
                    useSubBlockStore.getState().setValue(id, 'color', key)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-3 h-3 rounded-full border border-white/60 transition-transform hover:scale-125 cursor-pointer"
                  style={{
                    backgroundColor: c.dot,
                    outline: colorKey === key ? `2px solid ${c.dot}` : 'none',
                    outlineOffset: '1px',
                  }}
                />
              )
            )}
          </div>
        </div>
        {/* Title — double-click to edit */}
        <div className="flex-1 min-w-0">
          {editingNoteTitle ? (
            <input
              className="w-full bg-transparent outline-none text-[11px] font-logo font-semibold"
              style={{ color: textColor }}
              value={noteTitleDraft}
              autoFocus
              onChange={(e) => setNoteTitleDraft(e.target.value)}
              onBlur={() => {
                updateBlockName(id, noteTitleDraft || name)
                setEditingNoteTitle(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateBlockName(id, noteTitleDraft || name)
                  setEditingNoteTitle(false)
                }
                if (e.key === 'Escape') setEditingNoteTitle(false)
                e.stopPropagation()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-[11px] font-logo font-semibold truncate select-none block"
              style={{ color: textColor }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setNoteTitleDraft(name)
                setEditingNoteTitle(true)
              }}
            >
              {name}
            </span>
          )}
        </div>
        {/* Delete button */}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-0.5 rounded flex-shrink-0 hover:bg-black/10"
          style={{ color: textColor }}
          onClick={(e) => {
            e.stopPropagation()
            removeBlock(id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {/* Note textarea — inline editing, no sidebar */}
      <textarea
        className={cn(
          'w-full min-h-[80px] px-3 py-2 resize-none',
          'bg-transparent outline-none',
          'text-[12px] font-logo leading-relaxed placeholder:opacity-40',
          'nodrag nowheel'
        )}
        style={{ color: textColor }}
        placeholder="Write your note here..."
        value={noteValue as string}
        onChange={(e) => useSubBlockStore.getState().setValue(id, 'content', e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
})
