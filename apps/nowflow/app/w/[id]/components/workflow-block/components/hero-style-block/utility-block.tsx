import React, { useCallback, useState } from 'react'
import { type Connection, Handle, Position } from '@xyflow/react'
import { hexToRgba } from '@/components/workflow/live-canvas-block-style'
import { cn } from '@/lib/utils'
import { getCycleCheckEdges, wouldCreateCycle } from '@/stores/workflows/common/validators'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'
import { BlockConfig } from '@/blocks/types'
import { ActionBar } from '../action-bar/action-bar'

type UtilityBlockProps = {
  id: string
  type: string
  name: string
  config: BlockConfig
  isActive?: boolean
  isPending?: boolean
  enabled: boolean
  isDark: boolean
  handleBorder: string
  primaryParam: string | null
  Icon: any
}

export const UtilityBlock = React.memo(function UtilityBlock({
  id,
  type,
  name,
  config,
  isActive,
  isPending,
  enabled,
  isDark,
  handleBorder,
  primaryParam,
  Icon,
}: UtilityBlockProps) {
  const openRightSidebar = useWorkflowStore((state) => state.openRightSidebar)
  const updateBlockName = useWorkflowStore((state) => state.updateBlockName)

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')

  const handleNameClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditedName(name)
      setIsEditing(true)
    },
    [name]
  )

  const handleNameSubmit = useCallback(() => {
    const trimmedName = editedName.trim().slice(0, 30)
    if (trimmedName && trimmedName !== name) {
      updateBlockName(id, trimmedName)
    }
    setIsEditing(false)
  }, [editedName, name, id, updateBlockName])

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

  const isValidFromUtilitySource = useCallback(
    (c: Connection) => c.targetHandle === 'utility-target',
    []
  )

  const isValidToRegularTarget = useCallback((c: Connection) => {
    if (c.sourceHandle === 'utility-source') return false
    // Prevent backward connections (cycles)
    if (c.source && c.target) {
      const edges = getCycleCheckEdges(useWorkflowStore.getState().edges)
      if (wouldCreateCycle(c.source, c.target, edges)) return false
      // Utility blocks can RECEIVE data (regular source → utility target) but
      // cannot OUTPUT via regular handles. Block utility→regular source connections.
      const blocks = useWorkflowStore.getState().blocks
      const srcConfig = blocks[c.source] ? getBlock(blocks[c.source].type) : null
      if (srcConfig?.isUtility) return false // Utility blocks cannot be source via regular handle
    }
    return true
  }, [])

  const truncatedName = name.length > 20 ? name.slice(0, 19) + '…' : name
  const accentColor = config.bgColor
  const utilityMeta = primaryParam || config.description || type

  return (
    <div
      className={cn(
        'workflow-drag-handle workflow-editor-utility-shell relative group cursor-pointer',
        'transition-[transform,opacity] duration-200 ease-out',
        'hover:scale-[1.01]',
        !enabled && 'opacity-40 grayscale'
      )}
      data-block-type={type}
      data-block-enabled={enabled ? 'true' : 'false'}
      data-block-state={isActive ? 'active' : isPending ? 'pending' : 'idle'}
      style={{ '--workflow-block-accent': accentColor } as React.CSSProperties}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.action-bar')) return
        openRightSidebar(id)
      }}
    >
      {/* TOP source handle — connects upward to host block's utility-target */}
      <Handle
        type="source"
        position={Position.Top}
        id="utility-source"
        className="!z-50 !cursor-crosshair !transition-[box-shadow,opacity] !duration-200 utility-source-pulse"
        style={{
          width: '4px',
          height: '1.5px',
          top: '-2px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: accentColor,
          border: `1.5px solid ${handleBorder}`,
          borderRadius: '999px',
        }}
        isConnectableStart={true}
        isConnectableEnd={false}
        isValidConnection={isValidFromUtilitySource}
      />

      {/* LEFT target handle — utility blocks CAN receive data from previous blocks */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className={cn(
          '!rounded-full !shadow-sm !z-50 !cursor-crosshair',
          '!transition-[box-shadow] !duration-150'
        )}
        style={{
          width: '1px',
          height: '5px',
          left: '-1px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'linear-gradient(to bottom, rgba(96,165,250,0.78), #60a5fa)',
          border: `1px solid ${handleBorder}`,
          boxShadow: 'none',
        }}
        isConnectableStart={false}
        isConnectableEnd={true}
        isValidConnection={isValidToRegularTarget}
      />
      {/* Utility blocks have NO regular output (source) handle.
          Their output goes ONLY through utility-source → host block's utility-target. */}

      {/* ActionBar on hover */}
      <ActionBar blockId={id} blockType={type} />

      {/* Chip body — solid background + colored left accent bar + drone clip-path */}
      <div
        className={cn(
          'workflow-editor-utility-surface silver-glass-pane relative flex items-center gap-2 pl-0 pr-2.5 py-1.5 overflow-hidden',
          'border border-black/[0.06] dark:border-white/[0.08]',
          'transition-[box-shadow] duration-200',
          'shadow-[0_6px_18px_rgba(24,24,27,0.07)] group-hover:shadow-[0_10px_24px_rgba(24,24,27,0.11)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)] dark:group-hover:shadow-[0_14px_30px_rgba(0,0,0,0.3)]',
          'min-w-[146px] max-w-[188px]',
          isActive && 'ring-1 ring-offset-0',
          isPending && 'opacity-80'
        )}
        style={{
          clipPath:
            'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%)',
          borderRadius: '0',
          ...(isActive ? ({ '--tw-ring-color': accentColor } as any) : {}),
        }}
      >
        {/* Internal accent tick */}
        <div
          className="absolute left-2 top-1/2 z-10 w-[2px] -translate-y-1/2 rounded-full"
          style={{
            height: '18px',
            background: `linear-gradient(180deg, ${hexToRgba(accentColor, 0.22)} 0%, ${accentColor} 52%, ${hexToRgba(accentColor, 0.28)} 100%)`,
          }}
        />

        {/* Icon badge */}
        <div
          className="relative z-10 ml-4 flex h-[22px] w-[22px] items-center justify-center rounded-[10px] border border-black/[0.05] dark:border-white/[0.08] flex-shrink-0"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${hexToRgba(accentColor, 0.18)} 0%, rgba(9,9,11,0.78) 100%)`
              : `linear-gradient(135deg, rgba(255,255,255,0.88) 0%, ${hexToRgba(accentColor, 0.12)} 100%)`,
            boxShadow: isDark
              ? `0 8px 18px ${hexToRgba(accentColor, 0.14)}, inset 0 1px 0 rgba(255,255,255,0.08)`
              : `0 6px 14px ${hexToRgba(accentColor, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
          }}
        >
          <Icon
            className="pointer-events-none h-3 w-3 drop-shadow-none"
            style={{ color: accentColor }}
          />
        </div>

        {/* Name + utility metadata */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
          {isEditing ? (
            <input
              autoFocus
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              className="w-full border-b border-dashed bg-transparent text-[10.5px] font-logo font-medium text-black/82 outline-none dark:text-white/88"
              style={{ borderColor: accentColor }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="cursor-text truncate text-[10.5px] font-logo font-medium leading-tight text-black/82 dark:text-white/88"
              onDoubleClick={handleNameClick}
            >
              {truncatedName}
            </span>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="h-1 w-1 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 0 2px ${hexToRgba(accentColor, isDark ? 0.14 : 0.1)}`,
              }}
            />
            <span className="truncate text-[8px] font-logo font-medium leading-none text-black/46 dark:text-white/52">
              {utilityMeta}
            </span>
          </div>
        </div>
      </div>

      {/* Status dot */}
      <div className="absolute right-2 top-2 z-20">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full border border-white/80 dark:border-[#111113]',
            !enabled
              ? 'bg-red-500'
              : isActive
                ? 'bg-emerald-500 shadow-[0_0_5px_rgba(34,197,94,0.56)] animate-pulse'
                : isPending
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-black/20 dark:bg-white/30'
          )}
        />
      </div>
    </div>
  )
})
