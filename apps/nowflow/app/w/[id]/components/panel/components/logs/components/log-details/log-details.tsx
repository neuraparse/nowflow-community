'use client'

import { useState } from 'react'
import { Check, ChevronLeft, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { WorkflowLog } from '@/app/w/logs/stores/types'
import { formatDate } from '@/app/w/logs/utils/format-date'

interface LogDetailsProps {
  log: WorkflowLog
  onBack: () => void
  panelWidth: number
}

export function LogDetails({ log, onBack, panelWidth }: LogDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'border-[rgba(255,139,122,0.24)] bg-[rgba(255,139,122,0.14)] text-[#ffb4a7]'
      case 'warn':
        return 'border-[rgba(249,198,92,0.24)] bg-[rgba(249,198,92,0.14)] text-[#ffd88c]'
      case 'info':
        return 'border-[rgba(116,212,255,0.22)] bg-[rgba(116,212,255,0.12)] text-[#9fe4ff]'
      case 'debug':
        return 'border-[rgba(156,182,255,0.2)] bg-[rgba(156,182,255,0.11)] text-[#c7d6ff]'
      default:
        return 'border-[rgba(156,182,255,0.2)] bg-[rgba(156,182,255,0.11)] text-[#c7d6ff]'
    }
  }

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="workflow-editor-log-detail h-full flex flex-col">
      {/* Header */}
      <div className="workflow-editor-log-detail-header flex-none border-b border-black/[0.04] bg-transparent px-4 py-3 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="workflow-editor-log-detail-action silver-glass-chip smoky-glass-chip h-7 rounded-[4px] border-transparent px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                'workflow-editor-log-entry-chip silver-glass-chip smoky-glass-chip rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                getLevelColor(log.level)
              )}
            >
              {log.level.toUpperCase()}
            </span>
            <span className="workflow-editor-log-entry-meta text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 dark:text-white/40">
              {formatDate(log.createdAt).full}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="workflow-editor-console-section-label text-sm font-medium font-logo text-zinc-800 dark:text-white">
                  Message
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(log.message, 'message')}
                  className="workflow-editor-log-detail-action silver-glass-chip smoky-glass-chip h-7 rounded-[4px] border-transparent px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {copiedField === 'message' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="workflow-editor-log-detail-card silver-glass-pane smoky-glass-pane rounded-[10px] border-transparent bg-black/[0.025] p-3 text-sm dark:bg-white/[0.03]">
                {log.message}
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <h3 className="workflow-editor-console-section-label text-sm font-medium font-logo text-zinc-800 dark:text-white">
                  Details
                </h3>
                <div className="space-y-2">
                  <div className="workflow-editor-log-detail-row silver-glass-pane smoky-glass-pane flex items-center justify-between rounded-[4px] border-transparent bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                    <span className="text-xs text-zinc-400 dark:text-white/40">Level</span>
                    <span className="text-xs font-mono">{log.level}</span>
                  </div>

                  <div className="workflow-editor-log-detail-row silver-glass-pane smoky-glass-pane flex items-center justify-between rounded-[4px] border-transparent bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                    <span className="text-xs text-zinc-400 dark:text-white/40">Timestamp</span>
                    <span className="text-xs font-mono">{formatDate(log.createdAt).full}</span>
                  </div>

                  {log.duration && (
                    <div className="workflow-editor-log-detail-row silver-glass-pane smoky-glass-pane flex items-center justify-between rounded-[4px] border-transparent bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                      <span className="text-xs text-zinc-400 dark:text-white/40">Duration</span>
                      <span className="text-xs font-mono">{log.duration}</span>
                    </div>
                  )}

                  {log.trigger && (
                    <div className="workflow-editor-log-detail-row silver-glass-pane smoky-glass-pane flex items-center justify-between rounded-[4px] border-transparent bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                      <span className="text-xs text-zinc-400 dark:text-white/40">Trigger</span>
                      <span className="text-xs font-mono capitalize">{log.trigger}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Context */}
            {log.context && Object.keys(log.context).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="workflow-editor-console-section-label text-sm font-medium font-logo text-zinc-800 dark:text-white">
                    Context
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(formatJSON(log.context), 'context')}
                    className="workflow-editor-log-detail-action silver-glass-chip smoky-glass-chip h-7 rounded-[4px] border-transparent px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  >
                    {copiedField === 'context' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="workflow-editor-log-detail-card silver-glass-pane smoky-glass-pane rounded-[10px] border-transparent bg-black/[0.025] p-3 dark:bg-white/[0.03]">
                  <pre className="text-xs font-mono text-zinc-800/80 dark:text-white/80 whitespace-pre-wrap overflow-x-auto">
                    {formatJSON(log.context)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw Log Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="workflow-editor-console-section-label text-sm font-medium font-logo text-zinc-800 dark:text-white">
                  Raw Data
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(formatJSON(log), 'raw')}
                  className="workflow-editor-log-detail-action silver-glass-chip smoky-glass-chip h-7 rounded-[4px] border-transparent px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {copiedField === 'raw' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="workflow-editor-log-detail-card silver-glass-pane smoky-glass-pane rounded-[10px] border-transparent bg-black/[0.025] p-3 dark:bg-white/[0.03]">
                <pre className="text-xs font-mono text-zinc-800/80 dark:text-white/80 whitespace-pre-wrap overflow-x-auto">
                  {formatJSON(log)}
                </pre>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
