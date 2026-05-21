'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow, parseISO, startOfDay, subDays } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Tag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Manual implementations to avoid date-fns export resolution issues
const startOfWeek = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

const startOfMonth = (date: Date): Date => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const isToday = (date: Date): boolean => {
  const today = startOfDay(new Date())
  return startOfDay(date).getTime() === today.getTime()
}

const isYesterday = (date: Date): boolean => {
  const yesterday = startOfDay(subDays(new Date(), 1))
  return startOfDay(date).getTime() === yesterday.getTime()
}

const isThisWeek = (date: Date): boolean => {
  return date >= startOfWeek(new Date())
}

const isThisMonth = (date: Date): boolean => {
  return date >= startOfMonth(new Date())
}

interface TimelineEntry {
  id: string
  versionNumber: number
  semanticVersion: string | null
  changeType: string
  name: string | null
  createdAt: string
  isPinned: boolean
  isLocked: boolean
  tags: string[]
  changeSummary: {
    blocksAdded?: number
    blocksRemoved?: number
    blocksModified?: number
    summary?: string
  } | null
}

interface DateGroup {
  date: string
  entries: TimelineEntry[]
  deployCount: number
  pinnedCount: number
}

interface TimelineStats {
  totalVersions: number
  deployments: number
  pinnedVersions: number
  autoSaves: number
  manualSaves: number
}

interface VersionTimelineProps {
  workflowId: string
  onVersionSelect?: (versionNumber: number) => void
  onRestore?: (versionNumber: number) => void
}

