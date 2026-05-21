'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useFilterStore } from '@/app/w/logs/stores/store'
import { WorkflowLog } from '@/app/w/logs/stores/types'
import { PanelEmptyState, PanelHeader, PanelLoadingSkeleton, PanelSearchBar } from '../shared'
import { LogDetails } from './components/log-details/log-details'
import { LogEntry } from './components/log-entry/log-entry'

interface LogsProps {
  panelWidth: number
}

export function Logs({ panelWidth }: LogsProps) {
  const { activeWorkflowId } = useWorkflowRegistry()
  const { logs, setLogs } = useFilterStore()
  const [selectedLog, setSelectedLog] = useState<WorkflowLog | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  const isCompact = panelWidth < 400

  // Fetch logs from API - OPTIMIZED: Only fetch once when component mounts
  useEffect(() => {
    // Skip if already fetched or if logs already exist
    if (hasFetched || logs.length > 0) return

    const fetchLogs = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch logs with reduced limit for better performance
        const response = await fetch('/api/logs?includeWorkflow=true&limit=200')

        if (!response.ok) {
          throw new Error(`Error fetching logs: ${response.statusText}`)
        }

        const data = await response.json()
        setLogs(data.data || [])
        setHasFetched(true)
      } catch (err) {
        console.error('Failed to fetch logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [setLogs, hasFetched, logs.length])

  const filteredLogs = useMemo(() => {
    if (!activeWorkflowId) return []

    // Start with current workflow logs only
    let workflowLogs = logs.filter((log) => log.workflowId === activeWorkflowId)

    // Apply search filter
    if (searchQuery) {
      workflowLogs = workflowLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.level.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply level filter
    if (levelFilter !== 'all') {
      workflowLogs = workflowLogs.filter((log) => log.level === levelFilter)
    }

    return workflowLogs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [logs, activeWorkflowId, searchQuery, levelFilter])

  const handleLogClick = (log: WorkflowLog) => {
    setSelectedLog(log)
  }

  const handleBackToList = () => {
    setSelectedLog(null)
  }

  const handleRefresh = async () => {
    try {
      setLoading(true)
      setError(null)

      // Reduced limit for better performance
      const response = await fetch('/api/logs?includeWorkflow=true&limit=200')

      if (!response.ok) {
        throw new Error(`Error fetching logs: ${response.statusText}`)
      }

      const data = await response.json()
      setLogs(data.data || [])
      setHasFetched(true)
    } catch (err) {
      console.error('Failed to refresh logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh logs')
    } finally {
      setLoading(false)
    }
  }

  const handleClearLogs = () => {
    if (activeWorkflowId) {
      // Clear logs for current workflow only
      const remainingLogs = logs.filter((log) => log.workflowId !== activeWorkflowId)
      setLogs(remainingLogs)
      setSelectedLog(null)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'border-[rgba(255,139,122,0.2)] bg-[rgba(255,139,122,0.12)] text-[#ffb4a7]'
      case 'warn':
        return 'border-[rgba(249,198,92,0.2)] bg-[rgba(249,198,92,0.12)] text-[#ffd88c]'
      case 'info':
        return 'border-[rgba(116,212,255,0.18)] bg-[rgba(116,212,255,0.1)] text-[#9fe4ff]'
      case 'debug':
        return 'border-[rgba(156,182,255,0.18)] bg-[rgba(156,182,255,0.1)] text-[#c7d6ff]'
      default:
        return 'border-[rgba(156,182,255,0.18)] bg-[rgba(156,182,255,0.1)] text-[#c7d6ff]'
    }
  }

  const uniqueLevels = useMemo(() => {
    const levels = new Set(filteredLogs.map((log) => log.level))
    return Array.from(levels)
  }, [filteredLogs])

  if (selectedLog) {
    return (
      <div className="flex h-full flex-col bg-transparent">
        <LogDetails log={selectedLog} onBack={handleBackToList} panelWidth={panelWidth} />
      </div>
    )
  }

  // Loading skeleton
  if (loading && logs.length === 0) {
    return <PanelLoadingSkeleton showHeader showSearch variant="list" itemCount={5} />
  }

  const levelPills = uniqueLevels.length > 0 && !isCompact && (
    <div className="workflow-editor-observation-filters flex items-center gap-1">
      {uniqueLevels.map((level) => {
        const count = filteredLogs.filter((log) => log.level === level).length
        return (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
            className={cn(
              'workflow-editor-observation-filter silver-glass-chip smoky-glass-chip h-6 rounded-md border-transparent px-2 text-[11px] font-medium transition-colors',
              levelFilter === level
                ? 'bg-white/[0.10] text-white shadow-none'
                : getLevelColor(level)
            )}
            title={`${count} ${level} logs`}
          >
            {level.toUpperCase()} ({count})
          </button>
        )
      })}
    </div>
  )

  const headerActions = (
    <>
      {levelPills}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 text-white/52 transition-colors hover:bg-white/[0.05] hover:text-white/84"
        title="Refresh logs"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      </Button>
      {filteredLogs.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearLogs}
          className="workflow-editor-panel-tool-button silver-glass-chip smoky-glass-chip h-7 w-7 rounded-md border-transparent p-0 text-white/52 transition-colors hover:bg-red-500/[0.10] hover:text-red-300"
          title="Clear all logs"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </>
  )

  const searchAndFilter = (
    <div className="workflow-editor-logs-filterbar flex items-center gap-2">
      <PanelSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search logs..."
        className="flex-1"
      />
      <select
        value={levelFilter}
        onChange={(e) => setLevelFilter(e.target.value)}
        className="workflow-editor-panel-select silver-glass-pane smoky-glass-pane glass-field glass-native-select h-8 rounded-md border-white/[0.05] bg-white/[0.02] px-2 text-[12px] text-white/82"
      >
        <option value="all">All</option>
        {uniqueLevels.map((level) => (
          <option key={level} value={level}>
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="workflow-editor-logs-shell flex h-full flex-col bg-transparent">
      <PanelHeader
        title="Logs"
        icon={ScrollText}
        count={filteredLogs.length}
        accentColor="slate"
        pulseDot={loading}
        actions={headerActions}
        secondaryContent={searchAndFilter}
      />

      {/* Logs Content */}
      <div className="workflow-editor-logs-body flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="workflow-editor-logs-list p-3">
            {error ? (
              <PanelEmptyState
                icon={ScrollText}
                title="Error loading logs"
                description={error}
                accentColor="slate"
                ctaLabel="Retry"
                ctaOnClick={handleRefresh}
                ctaIcon={RefreshCw}
              />
            ) : filteredLogs.length === 0 ? (
              <PanelEmptyState
                icon={ScrollText}
                title="No logs found"
                description={
                  searchQuery || levelFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Run this workflow to see logs'
                }
                accentColor="slate"
              />
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    onClick={() => handleLogClick(log)}
                    getLevelColor={getLevelColor}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
