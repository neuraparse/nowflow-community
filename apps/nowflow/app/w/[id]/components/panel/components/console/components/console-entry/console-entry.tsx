import { useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Lock,
  Wifi,
  XCircle,
} from 'lucide-react'
import { useCopilot } from '@/components/copilot/copilot-provider'
import {
  ModernCalendarIcon,
  ModernClockIcon,
  ModernErrorIcon,
  ModernSuccessIcon,
  ModernTerminalIcon,
  ModernWarningIcon,
} from '@/components/modern-panel-content-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useExecutionStore } from '@/stores/execution/store'
import { ConsoleEntry as ConsoleEntryType, ErrorCategory } from '@/stores/panel/console/types'
import { getBlock } from '@/blocks'
import { JSONView } from '../json-view/json-view'

// Error category styling configuration
const errorCategoryConfig: Record<
  ErrorCategory,
  {
    icon: React.ElementType
    label: string
    bgClass: string
    borderClass: string
    textClass: string
    badgeBgClass: string
  }
> = {
  validation: {
    icon: AlertTriangle,
    label: 'Validation Error',
    bgClass: 'bg-orange-500/[0.08]',
    borderClass: 'border-orange-400/[0.16]',
    textClass: 'text-orange-200',
    badgeBgClass: 'bg-orange-500/[0.14] text-orange-200',
  },
  network: {
    icon: Wifi,
    label: 'Network Error',
    bgClass: 'bg-violet-500/[0.08]',
    borderClass: 'border-violet-400/[0.16]',
    textClass: 'text-violet-200',
    badgeBgClass: 'bg-violet-500/[0.14] text-violet-200',
  },
  auth: {
    icon: Lock,
    label: 'Authentication Error',
    bgClass: 'bg-yellow-500/[0.08]',
    borderClass: 'border-yellow-400/[0.16]',
    textClass: 'text-yellow-200',
    badgeBgClass: 'bg-yellow-500/[0.14] text-yellow-200',
  },
  api: {
    icon: AlertCircle,
    label: 'API Error',
    bgClass: 'bg-blue-500/[0.08]',
    borderClass: 'border-blue-400/[0.16]',
    textClass: 'text-blue-200',
    badgeBgClass: 'bg-blue-500/[0.14] text-blue-200',
  },
  runtime: {
    icon: XCircle,
    label: 'Runtime Error',
    bgClass: 'bg-red-500/[0.08]',
    borderClass: 'border-red-400/[0.16]',
    textClass: 'text-red-200',
    badgeBgClass: 'bg-red-500/[0.14] text-red-200',
  },
  unknown: {
    icon: AlertCircle,
    label: 'Error',
    bgClass: 'bg-white/[0.04]',
    borderClass: 'border-white/[0.08]',
    textClass: 'text-white/78',
    badgeBgClass: 'bg-white/[0.08] text-white/72',
  },
}

// Container styling for error categories
const errorContainerConfig: Record<ErrorCategory, string> = {
  validation: 'bg-orange-500/[0.06] border-orange-400/[0.14]',
  network: 'bg-violet-500/[0.06] border-violet-400/[0.14]',
  auth: 'bg-yellow-500/[0.06] border-yellow-400/[0.14]',
  api: 'bg-blue-500/[0.06] border-blue-400/[0.14]',
  runtime: 'bg-red-500/[0.06] border-red-400/[0.14]',
  unknown: 'bg-white/[0.03] border-white/[0.05]',
}

interface ConsoleEntryProps {
  entry: ConsoleEntryType
  consoleWidth: number
}

// Maximum character length for a word before it's broken up
const MAX_WORD_LENGTH = 25

const WordWrap = ({ text }: { text: string }) => {
  if (!text) return null

  // Split text into words, keeping spaces and punctuation
  const parts = text.split(/(\s+)/g)

  return (
    <>
      {parts.map((part, index) => {
        // If the part is whitespace or shorter than the max length, render it as is
        if (part.match(/\s+/) || part.length <= MAX_WORD_LENGTH) {
          return <span key={index}>{part}</span>
        }

        // For long words, break them up into chunks
        const chunks = []
        for (let i = 0; i < part.length; i += MAX_WORD_LENGTH) {
          chunks.push(part.substring(i, i + MAX_WORD_LENGTH))
        }

        return (
          <span key={index} className="break-all">
            {chunks.map((chunk, chunkIndex) => (
              <span key={chunkIndex}>{chunk}</span>
            ))}
          </span>
        )
      })}
    </>
  )
}

