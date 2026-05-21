'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ModernAlertIcon,
  ModernClockIcon,
  ModernDurationIcon,
  ModernIdIcon,
  ModernInfoIcon,
  ModernLoaderIcon,
  ModernMessageIcon,
  ModernStatusIcon,
  ModernTriggerIcon,
  ModernWorkflowIcon,
} from '@/components/modern-logs-icons'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'
import { ControlBar } from './components/control-bar/control-bar'
import { Filters } from './components/filters/filters'
import { Sidebar } from './components/sidebar/sidebar'
import { useFilterStore } from './stores/store'
import { LogsResponse, WorkflowLog } from './stores/types'
import { formatDate } from './utils/format-date'

const logger = createLogger('Logs')

// Helper function to get level badge styling
const getLevelBadgeStyles = (level: string) => {
  switch (level.toLowerCase()) {
    case 'error':
      return 'bg-destructive/10 text-destructive border border-destructive/20 shadow-sm'
    case 'warn':
      return 'bg-warning/10 text-warning border border-warning/20 shadow-sm'
    default:
      return 'bg-secondary/50 text-secondary-foreground border border-secondary/20 shadow-sm'
  }
}

// Helper function to get trigger badge styling
const getTriggerBadgeStyles = (trigger: string) => {
  switch (trigger.toLowerCase()) {
    case 'manual':
      return 'bg-secondary/50 text-secondary-foreground border border-secondary/20 shadow-sm'
    case 'api':
      return 'bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30 shadow-sm'
    case 'webhook':
      return 'bg-orange-100/80 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/30 shadow-sm'
    case 'schedule':
      return 'bg-green-100/80 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/30 shadow-sm'
    case 'chat':
      return 'bg-purple-100/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 shadow-sm'
    default:
      return 'bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/30 shadow-sm'
  }
}

// Add a new CSS class for the selected row animation
const selectedRowAnimation = `
  @keyframes borderPulse {
    0% { border-left-color: hsl(var(--primary) / 0.3); }
    50% { border-left-color: hsl(var(--primary) / 0.7); }
    100% { border-left-color: hsl(var(--primary) / 0.5); }
  }

  @keyframes shadowPulse {
    0% { box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1); }
    50% { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2); }
    100% { box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1); }
  }

  .selected-row {
    animation: borderPulse 1.5s ease-in-out infinite, shadowPulse 1.5s ease-in-out infinite;
    border-left-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .log-row {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 1;
  }

  .log-row:hover {
    transform: scale(1.005);
    z-index: 2;
  }

  .log-row:active {
    transform: scale(0.995);
  }
`

