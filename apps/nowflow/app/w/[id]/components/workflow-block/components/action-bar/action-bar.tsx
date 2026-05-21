import React, { memo } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Circle,
  Copy,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCopilot } from '@/components/copilot/copilot-provider'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'

interface ActionBarProps {
  blockId: string
  blockType: string
  inContent?: boolean
}

const hoverActionTooltipClass =
  'workflow-editor-action-tooltip smoky-glass-panel rounded-[10px] border border-black/[0.06] px-2.5 py-1 text-[11px] font-logo text-black/78 shadow-[0_14px_28px_rgba(24,24,27,0.10)] dark:border-white/[0.08] dark:text-white/80 dark:shadow-[0_18px_34px_rgba(0,0,0,0.28)]'

const hoverActionButtonBase =
  'workflow-editor-action-button h-[19px] w-[19px] rounded-[5px] p-0 text-black/62 transition-[background-color,color,transform] duration-200 hover:bg-black/[0.06] hover:text-black/88 dark:text-white/72 dark:hover:bg-white/[0.08] dark:hover:text-white'

interface HoverActionButtonProps {
  title: string
  onClick: (e: React.MouseEvent) => void
  className?: string
  children: React.ReactNode
}

function HoverActionButton({ title, onClick, className, children }: HoverActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(hoverActionButtonBase, className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className={hoverActionTooltipClass}>
        {title}
      </TooltipContent>
    </Tooltip>
  )
}

function HoverActionDivider() {
  return <div className="h-2.5 w-px rounded-full bg-black/[0.08] dark:bg-white/[0.10]" />
}

