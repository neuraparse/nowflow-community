'use client'

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCopilot } from '@/components/copilot/copilot-provider'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logs/console-logger'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useValidationStore } from '@/stores/validation/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { mergeSubblockState } from '@/stores/workflows/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'
import { SubBlockConfig } from '@/blocks/types'
import { BlockContent } from '../workflow-block/components/block-content/block-content'
import { SubBlock } from '../workflow-block/components/sub-block/sub-block'

const logger = createLogger('RightSidebar')

interface RightSidebarProps {
  className?: string
}

export function RightSidebar({ className }: RightSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Store selectors — use useShallow to prevent re-renders when object reference
  // changes but actual values are identical. Only subscribe to the minimal fields needed.
  const { isOpen, selectedBlockId, blockName, blockType } = useWorkflowStore(
    useShallow((state) => {
      const id = state.selectedBlockForSidebar
      const block = id ? state.blocks[id] : null
      return {
        isOpen: state.isRightSidebarOpen,
        selectedBlockId: id,
        blockName: block?.name ?? null,
        blockType: block?.type ?? null,
      }
    })
  )
  const closeRightSidebar = useWorkflowStore((state) => state.closeRightSidebar)

  // Animation effect — reduced delay for snappier close
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Get block configuration — memoized to avoid re-computing on every render
  const blockConfig = useMemo(() => (blockType ? getBlock(blockType) : null), [blockType])

  // Reactive active workflow ID. Previously we read this with
  // `useWorkflowRegistry.getState()` inside the Zustand selector / memo below,
  // which captured a stale value on workflow switch — the sidebar would keep
  // reading subBlock values from the old workflow until something else forced
  // a rerender. Subscribing here keeps it in sync.
  const activeWorkflowId = useWorkflowRegistry((state) => state.activeWorkflowId)

  // Subscribe to the values of every subBlock field referenced in a condition
  // so the visibility memo below re-runs when user edits a gating field (e.g.
  // picking "search" in a tool dropdown must reveal the query sub-blocks).
  // Without this subscription the memo only recomputes when the block itself
  // changes, so conditional children never show up.
  const conditionFields = useMemo(() => {
    if (!blockConfig?.subBlocks) return [] as string[]
    const fields = new Set<string>()
    for (const sb of blockConfig.subBlocks) {
      if (sb.condition?.field) fields.add(sb.condition.field)
      if (sb.condition?.and?.field) fields.add(sb.condition.and.field)
    }
    return Array.from(fields)
  }, [blockConfig])

  const conditionValuesKey = useSubBlockStore(
    useShallow((state) => {
      if (!activeWorkflowId || !selectedBlockId) return ''
      const blockValues = state.workflowValues[activeWorkflowId]?.[selectedBlockId] ?? {}
      // Stable string key so the memo only rebuilds when a referenced field changes.
      return conditionFields.map((f) => `${f}=${JSON.stringify(blockValues[f] ?? null)}`).join('|')
    })
  )

  // Memoized sub-block row grouping — recalculates when block, config or any
  // subBlock value referenced by a condition changes.
  const subBlockRows = useMemo(() => {
    const conditionSnapshot = conditionValuesKey
    void conditionSnapshot

    if (!blockConfig?.subBlocks || !selectedBlockId) return []

    const subBlocks = blockConfig.subBlocks
    const blocks = useWorkflowStore.getState().blocks
    const mergedState = mergeSubblockState(blocks, activeWorkflowId || undefined, selectedBlockId)[
      selectedBlockId
    ]

    // Filter visible sub-blocks based on conditions
    const visibleSubBlocks = subBlocks.filter((subBlock) => {
      if (subBlock.hidden) return false

      if (subBlock.condition) {
        const conditionField = subBlock.condition.field
        const conditionValue = subBlock.condition.value
        const conditionNot = subBlock.condition.not || false
        const currentValue = mergedState?.subBlocks?.[conditionField]?.value ?? ''

        let conditionMet = false
        if (Array.isArray(conditionValue)) {
          conditionMet =
            typeof currentValue !== 'object' &&
            conditionValue.includes(currentValue as string | number | boolean)
        } else {
          conditionMet = currentValue === conditionValue
        }

        if (conditionNot) {
          conditionMet = !conditionMet
        }

        if (conditionMet && subBlock.condition.and) {
          const andField = subBlock.condition.and.field
          const andValue = subBlock.condition.and.value
          const andNot = subBlock.condition.and.not || false
          const andCurrentValue = mergedState?.subBlocks?.[andField]?.value ?? ''

          let andConditionMet = false
          if (Array.isArray(andValue)) {
            andConditionMet =
              typeof andCurrentValue !== 'object' &&
              andValue.includes(andCurrentValue as string | number | boolean)
          } else {
            andConditionMet = andCurrentValue === andValue
          }

          if (andNot) {
            andConditionMet = !andConditionMet
          }

          conditionMet = conditionMet && andConditionMet
        }

        return conditionMet
      }

      return true
    })

    // Group into rows
    const rows: SubBlockConfig[][] = []
    let currentRow: SubBlockConfig[] = []
    let currentRowWidth = 0

    visibleSubBlocks.forEach((block) => {
      const blockWidth = block.layout === 'half' ? 0.5 : 1
      if (currentRowWidth + blockWidth > 1) {
        if (currentRow.length > 0) {
          rows.push([...currentRow])
        }
        currentRow = [block]
        currentRowWidth = blockWidth
      } else {
        currentRow.push(block)
        currentRowWidth += blockWidth
      }
    })

    if (currentRow.length > 0) {
      rows.push(currentRow)
    }

    return rows
  }, [blockConfig, selectedBlockId, conditionValuesKey, activeWorkflowId])

  // Debug logging - only when block changes
  useEffect(() => {
    if (selectedBlockId && blockType) {
      logger.info('Right Sidebar opened for block:', {
        blockId: selectedBlockId,
        blockType,
        blockName,
        subBlockCount: blockConfig?.subBlocks?.length || 0,
        visibleRows: subBlockRows.length,
      })
    }
  }, [selectedBlockId, blockType, blockName, blockConfig?.subBlocks?.length, subBlockRows.length])

  // Handle close — stable callback reference for useEffect dependency
  const handleClose = useCallback(() => {
    closeRightSidebar()
  }, [closeRightSidebar])

  // Handle escape key — skip if a dialog or Radix floating layer is open.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        const isDialogOpen = !!document.querySelector('[role="dialog"][data-state="open"]')
        const isFloatingLayerOpen = !!document.querySelector(
          [
            '[data-radix-popper-content-wrapper]',
            '[role="listbox"][data-state="open"]',
            '.workflow-editor-select-content[data-state="open"]',
            '.workflow-editor-popover-content[data-state="open"]',
          ].join(',')
        )
        if (isDialogOpen || isFloatingLayerOpen) return

        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleClose])

  // Validation error state for the selected block
  const validationResult = useValidationStore((s) =>
    selectedBlockId ? s.blockValidations[selectedBlockId] : null
  )
  const validationErrorCount = validationResult?.errors?.length || 0

  // Copilot integration
  const { setIsOpen: setCopilotOpen, sendMessage: sendCopilotMessage } = useCopilot()

  // Returns field type metadata string for Copilot context (type hint + current value)
  const getFieldMeta = useCallback(
    (fieldId: string): string => {
      if (!blockConfig) return ''
      const subBlock = blockConfig.subBlocks.find((sb) => sb.id === fieldId)
      if (!subBlock) return ''

      const currentVal = selectedBlockId
        ? useSubBlockStore.getState().getValue(selectedBlockId, fieldId)
        : undefined
      const valStr =
        currentVal !== undefined && currentVal !== null && currentVal !== ''
          ? ` (current: "${String(currentVal).substring(0, 50)}")`
          : ' (currently empty)'

      switch (subBlock.type) {
        case 'dropdown': {
          const opts =
            typeof subBlock.options === 'function' ? subBlock.options() : (subBlock.options ?? [])
          const optLabels = (opts as any[])
            .slice(0, 8)
            .map((o: any) => (typeof o === 'object' ? o.label || o.id : String(o)))
            .join(', ')
          return `[dropdown: ${optLabels}]${valStr}`
        }
        case 'slider':
          return `[slider: ${subBlock.min ?? 0}–${subBlock.max ?? 100}, step ${(subBlock as any).step ?? 1}]${valStr}`
        case 'short-input':
          return `[text input]${valStr}`
        case 'long-input':
          return `[multi-line text]${valStr}`
        case 'code':
          return `[code editor (${(subBlock as any).language ?? 'javascript'})]${valStr}`
        case 'switch':
        case 'checkbox':
          return `[boolean: true/false]${valStr}`
        default:
          return `[${subBlock.type}]${valStr}`
      }
    },
    [blockConfig, selectedBlockId]
  )

  // Komutsuz: Copilot'ya anlayış ve açıklama isteği
  const handleAskCopilot = useCallback(() => {
    if (!validationResult?.errors?.length) return
    const name = blockName || selectedBlockId || 'this block'
    const errorLines = validationResult.errors
      .map(
        (e) =>
          `- **${e.field}** ${getFieldMeta(e.field)}: ${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`
      )
      .join('\n')
    const message = `I have a validation error in the "${name}" block (type: ${blockType}):\n${errorLines}\n\nCan you help me understand what's wrong and how to fix it?`
    setCopilotOpen(true)
    sendCopilotMessage(message)
  }, [
    validationResult,
    blockName,
    blockType,
    selectedBlockId,
    getFieldMeta,
    setCopilotOpen,
    sendCopilotMessage,
  ])

  // Komutlu: Copilot'ya direkt düzelt komutu — updateSubBlock tool calls
  const handleFixWithCopilot = useCallback(() => {
    if (!validationResult?.errors?.length) return
    const name = blockName || selectedBlockId || 'this block'
    const fieldList = validationResult.errors
      .map((e) => `- Field "${e.field}" ${getFieldMeta(e.field)}: ${e.message}`)
      .join('\n')
    const message = `Please fix these validation errors in the "${name}" block (type: ${blockType}, id: ${selectedBlockId}) right now using updateSubBlock:\n${fieldList}\n\nFill in all required fields immediately with appropriate values. Do not ask for confirmation — just fix them.`
    setCopilotOpen(true)
    sendCopilotMessage(message)
  }, [
    validationResult,
    blockName,
    blockType,
    selectedBlockId,
    getFieldMeta,
    setCopilotOpen,
    sendCopilotMessage,
  ])

  // Warnings için komutsuz
  const handleAskCopilotWarnings = useCallback(() => {
    if (!validationResult?.warnings?.length) return
    const name = blockName || selectedBlockId || 'this block'
    const warningLines = validationResult.warnings
      .map(
        (w) =>
          `- **${w.field}** ${getFieldMeta(w.field)}: ${w.message}${w.suggestion ? ` (${w.suggestion})` : ''}`
      )
      .join('\n')
    const message = `I have configuration warnings in the "${name}" block (type: ${blockType}):\n${warningLines}\n\nShould I be concerned about these? Can you explain and suggest improvements?`
    setCopilotOpen(true)
    sendCopilotMessage(message)
  }, [
    validationResult,
    blockName,
    blockType,
    selectedBlockId,
    getFieldMeta,
    setCopilotOpen,
    sendCopilotMessage,
  ])

  // Scroll to highlighted field when sidebar opens
  useEffect(() => {
    if (!isOpen || !selectedBlockId) return

    const highlighted = useValidationStore.getState().highlightedField
    if (!highlighted || highlighted.blockId !== selectedBlockId) return

    // Small delay to let the sidebar content render
    const timer = setTimeout(() => {
      const el = document.querySelector(
        `[data-right-sidebar] [data-subblock-id="${highlighted.fieldId}"]`
      )
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Clear highlight after scroll animation completes
      setTimeout(() => {
        useValidationStore.getState().clearHighlightedField()
      }, 1200)
    }, 200)

    return () => clearTimeout(timer)
  }, [isOpen, selectedBlockId])

  // Always render but conditionally show content
  return (
    <>
      {/* Backdrop - Simple overlay (no blur for performance) */}
      {isVisible && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 transition-opacity duration-200 dark:bg-black/24"
          onClick={handleClose}
        />
      )}

      {/* Sidebar - Modern Island Design */}
      {isVisible && (
        <div
          ref={sidebarRef}
          data-right-sidebar
          data-right-sidebar-open={isOpen}
          className={cn(
            'workflow-editor-right-sidebar workflow-editor-right-rail workflow-editor-frame workflow-editor-shell silver-glass-panel fixed z-50 flex flex-col rounded-[8px] transition-[transform,opacity] duration-200 ease-out',
            isOpen ? 'translate-x-0' : 'translate-x-full',
            'w-[400px] max-w-[calc(100vw-1.5rem)]',
            className
          )}
          style={
            {
              top: '72px',
              bottom: '84px',
              right: '12px',
              height: 'calc(100dvh - 156px)',
              '--workflow-selected-block-accent': blockConfig?.bgColor || '#38bdf8',
            } as CSSProperties & Record<string, string>
          }
        >
          {/* Header */}
          <div className="workflow-editor-right-rail-header flex h-14 flex-shrink-0 items-center justify-between gap-3 rounded-none border-b border-white/[0.05] bg-transparent px-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {blockConfig?.icon && (
                <div
                  className={cn(
                    workflowEditorTheme.surface,
                    workflowEditorTheme.accent,
                    'workflow-editor-right-rail-header-icon silver-glass-pane flex h-9 w-9 items-center justify-center p-0'
                  )}
                >
                  <blockConfig.icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    className={cn(
                      'min-w-0 truncate text-[13px] font-semibold',
                      workflowEditorTheme.title
                    )}
                  >
                    {blockName || 'Block Configuration'}
                  </h2>
                  {validationResult && !validationResult.valid && (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[10px] font-medium text-red-500 dark:text-red-400">
                        {validationErrorCount} issue{validationErrorCount > 1 ? 's' : ''}
                      </span>
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-0.5 truncate text-[11px] font-medium',
                    workflowEditorTheme.soft
                  )}
                >
                  {blockConfig?.name || blockType}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className={cn(
                workflowEditorTheme.iconButton,
                'workflow-editor-right-rail-close silver-glass-chip h-7 w-7 transition-all duration-200'
              )}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </div>

          {/* Validation Errors Section */}
          {validationResult && !validationResult.valid && (
            <div className="workflow-editor-right-rail-section border-b border-white/[0.05] px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className={cn('text-[11px] font-medium', workflowEditorTheme.muted)}>
                    {validationErrorCount} issue{validationErrorCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={handleAskCopilot}
                    className={cn(
                      workflowEditorTheme.textButton,
                      workflowEditorTheme.accentButton,
                      'workflow-editor-right-rail-action silver-glass-chip px-2.5 py-1 text-[11px] font-medium transition-colors'
                    )}
                  >
                    Ask Copilot
                  </button>
                  <button
                    onClick={handleFixWithCopilot}
                    className={cn(
                      workflowEditorTheme.button,
                      'workflow-editor-right-rail-action silver-glass-button-strong px-2.5 py-1 text-[11px] font-medium text-white'
                    )}
                  >
                    Auto-fix
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {validationResult.errors?.map((error, index) => (
                  <div
                    key={`error-${index}`}
                    className={cn(
                      workflowEditorTheme.callout,
                      workflowEditorTheme.calloutError,
                      'workflow-editor-right-rail-callout silver-glass-pane smoky-glass-pane flex min-w-0 gap-2 p-2'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-px max-w-[80px] flex-shrink-0 truncate text-[10px] font-medium',
                        workflowEditorTheme.soft
                      )}
                    >
                      {error.field}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] leading-snug text-[var(--workflow-editor-accent-danger)]">
                        {error.message}
                      </p>
                      {error.suggestion && (
                        <p
                          className={cn(
                            'mt-0.5 text-[10px] leading-snug',
                            workflowEditorTheme.soft
                          )}
                        >
                          {error.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Warnings Section */}
          {validationResult &&
            validationResult.warnings &&
            validationResult.warnings.length > 0 && (
              <div className="workflow-editor-right-rail-section border-b border-white/[0.05] px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className={cn('text-[11px] font-medium', workflowEditorTheme.muted)}>
                      {validationResult.warnings.length} warning
                      {validationResult.warnings.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={handleAskCopilotWarnings}
                    className={cn(
                      workflowEditorTheme.textButton,
                      workflowEditorTheme.accentButton,
                      'workflow-editor-right-rail-action silver-glass-chip px-2.5 py-1 text-[11px] font-medium transition-colors'
                    )}
                  >
                    Ask Copilot
                  </button>
                </div>
                <div className="space-y-2">
                  {validationResult.warnings.map((warning, index) => (
                    <div
                      key={`warning-${index}`}
                      className={cn(
                        workflowEditorTheme.callout,
                        workflowEditorTheme.calloutWarning,
                        'workflow-editor-right-rail-callout silver-glass-pane smoky-glass-pane flex min-w-0 gap-2 p-2'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-px max-w-[80px] flex-shrink-0 truncate text-[10px] font-medium',
                          workflowEditorTheme.soft
                        )}
                      >
                        {warning.field}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] leading-snug text-[var(--workflow-editor-accent-warning)]">
                          {warning.message}
                        </p>
                        {warning.suggestion && (
                          <p
                            className={cn(
                              'mt-0.5 text-[10px] leading-snug',
                              workflowEditorTheme.soft
                            )}
                          >
                            {warning.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Content - Scrollable */}
          <div className="workflow-editor-right-rail-body flex-1 overflow-hidden bg-transparent">
            <div className="workflow-editor-right-rail-scroll h-full overflow-y-auto scrollbar-thin scrollbar-thumb-black/[0.08] dark:scrollbar-thumb-white/[0.10] scrollbar-track-transparent">
              <div className="space-y-3 px-3 py-3">
                {selectedBlockId && blockType ? (
                  <div className="workflow-editor-block-detail space-y-0">
                    <BlockContent
                      blockId={selectedBlockId}
                      subBlockRows={subBlockRows}
                      isConnecting={false}
                    >
                      {subBlockRows.length > 0 ? (
                        <div className="space-y-3" key={selectedBlockId}>
                          {subBlockRows.map((row, rowIndex) => (
                            <div
                              key={`row-${rowIndex}`}
                              className="workflow-editor-block-detail-row flex min-w-0 gap-3"
                            >
                              {row.map((subBlock: any) => (
                                <div
                                  key={`${selectedBlockId}-${subBlock.id}`}
                                  className={cn(
                                    'min-w-0',
                                    subBlock.layout === 'half' ? 'flex-1' : 'w-full'
                                  )}
                                >
                                  <SubBlock
                                    blockId={selectedBlockId}
                                    config={subBlock}
                                    isConnecting={false}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            workflowEditorTheme.surface,
                            'silver-glass-pane py-10 text-center'
                          )}
                        >
                          <p className={cn('text-[12px] font-logo', workflowEditorTheme.soft)}>
                            No configuration options
                          </p>
                        </div>
                      )}
                    </BlockContent>
                  </div>
                ) : (
                  <div
                    className={cn(
                      workflowEditorTheme.surface,
                      'silver-glass-pane py-10 text-center'
                    )}
                  >
                    <p className={cn('text-[12px] font-logo', workflowEditorTheme.soft)}>
                      Select a block to configure it
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