export default function Logs() {
  const { filteredLogs, loading, error, setLogs, setLoading, setError } = useFilterStore()
  const [selectedLog, setSelectedLog] = useState<WorkflowLog | null>(null)
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)
  const { mode, isExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  // We don't need execution groups anymore as we've simplified the UI

  // Handle log click
  const handleLogClick = (log: WorkflowLog) => {
    setSelectedLog(log)
    // Find the index of the clicked log in the filtered logs array
    const index = filteredLogs.findIndex((l) => l.id === log.id)
    setSelectedLogIndex(index)
    setIsSidebarOpen(true)
  }

  // Navigate to the next log
  const handleNavigateNext = () => {
    if (selectedLogIndex < filteredLogs.length - 1) {
      const nextIndex = selectedLogIndex + 1
      setSelectedLogIndex(nextIndex)
      setSelectedLog(filteredLogs[nextIndex])
    }
  }

  // Navigate to the previous log
  const handleNavigatePrev = () => {
    if (selectedLogIndex > 0) {
      const prevIndex = selectedLogIndex - 1
      setSelectedLogIndex(prevIndex)
      setSelectedLog(filteredLogs[prevIndex])
    }
  }

  // Close sidebar
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
  }

  // Scroll selected log into view when it changes
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedLogIndex])

  // Fetch logs on component mount
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        // Include workflow data in the response
        const response = await fetch('/api/logs?includeWorkflow=true')

        if (!response.ok) {
          throw new Error(`Error fetching logs: ${response.statusText}`)
        }

        const data: LogsResponse = await response.json()

        setLogs(data.data)
        setError(null)
      } catch (err) {
        logger.error('Failed to fetch logs:', { err })
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [setLogs, setLoading, setError])

  // Add keyboard navigation for the logs table
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard navigation if we have logs and a log is selected
      if (filteredLogs.length === 0) return

      // If no log is selected yet, select the first one on arrow key press
      if (selectedLogIndex === -1 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setSelectedLogIndex(0)
        setSelectedLog(filteredLogs[0])
        return
      }

      // Up arrow key for previous log
      if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey && selectedLogIndex > 0) {
        e.preventDefault()
        handleNavigatePrev()
      }

      // Down arrow key for next log
      if (
        e.key === 'ArrowDown' &&
        !e.metaKey &&
        !e.ctrlKey &&
        selectedLogIndex < filteredLogs.length - 1
      ) {
        e.preventDefault()
        handleNavigateNext()
      }

      // Enter key to open/close sidebar
      if (e.key === 'Enter' && selectedLog) {
        e.preventDefault()
        setIsSidebarOpen(!isSidebarOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    filteredLogs,
    selectedLogIndex,
    isSidebarOpen,
    selectedLog,
    handleNavigateNext,
    handleNavigatePrev,
    setIsSidebarOpen,
  ])

  return (
    <div
      className={`flex flex-col h-[100dvh] w-full overflow-hidden transition-all duration-300 ${
        isSidebarCollapsed ? 'pl-16' : 'pl-64'
      }`}
    >
      {/* Add the animation styles */}
      <style jsx global>
        {selectedRowAnimation}
      </style>

      <ControlBar />
      <div className="flex flex-col flex-1 overflow-hidden w-full">
        <div className="flex w-full">
          <Filters />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden relative w-full">
          {/* Table container */}
          <div className="silver-glass-panel flex-1 flex flex-col overflow-hidden rounded-tl-[16px] shadow-sm border-t border-black/[0.06] dark:border-white/[0.06] mt-1 w-full bg-transparent">
            {/* Table header - fixed */}
            <div className="silver-glass-pane border-b z-10 sticky top-0 shadow-sm rounded-tl-[14px] bg-transparent">
              <div className="flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                <h2 className="text-sm font-medium font-logo text-zinc-800 dark:text-white flex items-center gap-1 sm:gap-2 mb-1 sm:mb-0">
                  <span className="bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-md">
                    <ModernWorkflowIcon className="h-3 w-3 sm:h-4 sm:w-4 text-zinc-800 dark:text-white" />
                  </span>
                  <span className="whitespace-nowrap">Workflow Logs</span>
                </h2>
                <div className="text-xs font-logo text-zinc-400 dark:text-white/40 bg-zinc-100/50 dark:bg-white/[0.04] px-2 py-0.5 rounded-md">
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                </div>
              </div>
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[22%] xs:w-[20%] sm:w-[18%] md:w-[16%] lg:w-[14%]" />
                  <col className="w-[12%] xs:w-[10%] sm:w-[9%] md:w-[8%]" />
                  <col className="w-[18%] xs:w-[16%] sm:w-[14%] md:w-[12%]" />
                  <col className="w-[0%] hidden lg:table-column lg:w-[8%]" />
                  <col className="w-[0%] hidden lg:table-column lg:w-[8%]" />
                  <col className="w-[38%] xs:w-[44%] sm:w-[49%] md:w-[54%] lg:w-[40%]" />
                  <col className="w-[10%] xs:w-[10%] sm:w-[10%] md:w-[10%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernClockIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Time
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernStatusIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Status
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernWorkflowIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Flow
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium hidden lg:table-cell">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernIdIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          ID
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium hidden lg:table-cell">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernTriggerIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Trigger
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernMessageIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Message
                        </span>
                      </div>
                    </th>
                    <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 pt-1 pb-2 text-left font-medium">
                      <div className="flex items-center gap-0.5 xs:gap-1 bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-2 py-0.5 rounded-md shadow-sm border border-black/[0.06] dark:border-white/[0.06] w-fit">
                        <ModernDurationIcon className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5 text-zinc-500 dark:text-white/50" />
                        <span className="text-[8px] xs:text-[10px] sm:text-xs text-zinc-600 dark:text-white/60 leading-none font-medium font-logo">
                          Duration
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Table body - scrollable */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] shadow-sm">
                    <div className="bg-zinc-100 dark:bg-white/[0.06] p-3 rounded-full mb-3">
                      <ModernLoaderIcon className="h-6 w-6 animate-spin text-zinc-800 dark:text-white" />
                    </div>
                    <p className="text-sm text-zinc-400 dark:text-white/40">Loading logs...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center p-6 bg-red-50/50 backdrop-blur-sm rounded-lg border border-red-200/50 shadow-sm max-w-md">
                    <div className="bg-red-100/80 p-3 rounded-full mb-3">
                      <ModernAlertIcon className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-base font-medium text-red-700 mb-1">Error loading logs</p>
                    <p className="text-sm text-red-600/80">{error}</p>
                  </div>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg border border-black/[0.06] dark:border-white/[0.06] shadow-sm">
                    <div className="bg-zinc-100 dark:bg-white/[0.06] p-3 rounded-full mb-3">
                      <ModernInfoIcon className="h-6 w-6 text-zinc-800 dark:text-white" />
                    </div>
                    <p className="text-base font-medium text-zinc-500 dark:text-white/50 mb-1">
                      No logs found
                    </p>
                    <p className="text-sm text-zinc-400 dark:text-white/40">
                      Run a workflow to see logs here
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[22%] xs:w-[20%] sm:w-[18%] md:w-[16%] lg:w-[14%]" />
                    <col className="w-[12%] xs:w-[10%] sm:w-[9%] md:w-[8%]" />
                    <col className="w-[18%] xs:w-[16%] sm:w-[14%] md:w-[12%]" />
                    <col className="w-[0%] hidden lg:table-column lg:w-[8%]" />
                    <col className="w-[0%] hidden lg:table-column lg:w-[8%]" />
                    <col className="w-[38%] xs:w-[44%] sm:w-[49%] md:w-[54%] lg:w-[40%]" />
                    <col className="w-[10%] xs:w-[10%] sm:w-[10%] md:w-[10%]" />
                  </colgroup>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const formattedDate = formatDate(log.createdAt)
                      const isSelected = selectedLog?.id === log.id

                      return (
                        <tr
                          key={log.id}
                          ref={isSelected ? selectedRowRef : null}
                          className={`border-b transition-all duration-300 cursor-pointer log-row ${
                            isSelected
                              ? 'bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:bg-white/[0.06] border-l-2 selected-row backdrop-blur-sm shadow-md'
                              : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:backdrop-blur-sm hover:shadow-sm'
                          }`}
                          onClick={() => handleLogClick(log)}
                        >
                          {/* Time column */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                            <div className="flex flex-col justify-center">
                              <div
                                className={`text-[8px] xs:text-[10px] sm:text-xs font-medium flex items-center ${
                                  isSelected ? 'text-zinc-800 dark:text-white' : ''
                                }`}
                              >
                                <span className="bg-zinc-50 dark:bg-white/[0.03] px-0.5 xs:px-1 sm:px-1.5 py-0.5 rounded-md border border-primary/10 truncate max-w-[60px] xs:max-w-[80px] sm:max-w-full">
                                  {formattedDate.formatted}
                                </span>
                                <span className="mx-0.5 xs:mx-1 sm:mx-1.5 text-zinc-400 dark:text-white/40 hidden md:inline">
                                  •
                                </span>
                                <span className="text-[8px] xs:text-[9px] sm:text-xs text-zinc-400 dark:text-white/40 hidden md:inline">
                                  {new Date(log.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              <div className="text-[8px] xs:text-[9px] sm:text-xs text-zinc-400 dark:text-white/40 mt-0.5 xs:mt-1 sm:mt-1.5 flex items-center">
                                <ModernClockIcon className="h-1.5 w-1.5 xs:h-2 xs:w-2 sm:h-2.5 sm:w-2.5 mr-0.5 text-zinc-400 dark:text-white/40/70" />
                                <span className="bg-zinc-100/50 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-1.5 py-0.5 rounded-md truncate max-w-[60px] xs:max-w-[80px] sm:max-w-full">
                                  {formattedDate.relative}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Level column */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                            <div
                              className={`inline-flex items-center justify-center px-1 xs:px-1.5 sm:px-2 py-0.5 text-[8px] xs:text-[10px] sm:text-xs rounded-md ${getLevelBadgeStyles(log.level)} transition-all duration-200`}
                            >
                              <span className="font-medium">{log.level}</span>
                            </div>
                          </td>

                          {/* Workflow column */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                            {log.workflow && (
                              <div
                                className="inline-flex items-center px-1 xs:px-1.5 sm:px-2 py-0.5 text-[8px] xs:text-[10px] sm:text-xs rounded-md truncate max-w-full transition-all duration-200 shadow-sm border"
                                style={{
                                  backgroundColor: `${log.workflow.color}10`,
                                  color: log.workflow.color,
                                  borderColor: `${log.workflow.color}30`,
                                }}
                                title={log.workflow.name}
                              >
                                <span className="font-medium truncate">{log.workflow.name}</span>
                              </div>
                            )}
                          </td>

                          {/* ID column - hidden on small screens */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 hidden lg:table-cell">
                            <div className="text-[8px] xs:text-[10px] sm:text-xs font-mono text-zinc-400 dark:text-white/40 bg-zinc-100/60 dark:bg-white/[0.04] px-0.5 xs:px-1 sm:px-1.5 py-0.5 rounded inline-block">
                              {log.executionId ? `#${log.executionId.substring(0, 4)}` : '—'}
                            </div>
                          </td>

                          {/* Trigger column - hidden on medium screens and below */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 hidden lg:table-cell">
                            {log.trigger && (
                              <div
                                className={`inline-flex items-center px-1 xs:px-1.5 sm:px-2 py-0.5 text-[8px] xs:text-[10px] sm:text-xs rounded-md ${getTriggerBadgeStyles(log.trigger)} transition-all duration-200`}
                              >
                                <span className="font-medium">{log.trigger}</span>
                              </div>
                            )}
                          </td>

                          {/* Message column */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                            <div
                              className={`text-[8px] xs:text-[10px] sm:text-xs md:text-sm truncate transition-all duration-200 ${
                                isSelected
                                  ? 'text-zinc-800 dark:text-white font-medium'
                                  : 'hover:text-zinc-800 dark:text-white/90'
                              }`}
                              title={log.message}
                            >
                              {log.message}
                            </div>
                          </td>

                          {/* Duration column */}
                          <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                            <div
                              className={`text-[8px] xs:text-[10px] sm:text-xs px-0.5 xs:px-1 sm:px-1.5 py-0.5 rounded inline-block ${
                                isSelected
                                  ? 'text-zinc-800 dark:text-white bg-foreground/5'
                                  : 'text-zinc-400 dark:text-white/40 bg-zinc-100/60 dark:bg-white/[0.04]'
                              }`}
                            >
                              {log.duration || '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Sidebar */}
      <div className="relative z-20">
        <Sidebar
          log={selectedLog}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
          onNavigateNext={handleNavigateNext}
          onNavigatePrev={handleNavigatePrev}
          hasNext={selectedLogIndex < filteredLogs.length - 1}
          hasPrev={selectedLogIndex > 0}
        />
      </div>
    </div>
  )
}