export function ConsoleEntry({ entry, consoleWidth }: ConsoleEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandAllJson, setExpandAllJson] = useState(false)
  const [copied, setCopied] = useState(false)

  // Get execution metrics for detailed error info
  const { executionMetrics } = useExecutionStore()
  const blockMetrics = entry.blockId ? executionMetrics[entry.blockId] : undefined

  // Copilot integration
  const { setIsOpen: setCopilotOpen, sendMessage: sendCopilotMessage } = useCopilot()

  const handleAskCopilotError = () => {
    if (!entry.error) return
    const blockInfo = entry.blockName
      ? `"${entry.blockName}" block (type: ${entry.blockType || 'unknown'})`
      : 'a block'
    const category = entry.errorMetadata?.category ?? 'unknown'
    const code = entry.errorMetadata?.code ? ` [${entry.errorMetadata.code}]` : ''
    const errType = entry.errorMetadata?.type ? `\nError Type: ${entry.errorMetadata.type}` : ''
    const message = `I have a ${category} execution error in the ${blockInfo}:\n\n**Error**${code}: ${entry.error}${errType}\n\nCan you help me understand what caused this and how to fix it?`
    setCopilotOpen(true)
    sendCopilotMessage(message)
  }

  const handleAskCopilotWarning = () => {
    if (!entry.warning) return
    const blockInfo = entry.blockName
      ? `"${entry.blockName}" block (type: ${entry.blockType || 'unknown'})`
      : 'a block'
    const message = `I have an execution warning in the ${blockInfo}:\n\n**Warning**: ${entry.warning}\n\nIs this something I should be concerned about? What does it mean?`
    setCopilotOpen(true)
    sendCopilotMessage(message)
  }

  const blockConfig = useMemo(() => {
    if (!entry.blockType) return null
    return getBlock(entry.blockType)
  }, [entry.blockType])

  const BlockIcon = blockConfig?.icon
  const isUtilityBlock = !!blockConfig?.isUtility

  // Copy to clipboard handler
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Export entry as JSON
  const handleExport = () => {
    const exportData = {
      id: entry.id,
      timestamp: entry.timestamp,
      blockName: entry.blockName,
      blockType: entry.blockType,
      blockId: entry.blockId,
      output: entry.output,
      error: entry.error,
      warning: entry.warning,
      durationMs: entry.durationMs,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `console-entry-${entry.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format relative time
  const relativeTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
    } catch {
      return 'just now'
    }
  }, [entry.timestamp])

  const statusIcon = entry.error ? (
    <ModernErrorIcon className="h-4 w-4" />
  ) : entry.warning ? (
    <ModernWarningIcon className="h-4 w-4" />
  ) : (
    <ModernSuccessIcon className="h-4 w-4" />
  )

  // Helper function to check if data has nested objects or arrays
  const hasNestedStructure = (data: any): boolean => {
    if (data === null || typeof data !== 'object') return false

    // Check if it's an empty object or array
    if (Object.keys(data).length === 0) return false

    // For arrays, check if any element is an object
    if (Array.isArray(data)) {
      return data.some((item) => typeof item === 'object' && item !== null)
    }

    // For objects, check if any value is an object
    return Object.values(data).some((value) => typeof value === 'object' && value !== null)
  }

  // Get error category for styling
  const errorCategory = entry.errorMetadata?.category || 'unknown'
  const categoryConfig = errorCategoryConfig[errorCategory]
  const CategoryIcon = categoryConfig.icon
  const entryStateClass = entry.error
    ? 'workflow-editor-console-entry--error'
    : entry.warning
      ? 'workflow-editor-console-entry--warning'
      : isUtilityBlock
        ? 'workflow-editor-console-entry--utility'
        : 'workflow-editor-console-entry--success'

  return (
    <div
      className={cn(
        'workflow-editor-console-entry group overflow-hidden rounded-[10px] border transition-all duration-200',
        entryStateClass,
        !entry.error && !entry.warning
          ? isUtilityBlock
            ? 'silver-glass-pane smoky-glass-pane cursor-pointer border-violet-400/[0.12] bg-violet-500/[0.05] hover:bg-violet-500/[0.08] hover:shadow-[0_16px_30px_rgba(24,24,24,0.08)]'
            : 'silver-glass-pane smoky-glass-pane cursor-pointer border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] hover:shadow-[0_16px_30px_rgba(24,24,24,0.08)]'
          : entry.error
            ? errorContainerConfig[errorCategory]
            : 'bg-yellow-500/[0.06] border-yellow-400/[0.14]'
      )}
      onClick={() => !entry.error && !entry.warning && setIsExpanded(!isExpanded)}
    >
      <div className="workflow-editor-console-entry-inner p-3 space-y-3">
        {/* Header with Actions */}
        <div className="workflow-editor-console-entry-header flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                consoleWidth >= 400 ? 'flex items-center justify-between' : 'grid gap-2 grid-cols-1'
              )}
            >
              {entry.blockName && (
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className={cn(
                      'workflow-editor-console-entry-block flex items-center gap-1.5 px-2 py-1 rounded-lg',
                      isUtilityBlock
                        ? 'silver-glass-chip smoky-glass-chip border border-dashed border-violet-300/35 bg-violet-100/38 dark:border-violet-700/28 dark:bg-violet-900/16'
                        : 'silver-glass-chip smoky-glass-chip border-transparent bg-black/[0.02] dark:bg-white/[0.03]'
                    )}
                  >
                    {BlockIcon ? (
                      <BlockIcon
                        className={cn(
                          'h-3.5 w-3.5',
                          isUtilityBlock
                            ? 'text-violet-500 dark:text-violet-400'
                            : 'text-zinc-400 dark:text-white/40'
                        )}
                      />
                    ) : (
                      <ModernTerminalIcon className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
                    )}
                    <span
                      className={cn(
                        'font-medium',
                        isUtilityBlock
                          ? 'text-violet-700 dark:text-violet-300'
                          : 'text-zinc-400 dark:text-white/40'
                      )}
                    >
                      {entry.blockName}
                    </span>
                    {isUtilityBlock && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-violet-500/70 dark:text-violet-400/70 border border-dashed border-violet-400/40 rounded px-1">
                        helper
                      </span>
                    )}
                  </div>
                  <div className="flex items-center">{statusIcon}</div>
                </div>
              )}
              <div
                className={cn(
                  consoleWidth >= 400 ? 'flex gap-2' : 'grid grid-cols-2 gap-2',
                  'workflow-editor-console-entry-meta text-xs text-white/40'
                )}
              >
                <div
                  className="workflow-editor-console-entry-chip silver-glass-chip smoky-glass-chip flex items-center gap-1.5 rounded-[4px] border-white/[0.05] bg-white/[0.04] px-2 py-1"
                  title={format(new Date(entry.startedAt), 'PPpp')}
                >
                  <ModernCalendarIcon className="h-3.5 w-3.5" />
                  <span className="font-medium">{relativeTime}</span>
                </div>
                <div className="workflow-editor-console-entry-chip silver-glass-chip smoky-glass-chip flex items-center gap-1.5 rounded-[4px] border-white/[0.05] bg-white/[0.04] px-2 py-1">
                  <ModernClockIcon className="h-3.5 w-3.5" />
                  <span className="font-medium">{entry.durationMs}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="workflow-editor-console-entry-actions flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                workflowEditorTheme.iconButton,
                'workflow-editor-console-entry-action h-7 w-7 p-0'
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(entry.error || entry.warning || JSON.stringify(entry.output, null, 2))
              }}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--workflow-editor-accent-success)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                workflowEditorTheme.iconButton,
                'workflow-editor-console-entry-action h-7 w-7 p-0'
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleExport()
              }}
              title="Export entry"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Success/Info Output */}
          {!entry.error && !entry.warning && (
            <div className="space-y-2">
              {/* Output Summary */}
              <div className="workflow-editor-console-section-label flex items-center gap-2 text-xs text-white/40">
                <ModernTerminalIcon className="h-3.5 w-3.5" />
                <span className="font-medium">Output</span>
                {typeof entry.output === 'object' && entry.output !== null && (
                  <span className="workflow-editor-console-entry-chip silver-glass-chip smoky-glass-chip rounded-[4px] border-white/[0.05] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-white/62">
                    {Array.isArray(entry.output) ? `Array (${entry.output.length})` : 'Object'}
                  </span>
                )}
              </div>

              {/* Output Content */}
              <div className="workflow-editor-console-output silver-glass-pane smoky-glass-pane relative rounded-[10px] border-white/[0.05] bg-white/[0.03] p-3">
                {typeof entry.output === 'object' &&
                  entry.output !== null &&
                  hasNestedStructure(entry.output) && (
                    <div className="absolute right-2 top-2 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          workflowEditorTheme.button,
                          'workflow-editor-console-entry-action silver-glass-chip smoky-glass-chip h-7 rounded-[4px] px-2 text-white/56 hover:text-white'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandAllJson(!expandAllJson)
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {expandAllJson ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              <span className="text-xs font-medium">Collapse</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              <span className="text-xs font-medium">Expand All</span>
                            </>
                          )}
                        </span>
                      </Button>
                    </div>
                  )}

                {/* Enhanced Output Display */}
                <div className="text-sm font-mono break-normal whitespace-normal overflow-wrap-anywhere">
                  {typeof entry.output === 'string' ? (
                    <div className="text-[var(--workflow-editor-accent-success)]">
                      <span className="text-white/38">"</span>
                      {entry.output}
                      <span className="text-white/38">"</span>
                    </div>
                  ) : typeof entry.output === 'number' ? (
                    <span className="text-white/68">{entry.output}</span>
                  ) : typeof entry.output === 'boolean' ? (
                    <span className="text-[var(--workflow-editor-accent-violet)]">
                      {entry.output.toString()}
                    </span>
                  ) : entry.output === null ? (
                    <span className="italic text-white/40">null</span>
                  ) : (
                    <JSONView data={entry.output} initiallyExpanded={expandAllJson} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {entry.error && (
            <div className="space-y-2">
              <div
                className={cn(
                  'flex items-center gap-2 text-xs',
                  categoryConfig.textClass
                    .replace('text-', 'text-')
                    .replace('dark:text-', 'dark:text-')
                )}
              >
                <CategoryIcon className="h-3.5 w-3.5" />
                <span className="font-medium">{categoryConfig.label}</span>
                {entry.errorMetadata?.code && (
                  <span
                    className={cn(
                      'workflow-editor-console-entry-chip px-2 py-0.5 rounded-[4px] text-xs font-medium',
                      categoryConfig.badgeBgClass
                    )}
                  >
                    {entry.errorMetadata.code}
                  </span>
                )}
                {!entry.errorMetadata?.code && (
                  <span
                    className={cn(
                      'workflow-editor-console-entry-chip px-2 py-0.5 rounded-[4px] text-xs font-medium',
                      categoryConfig.badgeBgClass
                    )}
                  >
                    Execution Failed
                  </span>
                )}
              </div>

              <div
                className={cn(
                  'workflow-editor-console-error p-3 rounded-lg border border-transparent',
                  categoryConfig.bgClass,
                  categoryConfig.textClass
                )}
              >
                <div
                  className={cn(
                    'text-sm font-mono break-words whitespace-pre-wrap',
                    categoryConfig.textClass
                  )}
                >
                  <WordWrap text={entry.error} />
                </div>

                {/* Error Details */}
                <div className="mt-2 border-t border-white/[0.06] pt-2">
                  <div className={cn('text-xs opacity-80', categoryConfig.textClass)}>
                    <span className="font-medium">Block:</span> {entry.blockName || 'Unknown'}
                    {entry.blockType && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Type:</span> {entry.blockType}
                      </>
                    )}
                    {entry.errorMetadata?.type && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Error Type:</span> {entry.errorMetadata.type}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleAskCopilotError}
                className="workflow-editor-console-ai silver-glass-chip smoky-glass-chip flex items-center gap-1.5 rounded-[4px] border-white/[0.05] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--workflow-editor-accent-violet)] transition-colors hover:bg-[var(--workflow-editor-accent-violet-bg)] hover:text-violet-200"
              >
                Ask Copilot
              </button>
            </div>
          )}

          {/* Warning Display */}
          {entry.warning && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--workflow-editor-accent-warning)]">
                <ModernWarningIcon className="h-3.5 w-3.5" />
                <span className="font-medium">Warning</span>
                <span className="workflow-editor-console-entry-chip rounded-[4px] bg-yellow-500/[0.14] px-2 py-0.5 text-xs font-medium text-yellow-200">
                  Attention Required
                </span>
              </div>

              <div className="workflow-editor-console-warning rounded-lg border border-yellow-400/[0.16] bg-yellow-500/[0.08] p-3">
                <div className="text-sm font-mono text-yellow-200 break-words whitespace-pre-wrap">
                  <WordWrap text={entry.warning} />
                </div>

                {/* Warning Details */}
                <div className="mt-2 border-t border-white/[0.06] pt-2">
                  <div className="text-xs text-yellow-200/78">
                    <span className="font-medium">Block:</span> {entry.blockName || 'Unknown'}
                    {entry.blockType && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Type:</span> {entry.blockType}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleAskCopilotWarning}
                className="workflow-editor-console-ai silver-glass-chip smoky-glass-chip flex items-center gap-1.5 rounded-[4px] border-white/[0.05] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--workflow-editor-accent-warning)] transition-colors hover:bg-[var(--workflow-editor-accent-warning-bg)] hover:text-yellow-200"
              >
                Ask Copilot
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
