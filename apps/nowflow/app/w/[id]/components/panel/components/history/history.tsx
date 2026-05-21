'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle,
  Clock,
  Download,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  Trash2,
  Undo2,
  Upload,
  XCircle,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { PanelEmptyState, PanelHeader } from '../shared'

interface HistoryProps {
  panelWidth: number
}

type FeedbackBanner = {
  type: 'success' | 'error'
  message: string
} | null

export function History({ panelWidth }: HistoryProps) {
  const {
    history,
    undo,
    redo,
    canUndo,
    canRedo,
    revertToHistoryState,
    clearHistory,
    exportHistory,
    importHistory,
  } = useWorkflowStore(
    useShallow((s) => ({
      history: s.history,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      revertToHistoryState: s.revertToHistoryState,
      clearHistory: s.clearHistory,
      exportHistory: s.exportHistory,
      importHistory: s.importHistory,
    }))
  )
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackBanner>(null)

  const isCompact = panelWidth < 400

  const allStates = [...history.past, history.present, ...history.future]
  const currentIndex = history.past.length

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const handleRevertToState = (index: number) => {
    revertToHistoryState(index)
    setSelectedIndex(null)
  }

  const handleClearHistory = () => {
    setClearDialogOpen(true)
  }

  const confirmClearHistory = () => {
    clearHistory()
    setSelectedIndex(null)
    setClearDialogOpen(false)
  }

  const handleExportHistory = () => {
    const historyJson = exportHistory()
    const blob = new Blob([historyJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-history-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportHistory = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const success = importHistory(text)
        if (success) {
          setFeedback({ type: 'success', message: 'History imported successfully!' })
          setSelectedIndex(null)
        } else {
          setFeedback({ type: 'error', message: 'Failed to import history. Invalid format.' })
        }
      } catch (error) {
        setFeedback({ type: 'error', message: 'Failed to import history.' })
        console.error(error)
      }
    }
    input.click()
  }

  const getStateType = (index: number) => {
    if (index < currentIndex) return 'past'
    if (index === currentIndex) return 'current'
    return 'future'
  }

  const getStateColor = (type: string) => {
    switch (type) {
      case 'past':
        return 'text-white/58 bg-white/[0.03] border-white/[0.05]'
      case 'current':
        return 'text-white/84 bg-white/[0.06] border-white/[0.08]'
      case 'future':
        return 'text-white/30 bg-white/[0.02] border-white/[0.04] opacity-60'
      default:
        return 'text-white/58 bg-white/[0.03] border-white/[0.05]'
    }
  }

  const getActionIcon = useCallback((action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('add') || lower.includes('create') || lower.includes('insert')) {
      return <Plus className="h-3 w-3 flex-shrink-0 text-green-600 dark:text-green-400" />
    }
    if (lower.includes('remov') || lower.includes('delet')) {
      return <Trash2 className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
    }
    if (
      lower.includes('updat') ||
      lower.includes('edit') ||
      lower.includes('modif') ||
      lower.includes('config') ||
      lower.includes('set')
    ) {
      return <Settings className="h-3 w-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
    }
    return <Clock className="h-3 w-3 flex-shrink-0" />
  }, [])

  const getTimelineDotStyle = (type: string) => {
    switch (type) {
      case 'past':
        return 'w-2.5 h-2.5 rounded-full bg-white/22 border-2 border-white/10'
      case 'current':
        return 'w-3 h-3 rounded-full bg-white/78 border-2 border-white/16 ring-2 ring-white/8'
      case 'future':
        return 'w-2.5 h-2.5 rounded-full border-2 border-dashed border-white/16'
      default:
        return 'w-2.5 h-2.5 rounded-full bg-white/22'
    }
  }

  const headerActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={undo}
        disabled={!canUndo()}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 rounded-md border-transparent px-2 text-xs text-white/52 hover:bg-white/[0.05] hover:text-white/84"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-3 w-3" />
        {!isCompact && <span className="ml-1">Undo</span>}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={redo}
        disabled={!canRedo()}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 rounded-md border-transparent px-2 text-xs text-white/52 hover:bg-white/[0.05] hover:text-white/84"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-3 w-3" />
        {!isCompact && <span className="ml-1">Redo</span>}
      </Button>
      <div className="mx-0.5 h-4 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportHistory}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 text-white/52 hover:bg-white/[0.05] hover:text-white/84"
        title="Export history"
      >
        <Download className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleImportHistory}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 text-white/52 hover:bg-white/[0.05] hover:text-white/84"
        title="Import history"
      >
        <Upload className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearHistory}
        disabled={allStates.length <= 1}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 text-white/52 hover:bg-red-500/[0.10] hover:text-red-300"
        title="Clear history"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </>
  )

  const secondaryContent = (
    <div className="workflow-editor-panel-submeta flex items-center justify-between gap-3 text-[11px] text-white/40">
      <span>
        {canUndo() && `${history.past.length} undo`}
        {canRedo() && ` • ${history.future.length} redo`}
        {!canUndo() && !canRedo() && 'No history'}
      </span>
      <span className="max-w-[180px] truncate">{history.present.action}</span>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-transparent">
      <PanelHeader
        title="History"
        icon={Clock}
        count={allStates.length}
        accentColor="slate"
        pulseDot={false}
        actions={headerActions}
        secondaryContent={secondaryContent}
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            'mx-4 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200',
            feedback.type === 'success'
              ? 'silver-glass-pane smoky-glass-pane border-transparent bg-green-50/70 text-green-700 dark:bg-green-950/18 dark:text-green-400'
              : 'silver-glass-pane smoky-glass-pane border-transparent bg-red-50/70 text-red-700 dark:bg-red-950/18 dark:text-red-400'
          )}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto hover:opacity-70">
            <XCircle className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* History Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3">
            {allStates.length === 0 ? (
              <PanelEmptyState
                icon={Clock}
                title="No history available"
                description="Make changes to your workflow to see history"
                accentColor="slate"
              />
            ) : (
              <div className="relative">
                {/* Timeline vertical line */}
                <div className="absolute bottom-4 left-[7px] top-4 w-px bg-white/[0.06]" />

                <div className="space-y-1">
                  {allStates.map((state, index) => {
                    const stateType = getStateType(index)
                    const isCurrent = index === currentIndex
                    const timeAgo = formatDistanceToNow(state.timestamp, { addSuffix: true })

                    return (
                      <div key={`${state.timestamp}-${index}`} className="relative flex gap-3">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex items-start pt-3.5 flex-shrink-0">
                          <div className={getTimelineDotStyle(stateType)} />
                        </div>

                        {/* State card */}
                        <div
                          className={cn(
                            'silver-glass-pane smoky-glass-pane group flex-1 cursor-pointer rounded-[10px] border p-3 transition-all duration-200 hover:shadow-[0_16px_30px_rgba(24,24,24,0.08)]',
                            getStateColor(stateType),
                            selectedIndex === index && 'ring-2 ring-primary/50'
                          )}
                          onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getActionIcon(state.action)}
                                <span className="text-xs font-medium">
                                  {isCurrent ? 'Current State' : timeAgo}
                                </span>
                                {isCurrent && (
                                  <span className="silver-glass-chip smoky-glass-chip rounded-full border-transparent px-1.5 py-0.5 text-xs text-white/82">
                                    Active
                                  </span>
                                )}
                              </div>

                              <div className="text-sm font-medium mb-1">{state.action}</div>

                              <div className="text-xs opacity-70">
                                {Object.keys(state.state.blocks).length} blocks •{' '}
                                {state.state.edges.length} connections
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {!isCurrent && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRevertToState(index)
                                  }}
                                  className="h-6 rounded-[4px] px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Revert
                                </Button>
                              )}

                              <div className="text-xs opacity-60">#{index + 1}</div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {selectedIndex === index && (
                            <div className="mt-3 space-y-2 border-t border-white/[0.04] pt-3">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="silver-glass-pane smoky-glass-pane rounded-[6px] border-transparent bg-white/[0.02] p-2 space-y-1">
                                  <div className="font-medium">Blocks</div>
                                  <div className="text-white/40">
                                    {Object.keys(state.state.blocks).length} total
                                  </div>
                                </div>
                                <div className="silver-glass-pane smoky-glass-pane rounded-[6px] border-transparent bg-white/[0.02] p-2 space-y-1">
                                  <div className="font-medium">Connections</div>
                                  <div className="text-white/40">
                                    {state.state.edges.length} total
                                  </div>
                                </div>
                                <div className="silver-glass-pane smoky-glass-pane rounded-[6px] border-transparent bg-white/[0.02] p-2 space-y-1">
                                  <div className="font-medium">Loops</div>
                                  <div className="text-white/40">
                                    {Object.keys(state.state.loops).length} total
                                  </div>
                                </div>
                                <div className="silver-glass-pane smoky-glass-pane rounded-[6px] border-transparent bg-white/[0.02] p-2 space-y-1">
                                  <div className="font-medium">Groups</div>
                                  <div className="text-white/40">
                                    {Object.keys(state.state.groups || {}).length} total
                                  </div>
                                </div>
                              </div>

                              <div className="silver-glass-pane smoky-glass-pane rounded-[6px] border-transparent bg-white/[0.02] p-2 text-xs">
                                <div className="font-medium mb-1">Timestamp</div>
                                <div className="font-mono text-white/40">
                                  {new Date(state.timestamp).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Clear History AlertDialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all history? This cannot be undone. Your current
              workflow state will be preserved, but all undo/redo history will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearHistory}
              className="smoky-glass-chip rounded-[10px] border border-rose-500/[0.18] bg-rose-500/[0.08] text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
            >
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
