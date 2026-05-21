import React from 'react'
import { hexToRgba } from '@/components/workflow/live-canvas-block-style'
import { cn } from '@/lib/utils'

type BlockContentProps = {
  Icon: any
  bgColor: string
  blockDisplayName: string
  previewSubtitle: string
  previewSubtitleClass: string
  showBrandStarterIcon: boolean
  isDark: boolean
  enabled: boolean
  isEditing: boolean
  editedName: string
  setEditedName: (v: string) => void
  handleNameSubmit: () => void
  handleNameKeyDown: (e: React.KeyboardEvent) => void
  handleNameClick: (e: React.MouseEvent) => void
}

export const BlockContent = React.memo(function BlockContent({
  Icon,
  bgColor,
  blockDisplayName,
  previewSubtitle,
  previewSubtitleClass,
  showBrandStarterIcon,
  isDark,
  enabled,
  isEditing,
  editedName,
  setEditedName,
  handleNameSubmit,
  handleNameKeyDown,
  handleNameClick,
}: BlockContentProps) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Icon badge */}
      <div
        className="workflow-editor-block-icon-badge flex-shrink-0 flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: showBrandStarterIcon
            ? isDark
              ? 'rgba(15,23,42,0.9)'
              : 'rgba(255,255,255,0.98)'
            : !enabled
              ? '#9CA3AF'
              : `linear-gradient(135deg, ${bgColor}, ${bgColor}BA)`,
          boxShadow: showBrandStarterIcon
            ? isDark
              ? '0 8px 18px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 8px 18px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.82)'
            : !enabled
              ? 'none'
              : `0 8px 18px ${hexToRgba(bgColor, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.24)`,
          border: showBrandStarterIcon
            ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`
            : undefined,
        }}
      >
        <Icon
          className={cn(
            'workflow-editor-block-icon pointer-events-none',
            showBrandStarterIcon ? 'w-[16px] h-[16px]' : 'w-[14px] h-[14px] text-white'
          )}
        />
      </div>

      {/* Block name + subtitle */}
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value.slice(0, 30))}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="workflow-editor-block-title block-name-editable nodrag block w-full min-w-0 bg-transparent py-0 text-[11px] leading-none font-logo font-semibold outline-none text-black/80 border-b border-dashed dark:text-white/90"
            style={{ borderColor: bgColor }}
            maxLength={30}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="workflow-editor-block-title block-name-editable nodrag block w-full min-w-0 truncate text-[11px] leading-none font-logo font-semibold text-black/80 cursor-text dark:text-white/90"
            onDoubleClick={handleNameClick}
            title={blockDisplayName}
          >
            {blockDisplayName}
          </span>
        )}
        <span
          className={cn(
            'workflow-editor-block-subtitle truncate text-[8px] leading-none transition-colors duration-300 font-logo',
            previewSubtitleClass
          )}
          title={previewSubtitle}
        >
          {previewSubtitle}
        </span>
      </div>
    </div>
  )
})
