'use client'

import { useCopilot } from '@/components/copilot/copilot-provider'
import { cn } from '@/lib/utils'
import { WorkflowLog } from '@/app/w/logs/stores/types'
import { formatDate } from '@/app/w/logs/utils/format-date'

interface LogEntryProps {
  log: WorkflowLog
  onClick: () => void
  getLevelColor: (level: string) => string
}

export function LogEntry({ log, onClick, getLevelColor }: LogEntryProps) {
  const { setIsOpen: setCopilotOpen, sendMessage: sendCopilotMessage } = useCopilot()
  const isErrorOrWarn = log.level === 'error' || log.level === 'warn'
  const entryStateClass =
    log.level === 'error'
      ? 'workflow-editor-log-entry--error'
      : log.level === 'warn'
        ? 'workflow-editor-log-entry--warning'
        : log.level === 'info'
          ? 'workflow-editor-log-entry--info'
          : 'workflow-editor-log-entry--debug'

  const truncateMessage = (message: string, maxLength: number = 100) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
  }

  const handleAskCopilot = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent expanding log details

    const contextStr = log.context ? `\nContext:\n${JSON.stringify(log.context, null, 2)}` : ''

    const failedToolCalls = log.metadata?.toolCalls?.filter((t: any) => t.status === 'error') ?? []
    const metaStr =
      failedToolCalls.length > 0
        ? `\nFailed tool calls: ${failedToolCalls.map((t: any) => `${t.name}: ${t.error}`).join(', ')}`
        : ''

    const message = `I have a workflow execution ${log.level}:\n\n**Message**: ${log.message}${contextStr}${metaStr}\n\nCan you help me identify the cause and suggest a fix?`

    setCopilotOpen(true)
    sendCopilotMessage(message)
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'workflow-editor-log-entry silver-glass-pane smoky-glass-pane group cursor-pointer rounded-[18px] border border-black/[0.04] p-3 transition-all duration-200 hover:bg-black/[0.02] hover:shadow-[0_16px_30px_rgba(24,24,24,0.08)] dark:border-white/[0.05] dark:hover:bg-white/[0.02]',
        entryStateClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                'workflow-editor-log-entry-chip silver-glass-chip smoky-glass-chip rounded-[4px] border-transparent px-2 py-0.5 text-xs font-medium',
                getLevelColor(log.level)
              )}
            >
              {log.level.toUpperCase()}
            </span>
            <span className="workflow-editor-log-entry-meta text-xs text-zinc-400 dark:text-white/40 font-medium font-logo">
              {formatDate(log.createdAt).relative}
            </span>
            {log.duration && (
              <span className="workflow-editor-log-entry-chip silver-glass-chip smoky-glass-chip rounded-[4px] border-transparent px-1.5 py-0.5 text-xs font-medium font-logo text-zinc-400 dark:text-white/40">
                T+ {log.duration}
              </span>
            )}
            {log.source && (
              <span className="workflow-editor-log-entry-chip silver-glass-chip smoky-glass-chip rounded-[4px] border-transparent px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-white/60">
                SRC {log.source}
              </span>
            )}
          </div>

          <div className="workflow-editor-log-entry-message text-sm text-zinc-800/90 dark:text-white/90 mb-2 font-medium font-logo">
            {truncateMessage(log.message)}
          </div>

          {/* Additional log details */}
          {(log.context || log.metadata) && (
            <div className="workflow-editor-log-entry-context silver-glass-pane smoky-glass-pane rounded-xl border-transparent bg-black/[0.025] p-2 text-xs text-zinc-500 dark:bg-white/[0.03] dark:text-white/45">
              {log.context && (
                <div className="mb-1">
                  <span className="font-medium">Context:</span> {JSON.stringify(log.context)}
                </div>
              )}
              {log.metadata && (
                <div>
                  <span className="font-medium">Metadata:</span> {JSON.stringify(log.metadata)}
                </div>
              )}
            </div>
          )}

          {log.trigger && (
            <div className="workflow-editor-log-entry-meta text-xs text-zinc-400 dark:text-white/40">
              Trigger: <span className="capitalize">{log.trigger}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5">
          {isErrorOrWarn && (
            <button
              onClick={handleAskCopilot}
              className="workflow-editor-log-entry-ai silver-glass-chip smoky-glass-chip flex items-center gap-1 rounded-[4px] border-transparent bg-violet-50/75 px-2 py-1 text-xs font-medium text-violet-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-violet-100/80 dark:bg-violet-950/22 dark:text-violet-400 dark:hover:bg-violet-900/30"
            >
              Ask Copilot
            </button>
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-4 h-4 text-zinc-400 dark:text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