export const ActionBar = memo(function ActionBar({
  blockId,
  blockType,
  inContent = false,
}: ActionBarProps) {
  // ── Granular subscriptions: only re-render when this block's status changes ──
  const { isEnabled, isBookmarked } = useWorkflowStore(
    useShallow((s) => ({
      isEnabled: s.blocks[blockId]?.enabled ?? true,
      isBookmarked: s.blocks[blockId]?.bookmarked ?? false,
    }))
  )

  const {
    removeBlock,
    toggleBlockEnabled,
    duplicateBlock,
    toggleBookmark,
    resetBlock,
    openRightSidebar,
  } = useWorkflowStore(
    useShallow((s) => ({
      removeBlock: s.removeBlock,
      toggleBlockEnabled: s.toggleBlockEnabled,
      duplicateBlock: s.duplicateBlock,
      toggleBookmark: s.toggleBlockBookmark,
      resetBlock: s.resetBlock,
      openRightSidebar: s.openRightSidebar,
    }))
  )

  const isStarterBlock = blockType === 'starter'

  // Copilot integration
  const { setIsOpen: setCopilotOpen, sendMessage: sendCopilotMessage } = useCopilot()

  const handleFillWithCopilot = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    e.stopPropagation()

    // Read from store state on-demand — no subscription needed for rare action
    const { blocks: allBlocks, edges } = useWorkflowStore.getState()
    const block = allBlocks[blockId]
    if (!block) return

    const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId
    const subBlockValues = activeWorkflowId
      ? (useSubBlockStore.getState().workflowValues[activeWorkflowId]?.[blockId] ?? {})
      : {}

    const blockConfig = getBlock(block.type)
    const blockName = (block as any).metadata?.name || block.type

    // Find connected blocks for workflow context
    const predecessorNames = edges
      .filter((edge) => edge.target === blockId)
      .map(
        (edge) =>
          (allBlocks[edge.source] as any)?.metadata?.name ||
          allBlocks[edge.source]?.type ||
          edge.source
      )
      .filter(Boolean)
      .join(', ')
    const successorNames = edges
      .filter((edge) => edge.source === blockId)
      .map(
        (edge) =>
          (allBlocks[edge.target] as any)?.metadata?.name ||
          allBlocks[edge.target]?.type ||
          edge.target
      )
      .filter(Boolean)
      .join(', ')

    // List empty fields with type hint + required/optional label for Copilot context
    const emptyFields =
      blockConfig?.subBlocks
        ?.filter((sb) => !sb.hidden && !subBlockValues[sb.id])
        .map((sb) => {
          const isRequired = blockConfig.inputs?.[sb.id]?.required === true
          let typeHint: string
          if (sb.type === 'dropdown' && sb.options) {
            const opts = typeof sb.options === 'function' ? sb.options() : sb.options
            const labels = (opts as any[])
              .slice(0, 5)
              .map((o: any) => (typeof o === 'object' ? o.label || o.id : String(o)))
              .join('|')
            typeHint = `dropdown[${labels}]`
          } else if (sb.type === 'slider') {
            typeHint = `slider[${(sb as any).min ?? 0}–${(sb as any).max ?? 100}]`
          } else {
            typeHint = sb.type
          }
          return `- ${sb.title || sb.id} (${typeHint}) ${isRequired ? '[REQUIRED]' : '[optional]'}`
        })
        .join('\n') ?? 'all fields'

    const contextLine = [
      predecessorNames && `Receives data from: ${predecessorNames}`,
      successorNames && `Sends data to: ${successorNames}`,
    ]
      .filter(Boolean)
      .join(' | ')

    const message = [
      `Please fill the "${blockName}" block (type: ${block.type}, id: ${blockId}).`,
      contextLine ? `Workflow context: ${contextLine}` : null,
      `Empty fields to configure:\n${emptyFields}`,
      `Configure all fields with intelligent values appropriate for this block's role in the workflow.`,
    ]
      .filter(Boolean)
      .join('\n')

    setCopilotOpen(true)
    sendCopilotMessage(message)
  }

  // Render action bar in content area - Modern minimal design
  if (inContent) {
    return (
      <div
        className="flex flex-wrap gap-2 mb-4 pt-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]"
        onClick={(e) => {
          // Allow Ctrl/Cmd/Shift clicks to propagate for multi-selection
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            return
          }
          e.stopPropagation() // Prevent card click event
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                // Allow Ctrl/Cmd/Shift clicks to propagate for multi-selection
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                  return
                }
                e.stopPropagation() // Prevent card click event
                toggleBlockEnabled(blockId)
              }}
              className={cn(
                'rounded-lg backdrop-blur-sm transition-all duration-300 group',
                isEnabled
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg hover:shadow-emerald-500/10'
                  : 'bg-red-50/80 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/60 hover:border-red-300 dark:hover:border-red-700 hover:shadow-lg hover:shadow-red-500/10'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Circle
                  className={cn(
                    'h-3.5 w-3.5',
                    isEnabled
                      ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400'
                      : 'text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400'
                  )}
                />
                <span className="text-xs font-medium">{isEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs font-medium">
            {isEnabled ? 'Disable Block' : 'Enable Block'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) return
                e.stopPropagation()
                toggleBookmark?.(blockId)
              }}
              className={cn(
                'rounded-lg backdrop-blur-sm transition-all duration-300',
                isBookmarked
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg hover:shadow-amber-500/10'
                  : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.12] hover:shadow-md'
              )}
            >
              <div className="flex items-center gap-1.5">
                {isBookmarked ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 text-black/40 dark:text-white/50" />
                )}
                <span className="text-xs font-medium">
                  {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </span>
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs font-medium">
            {isBookmarked ? 'Remove Bookmark' : 'Bookmark Block'}
          </TooltipContent>
        </Tooltip>

        {!isStarterBlock && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return
                    e.stopPropagation()
                    duplicateBlock(blockId)
                  }}
                  className="rounded-lg bg-cyan-50/80 dark:bg-cyan-950/30 backdrop-blur-sm border-cyan-200/60 dark:border-cyan-800/60 hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-medium">Duplicate</span>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-medium">
                Duplicate Block
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return
                    e.stopPropagation()
                    resetBlock?.(blockId)
                  }}
                  className="rounded-lg bg-orange-50/80 dark:bg-orange-950/30 backdrop-blur-sm border-orange-200/60 dark:border-orange-800/60 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium">Reset</span>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-medium">
                Reset Block
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return
                    e.stopPropagation()
                    removeBlock(blockId)
                  }}
                  className="rounded-lg bg-red-50/80 dark:bg-red-950/30 backdrop-blur-sm border-red-200/60 dark:border-red-800/60 hover:border-red-300 dark:hover:border-red-700 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-medium">Delete</span>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-medium">
                Delete Block
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFillWithCopilot}
                  className="rounded-lg bg-violet-50/80 dark:bg-violet-950/30 backdrop-blur-sm border-violet-200/60 dark:border-violet-800/60 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs font-medium">Fill with Copilot</span>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-medium">
                Ask Copilot to configure this block
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    )
  }

  // Ultra Minimal hover action bar - Clean and distant with smart hover bridge
  return (
    <div
      className={cn(
        'action-bar',
        'smoky-glass-panel',
        'absolute -top-[38px] left-0 right-0',
        'mx-auto flex w-full items-center justify-center gap-1 rounded-[8px] border px-1.5 py-[5px]',
        'border-black/[0.06] dark:border-white/[0.08]',
        'shadow-[0_18px_38px_rgba(24,24,27,0.12)] dark:shadow-[0_24px_44px_rgba(0,0,0,0.32)]',
        'z-50 transition-all duration-200',
        'after:content-[""] after:absolute after:top-full after:left-0 after:right-0',
        'after:h-16 after:bg-transparent after:pointer-events-none'
      )}
      role="toolbar"
      aria-label="Block actions"
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return
        e.stopPropagation()
      }}
    >
      <HoverActionButton
        title="Configure"
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          e.stopPropagation()
          openRightSidebar(blockId)
        }}
        className="text-[#4A7A68]/80 hover:bg-[#4A7A68]/[0.10] hover:text-[#4A7A68] dark:text-[#94B8A6]/80 dark:hover:bg-[#94B8A6]/[0.12] dark:hover:text-[#B6D2C2]"
      >
        <Sparkles className="h-[10px] w-[10px]" strokeWidth={1.4} />
      </HoverActionButton>

      <HoverActionDivider />

      <HoverActionButton
        title={isEnabled ? 'Disable' : 'Enable'}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          e.stopPropagation()
          toggleBlockEnabled(blockId)
        }}
        className={cn(
          isEnabled
            ? 'text-emerald-600 hover:bg-emerald-500/[0.12] hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/[0.14] dark:hover:text-emerald-300'
            : 'text-red-600 hover:bg-red-500/[0.12] hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/[0.14] dark:hover:text-red-300'
        )}
      >
        <Circle
          className={cn(
            'h-[10px] w-[10px]',
            isEnabled ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-red-600 dark:fill-red-400'
          )}
        />
      </HoverActionButton>

      <HoverActionButton
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          e.stopPropagation()
          toggleBookmark?.(blockId)
        }}
        className={cn(
          isBookmarked &&
            'text-amber-600 hover:bg-amber-500/[0.12] hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-500/[0.14] dark:hover:text-amber-300'
        )}
      >
        {isBookmarked ? (
          <BookmarkCheck className="h-[10px] w-[10px]" strokeWidth={1.4} />
        ) : (
          <Bookmark className="h-[10px] w-[10px]" strokeWidth={1.4} />
        )}
      </HoverActionButton>

      {!isStarterBlock && (
        <>
          <HoverActionDivider />

          <HoverActionButton
            title="Duplicate"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.stopPropagation()
              duplicateBlock(blockId)
            }}
            className="hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
          >
            <Copy className="h-[10px] w-[10px]" strokeWidth={1.4} />
          </HoverActionButton>

          <HoverActionButton
            title="Reset"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.stopPropagation()
              resetBlock?.(blockId)
            }}
            className="hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
          >
            <RotateCcw className="h-[10px] w-[10px]" strokeWidth={1.4} />
          </HoverActionButton>

          <HoverActionButton
            title="Ask Copilot"
            onClick={handleFillWithCopilot}
            className="text-[#4A7A68]/80 hover:bg-[#4A7A68]/[0.10] hover:text-[#4A7A68] dark:text-[#94B8A6]/80 dark:hover:bg-[#94B8A6]/[0.12] dark:hover:text-[#B6D2C2]"
          >
            <Wand2 className="h-[10px] w-[10px]" strokeWidth={1.4} />
          </HoverActionButton>

          <HoverActionDivider />

          <HoverActionButton
            title="Delete"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              e.stopPropagation()
              removeBlock(blockId)
            }}
            className="text-red-600 hover:bg-red-500/[0.12] hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/[0.14] dark:hover:text-red-300"
          >
            <Trash2 className="h-[10px] w-[10px]" strokeWidth={1.4} />
          </HoverActionButton>
        </>
      )}
    </div>
  )
})