export function VersionTimeline({ workflowId, onVersionSelect, onRestore }: VersionTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([])
  const [stats, setStats] = useState<TimelineStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    fetchTimeline()
  }, [workflowId])

  const fetchTimeline = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/workflows/${workflowId}/versions/timeline?limit=500`)
      const data = await response.json()
      if (data.success) {
        setTimeline(data.data.timeline)
        setDateGroups(data.data.dateGroups)
        setStats(data.data.stats)
        // Expand today's date by default
        const today = new Date().toISOString().split('T')[0]
        setExpandedDates(new Set([today]))
      } else {
        setError(data.error || 'Failed to fetch timeline')
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err)
      setError('Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }

  // Group by zoom level
  const groupedData = useMemo(() => {
    if (zoomLevel === 'day') {
      return dateGroups
    }

    const grouped: Record<string, DateGroup> = {}

    for (const group of dateGroups) {
      const date = parseISO(group.date)
      let key: string

      if (zoomLevel === 'week') {
        // Get week start date
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
      } else {
        // Month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          entries: [],
          deployCount: 0,
          pinnedCount: 0,
        }
      }

      grouped[key].entries.push(...group.entries)
      grouped[key].deployCount += group.deployCount
      grouped[key].pinnedCount += group.pinnedCount
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date))
  }, [dateGroups, zoomLevel])

  const formatDateLabel = (dateStr: string) => {
    if (zoomLevel === 'month') {
      const [year, month] = dateStr.split('-')
      return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy')
    }

    const date = parseISO(dateStr)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    if (isThisWeek(date)) return format(date, 'EEEE')
    if (isThisMonth(date)) return format(date, 'MMMM d')
    return format(date, 'MMMM d, yyyy')
  }

  const toggleDateExpand = (date: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'deploy':
        return <Rocket className="h-4 w-4 text-purple-500" />
      case 'restore':
        return <RotateCcw className="h-4 w-4 text-orange-500" />
      case 'auto_save':
        return <RefreshCw className="h-4 w-4 text-slate-400" />
      case 'create':
        return <Plus className="h-4 w-4 text-green-500" />
      default:
        return <GitBranch className="h-4 w-4 text-blue-500" />
    }
  }

  const getTimelineNodeClass = (entry: TimelineEntry) => {
    if (entry.changeType === 'deploy') {
      return 'bg-purple-500 border-purple-600'
    }
    if (entry.isPinned) {
      return 'bg-amber-500 border-amber-600'
    }
    if (entry.changeType === 'auto_save') {
      return 'bg-zinc-400 dark:bg-white/40 border-zinc-500 dark:border-white/25'
    }
    return 'bg-blue-500 border-blue-600'
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-logo text-zinc-500 dark:text-white/40">Loading timeline...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="p-4 bg-black/[0.04] dark:bg-white/[0.06] rounded-full mb-4">
          <Clock className="h-8 w-8 text-zinc-400 dark:text-white/40" />
        </div>
        <h3 className="text-lg font-semibold font-logo text-zinc-800 dark:text-white mb-2">
          No Version History
        </h3>
        <p className="text-sm font-logo text-zinc-500 dark:text-white/40 max-w-xs">
          Create versions to see them displayed in the timeline.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Header */}
      {stats && (
        <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-logo text-zinc-700 dark:text-white/70">
              Timeline
            </span>
            <div className="flex items-center gap-1">
              {(['day', 'week', 'month'] as const).map((level) => (
                <Button
                  key={level}
                  variant={zoomLevel === level ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setZoomLevel(level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-logo text-zinc-500 dark:text-white/40">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {stats.totalVersions} versions
            </span>
            <span className="flex items-center gap-1">
              <Rocket className="h-3 w-3 text-purple-500" />
              {stats.deployments} deploys
            </span>
            <span className="flex items-center gap-1">
              <Pin className="h-3 w-3 text-amber-500" />
              {stats.pinnedVersions} pinned
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          {groupedData.map((group, groupIdx) => (
            <Collapsible
              key={group.date}
              open={expandedDates.has(group.date)}
              onOpenChange={() => toggleDateExpand(group.date)}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-lg px-2 -mx-2">
                {expandedDates.has(group.date) ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400 dark:text-white/40" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-white/40" />
                )}
                <span className="text-sm font-medium font-logo text-zinc-700 dark:text-white/70">
                  {formatDateLabel(group.date)}
                </span>
                <span className="text-xs font-logo text-zinc-400 dark:text-white/40">
                  {group.entries.length} version{group.entries.length !== 1 ? 's' : ''}
                </span>
                {group.deployCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-purple-500 border-purple-300 text-xs h-5"
                  >
                    <Rocket className="h-3 w-3 mr-1" />
                    {group.deployCount}
                  </Badge>
                )}
                {group.pinnedCount > 0 && (
                  <Badge variant="outline" className="text-amber-500 border-amber-300 text-xs h-5">
                    <Pin className="h-3 w-3 mr-1" />
                    {group.pinnedCount}
                  </Badge>
                )}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="relative ml-4 pl-6 border-l-2 border-black/[0.06] dark:border-white/[0.06]">
                  {group.entries.map((entry, idx) => (
                    <div key={entry.id} className="relative pb-4 last:pb-0">
                      {/* Timeline node */}
                      <div
                        className={`absolute -left-[29px] w-4 h-4 rounded-full border-2 ${getTimelineNodeClass(entry)}`}
                      />

                      {/* Entry content */}
                      <div
                        className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                        onClick={() => onVersionSelect?.(entry.versionNumber)}
                      >
                        <div className="flex items-center gap-2">
                          {getChangeTypeIcon(entry.changeType)}
                          <span className="font-medium text-sm text-zinc-800 dark:text-white">
                            v{entry.versionNumber}
                          </span>
                          {entry.semanticVersion && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {entry.semanticVersion}
                            </Badge>
                          )}
                          {entry.isPinned && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Pin className="h-3 w-3 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Pinned</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        {entry.name && (
                          <p className="text-sm text-zinc-600 dark:text-white/60 mt-1 truncate">
                            {entry.name}
                          </p>
                        )}

                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Tag className="h-3 w-3 text-zinc-400 dark:text-white/40" />
                            {entry.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs h-5">
                                {tag}
                              </Badge>
                            ))}
                            {entry.tags.length > 2 && (
                              <span className="text-xs text-zinc-400 dark:text-white/40">
                                +{entry.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}

                        {entry.changeSummary?.summary && (
                          <p className="text-xs text-zinc-500 dark:text-white/40 mt-1">
                            {entry.changeSummary.summary}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 dark:text-white/40">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(entry.createdAt), 'HH:mm')}
                          <span className="text-zinc-300 dark:text-white/25">|</span>
                          {formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export default VersionTimeline
