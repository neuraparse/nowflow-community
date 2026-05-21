'use client'

import { useMemo, useState } from 'react'
import { Download, Terminal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { workflowEditorTheme } from '@/lib/workflow-editor-theme'
import { useConsoleStore } from '@/stores/panel/console/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { PanelEmptyState, PanelHeader, PanelSearchBar } from '../shared'
import { ConsoleEntry } from './components/console-entry/console-entry'

interface ConsoleProps {
  panelWidth: number
}

export function Console({ panelWidth }: ConsoleProps) {
  const { entries, clearConsole, searchEntries, exportEntries, getStatistics } = useConsoleStore()
  const { activeWorkflowId } = useWorkflowRegistry()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'warnings' | 'success'>('all')

  const filteredEntries = useMemo(() => {
    let result = entries.filter((entry) => entry.workflowId === activeWorkflowId)

    // Apply search
    if (searchQuery.trim()) {
      result = searchEntries(searchQuery, activeWorkflowId)
    }

    // Apply filters
    if (filterType !== 'all') {
      result = result.filter((entry) => {
        if (filterType === 'errors') return !!entry.error
        if (filterType === 'warnings') return !!entry.warning
        if (filterType === 'success') return !entry.error && !entry.warning
        return true
      })
    }

    return result
  }, [entries, activeWorkflowId, searchQuery, filterType, searchEntries])

  const stats = getStatistics(activeWorkflowId)

  const isCompact = panelWidth < 420

  const handleExportAll = () => {
    const json = exportEntries(activeWorkflowId)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `console-logs-${activeWorkflowId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filterButtonBase =
    'workflow-editor-observation-filter silver-glass-chip smoky-glass-chip h-6 rounded-md border px-2 text-[11px] font-medium transition-colors'

  const filterButtons = (
    <div className="flex items-center gap-1">
      {stats.errors > 0 && (
        <button
          onClick={() => setFilterType(filterType === 'errors' ? 'all' : 'errors')}
          className={`${filterButtonBase} ${
            filterType === 'errors'
              ? 'border-rose-400/[0.18] bg-rose-500/[0.12] text-rose-200'
              : 'border-white/[0.05] bg-white/[0.03] text-rose-300/82 hover:bg-rose-500/[0.08] hover:text-rose-200'
          }`}
        >
          {!isCompact ? `${stats.errors} error${stats.errors !== 1 ? 's' : ''}` : stats.errors}
        </button>
      )}
      {stats.warnings > 0 && (
        <button
          onClick={() => setFilterType(filterType === 'warnings' ? 'all' : 'warnings')}
          className={`${filterButtonBase} ${
            filterType === 'warnings'
              ? 'border-amber-400/[0.18] bg-amber-500/[0.12] text-amber-200'
              : 'border-white/[0.05] bg-white/[0.03] text-amber-300/82 hover:bg-amber-500/[0.08] hover:text-amber-200'
          }`}
        >
          {!isCompact
            ? `${stats.warnings} warning${stats.warnings !== 1 ? 's' : ''}`
            : stats.warnings}
        </button>
      )}
      {stats.success > 0 && (
        <button
          onClick={() => setFilterType(filterType === 'success' ? 'all' : 'success')}
          className={`${filterButtonBase} ${
            filterType === 'success'
              ? 'border-emerald-400/[0.18] bg-emerald-500/[0.12] text-emerald-200'
              : 'border-white/[0.05] bg-white/[0.03] text-emerald-300/82 hover:bg-emerald-500/[0.08] hover:text-emerald-200'
          }`}
        >
          {!isCompact ? `${stats.success} success` : stats.success}
        </button>
      )}
    </div>
  )

  const headerActions = (
    <>
      {filterButtons}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExportAll}
        className={cn(
          workflowEditorTheme.iconButton,
          'workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 transition-colors'
        )}
        title="Export all entries"
      >
        <Download className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => clearConsole(activeWorkflowId)}
        className={cn(
          workflowEditorTheme.iconButton,
          workflowEditorTheme.dangerButton,
          'workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 transition-colors'
        )}
        title="Clear console"
      >
        <X className="h-3 w-3" />
      </Button>
    </>
  )

  return (
    <div className="workflow-editor-console-shell flex h-full flex-col bg-transparent">
      <PanelHeader
        title="Console"
        icon={Terminal}
        count={stats.total}
        accentColor="slate"
        pulseDot={false}
        actions={headerActions}
        secondaryContent={
          <PanelSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search..." />
        }
      />

      {/* Console Content */}
      <div className="workflow-editor-console-body flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="workflow-editor-console-list p-3">
            {filteredEntries.length === 0 ? (
              <PanelEmptyState
                icon={Terminal}
                title="No entries"
                description="Run workflow to see output"
                accentColor="slate"
              />
            ) : (
              <div className="workflow-editor-console-stack space-y-2.5">
                {filteredEntries.map((entry) => (
                  <ConsoleEntry key={entry.id} entry={entry} consoleWidth={panelWidth} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
