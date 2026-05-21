'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  ModernAlertIcon,
  ModernClockIcon,
  ModernDurationIcon,
  ModernInfoIcon,
  ModernLoaderIcon,
  ModernLogsIcon,
  ModernMessageIcon,
  ModernStatusIcon,
  ModernTriggerIcon,
  ModernWorkflowIcon,
} from '@/components/modern-logs-icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createLogger } from '@/lib/logs/console-logger'
import { ControlBar } from '@/app/w/logs/components/control-bar/control-bar'
import { Filters } from '@/app/w/logs/components/filters/filters'
import { Sidebar } from '@/app/w/logs/components/sidebar/sidebar'
import { useFilterStore } from '@/app/w/logs/stores/store'
import { WorkflowLog } from '@/app/w/logs/stores/types'
import { formatDate } from '@/app/w/logs/utils/format-date'

const logger = createLogger('LogsModal')

// CSS for selected row animation
const selectedRowAnimation = `
  @keyframes pulse {
    0% {
      background-color: rgba(var(--primary-rgb), 0.05);
    }
    50% {
      background-color: rgba(var(--primary-rgb), 0.1);
    }
    100% {
      background-color: rgba(var(--primary-rgb), 0.05);
    }
  }
  .selected-row {
    animation: pulse 2s infinite;
  }
`

interface LogsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogsModal({ open, onOpenChange }: LogsModalProps) {
  const { filteredLogs, loading, error, setLogs, setLoading, setError } = useFilterStore()
  const [selectedLog, setSelectedLog] = useState<WorkflowLog | null>(null)
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)

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

  // Close the sidebar
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    setSelectedLog(null)
    setSelectedLogIndex(-1)
  }

  // Fetch logs when modal opens
  useEffect(() => {
    if (open) {
      const fetchLogs = async () => {
        try {
          setLoading(true)
          // Include workflow data in the response
          const response = await fetch('/api/logs?includeWorkflow=true')

          if (!response.ok) {
            throw new Error(`Error fetching logs: ${response.statusText}`)
          }

          const data = await response.json()
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
    }
  }, [open, setLogs, setLoading, setError])

  // Scroll to selected row when selectedLogIndex changes
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [selectedLogIndex])

  // Format log level for display
  const formatLevel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return (
          <span className="px-1.5 py-0.5 bg-red-500/[0.08] dark:bg-red-400/[0.10] text-red-600/80 dark:text-red-400/80 rounded-md text-[10px] font-logo font-semibold">
            ERROR
          </span>
        )
      case 'warn':
        return (
          <span className="px-1.5 py-0.5 bg-yellow-500/[0.08] dark:bg-yellow-400/[0.10] text-yellow-600/80 dark:text-yellow-400/80 rounded-md text-[10px] font-logo font-semibold">
            WARN
          </span>
        )
      case 'info':
        return (
          <span className="px-1.5 py-0.5 bg-blue-500/[0.08] dark:bg-blue-400/[0.10] text-blue-600/80 dark:text-blue-400/80 rounded-md text-[10px] font-logo font-semibold">
            INFO
          </span>
        )
      case 'debug':
        return (
          <span className="px-1.5 py-0.5 bg-purple-500/[0.08] dark:bg-purple-400/[0.10] text-purple-600/80 dark:text-purple-400/80 rounded-md text-[10px] font-logo font-semibold">
            DEBUG
          </span>
        )
      default:
        return (
          <span className="px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] text-black/50 dark:text-white/55 rounded-md text-[10px] font-logo font-semibold">
            {level.toUpperCase()}
          </span>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden rounded-[16px]"
        hideCloseButton
      >
        {/* Add the animation styles */}
        <style jsx global>
          {selectedRowAnimation}
        </style>

        <div className="flex flex-col h-full w-full overflow-hidden relative">
          {/* Header with close button */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06]">
            <DialogTitle className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10]">
                <ModernLogsIcon className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
              </div>
              <span className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                Logs
              </span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 text-black/50 dark:text-white/60" strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <ControlBar />
          <div className="flex flex-col flex-1 overflow-hidden w-full">
            <div className="flex w-full">
              <Filters />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden relative w-full">
              {/* Table container */}
              <div className="flex-1 flex flex-col overflow-hidden bg-black/[0.01] dark:bg-white/[0.01] backdrop-blur-[2px] rounded-tl-lg shadow-sm border-t border-black/[0.06] dark:border-white/[0.06] mt-1 w-full">
                {/* Table header - fixed */}
                <div className="silver-glass-pane border-b border-black/[0.06] dark:border-white/[0.06] bg-transparent z-10 sticky top-0 shadow-sm rounded-tl-[14px]">
                  <div className="flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <h2 className="text-[13px] font-logo font-medium text-black/70 dark:text-white/75 flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-0">
                      <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1 rounded-md">
                        <ModernLogsIcon className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
                      </span>
                      <span>Execution Logs</span>
                    </h2>
                  </div>
                </div>

                {/* Table body - scrollable */}
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center">
                        <div className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-3 rounded-full mb-3">
                          <ModernLoaderIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6] animate-spin" />
                        </div>
                        <p className="text-[13px] font-logo font-medium text-black/70 dark:text-white/75 mb-1">
                          Loading logs
                        </p>
                        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                          Please wait...
                        </p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center p-6 bg-red-500/[0.04] dark:bg-red-400/[0.06] rounded-xl border border-red-500/[0.12] dark:border-red-400/[0.10] shadow-sm">
                        <div className="bg-red-500/[0.08] dark:bg-red-400/[0.10] p-3 rounded-full mb-3">
                          <ModernAlertIcon className="h-6 w-6 text-red-600/80 dark:text-red-400/90" />
                        </div>
                        <p className="text-[13px] font-logo font-medium text-red-600/80 dark:text-red-400/90 mb-1">
                          Error loading logs
                        </p>
                        <p className="text-[12px] font-logo text-red-600/60 dark:text-red-400/60">
                          {error}
                        </p>
                      </div>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center p-6 bg-black/[0.01] dark:bg-white/[0.02] backdrop-blur-sm rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-sm">
                        <div className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-3 rounded-full mb-3">
                          <ModernInfoIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
                        </div>
                        <p className="text-[13px] font-logo font-medium text-black/70 dark:text-white/75 mb-1">
                          No logs found
                        </p>
                        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40">
                          Run a workflow to see logs here
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-full w-full">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '47%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead className="silver-glass-pane bg-transparent sticky top-0 z-10">
                          <tr>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernClockIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Timestamp</span>
                              </div>
                            </th>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernStatusIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Level</span>
                              </div>
                            </th>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernWorkflowIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Workflow</span>
                              </div>
                            </th>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernTriggerIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Trigger</span>
                              </div>
                            </th>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernMessageIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Message</span>
                              </div>
                            </th>
                            <th className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-2 text-left text-[10px] xs:text-xs font-semibold text-zinc-400 dark:text-white/40 font-logo">
                              <div className="flex items-center gap-1">
                                <ModernDurationIcon className="h-3 w-3 text-zinc-400 dark:text-white/40 font-logo" />
                                <span className="hidden xs:inline">Duration</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map((log, index) => {
                            const isSelected = selectedLogIndex === index
                            return (
                              <tr
                                key={log.id}
                                ref={isSelected ? selectedRowRef : null}
                                className={`cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors ${
                                  isSelected
                                    ? 'bg-[#4A7A68]/[0.04] dark:bg-[#94B8A6]/[0.04] selected-row'
                                    : ''
                                }`}
                                onClick={() => handleLogClick(log)}
                              >
                                {/* Timestamp column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 text-[10px] xs:text-xs truncate">
                                  {formatDate(log.createdAt).short}
                                </td>

                                {/* Level column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                                  {formatLevel(log.level)}
                                </td>

                                {/* Workflow column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 text-[10px] xs:text-xs truncate">
                                  {log.workflow?.name || (
                                    <span className="text-zinc-400 dark:text-white/40 font-logo italic">
                                      Unknown
                                    </span>
                                  )}
                                </td>

                                {/* Trigger column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 text-[10px] xs:text-xs truncate">
                                  {(log.metadata as any)?.trigger || (
                                    <span className="text-zinc-400 dark:text-white/40 font-logo">
                                      —
                                    </span>
                                  )}
                                </td>

                                {/* Message column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2 text-[10px] xs:text-xs truncate">
                                  {log.message}
                                </td>

                                {/* Duration column */}
                                <td className="px-0.5 xs:px-1 sm:px-2 md:px-3 py-1 xs:py-1.5 sm:py-2">
                                  <div
                                    className={`text-[8px] xs:text-[10px] sm:text-xs font-logo px-0.5 xs:px-1 sm:px-1.5 py-0.5 rounded-md inline-block ${
                                      isSelected
                                        ? 'text-black/70 dark:text-white/75 bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06]'
                                        : 'text-zinc-400 dark:text-white/40 bg-black/[0.03] dark:bg-white/[0.04]'
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
                    </ScrollArea>
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
      </DialogContent>
    </Dialog>
  )
}
