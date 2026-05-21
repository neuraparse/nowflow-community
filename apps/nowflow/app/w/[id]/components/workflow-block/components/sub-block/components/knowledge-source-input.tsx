'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Database, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface KnowledgeSource {
  id: string
  name: string
  icon?: string
  documentCount?: number
  totalChunks?: number
}

interface KnowledgeSourceInputProps {
  blockId: string
  subBlockId: string
}

export function KnowledgeSourceInput({ blockId, subBlockId }: KnowledgeSourceInputProps) {
  const workflowId = useWorkflowRegistry((state) => state.activeWorkflowId) || undefined
  const activeWorkspaceId = useWorkflowRegistry((state) => state.activeWorkspaceId)
  const [value, setValue] = useSubBlockValue<string>(blockId, subBlockId)
  const [open, setOpen] = useState(false)
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true) // Start true so we don't flash "hidden"
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const syncInFlight = useRef(false)
  const lastSyncedRef = useRef<string>('')

  // Parse selected source IDs from comma-separated string
  const selectedIds = value
    ? value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : []
  const selectedSources = selectedIds
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is KnowledgeSource => !!source)

  const selectedLabel =
    selectedSources.length > 0
      ? selectedSources.length <= 2
        ? selectedSources.map((source) => source.name).join(', ')
        : `${selectedSources[0].name}, ${selectedSources[1].name} +${selectedSources.length - 2}`
      : ''

  // Fetch knowledge sources eagerly on mount to determine visibility
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const params = new URLSearchParams()
        if (activeWorkspaceId) {
          params.set('workspaceId', activeWorkspaceId)
        }
        params.set('withStats', 'true')
        const res = await fetch(
          `/api/knowledge/sources${params.toString() ? `?${params.toString()}` : ''}`
        )
        if (res.ok) {
          const data = await res.json()
          setSources(data.sources || [])
        }
      } catch (error) {
        console.error('Failed to fetch knowledge sources:', error)
      } finally {
        setLoading(false)
        setInitialFetchDone(true)
      }
    }

    fetchSources()
  }, [activeWorkspaceId])

  // Re-fetch when popover opens (to catch newly added sources)
  useEffect(() => {
    if (open && initialFetchDone) {
      const refetch = async () => {
        try {
          const params = new URLSearchParams()
          if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId)
          params.set('withStats', 'true')
          const res = await fetch(
            `/api/knowledge/sources${params.toString() ? `?${params.toString()}` : ''}`
          )
          if (res.ok) {
            const data = await res.json()
            setSources(data.sources || [])
          }
        } catch {}
      }
      refetch()
    }
  }, [open])

  // Sync agent-knowledge links to backend
  useEffect(() => {
    if (!workflowId) return
    const nextValue = selectedIds.join(',')
    if (lastSyncedRef.current === nextValue) return
    if (syncInFlight.current) return

    const syncAgentSources = async () => {
      syncInFlight.current = true
      try {
        await fetch('/api/knowledge/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setAgentSources',
            agentId: blockId,
            workflowId,
            sourceIds: selectedIds,
            workspaceId: activeWorkspaceId,
          }),
        })
        lastSyncedRef.current = nextValue
      } catch (error) {
        console.error('Failed to sync agent knowledge sources:', error)
      } finally {
        syncInFlight.current = false
      }
    }

    syncAgentSources()
  }, [blockId, workflowId, selectedIds])

  const toggleSource = (sourceId: string) => {
    const newIds = selectedIds.includes(sourceId)
      ? selectedIds.filter((id) => id !== sourceId)
      : [...selectedIds, sourceId]
    setValue(newIds.join(','))
  }

  const removeSource = (sourceId: string) => {
    const newIds = selectedIds.filter((id) => id !== sourceId)
    setValue(newIds.join(','))
  }

  const getSourceById = (id: string) => sources.find((s) => s.id === id)

  // Hide entirely when no knowledge sources exist and nothing is selected
  if (initialFetchDone && sources.length === 0 && selectedIds.length === 0) {
    return null
  }

  // Still loading — don't flash
  if (loading && sources.length === 0 && selectedIds.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 pt-1" data-subblock-id={subBlockId}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Knowledge Sources</label>
        <span className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5 rounded-full bg-muted/20 border border-border/20">
          Optional
        </span>
      </div>

      <div className="w-full space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                'w-full justify-between h-auto min-h-9 py-2 text-[13px]',
                'border-border/50 bg-background/50',
                'hover:border-border hover:bg-background/80',
                'transition-all duration-200'
              )}
            >
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <Database className="h-3.5 w-3.5" />
                {selectedIds.length > 0 ? (
                  <span className="text-foreground">
                    {selectedLabel ||
                      `${selectedIds.length} source${selectedIds.length > 1 ? 's' : ''} selected`}
                  </span>
                ) : (
                  'Select knowledge sources...'
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search sources..." />
              <CommandList>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No knowledge sources found.</CommandEmpty>
                    <CommandGroup heading="Available Sources">
                      {sources.map((source) => (
                        <CommandItem
                          key={source.id}
                          value={source.name}
                          onSelect={() => toggleSource(source.id)}
                        >
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                              selectedIds.includes(source.id)
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50 [&_svg]:invisible'
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-[13px]">{source.name}</div>
                            <div className="text-[11px] text-muted-foreground/60">
                              {source.documentCount || 0} docs | {source.totalChunks || 0} chunks
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selected sources badges */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedIds.map((id) => {
              const source = getSourceById(id)
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1 text-[11px]"
                >
                  <Database className="h-2.5 w-2.5" />
                  <span className="max-w-[100px] truncate">
                    {source?.name || id.substring(0, 8)}
                  </span>
                  <button
                    onClick={() => removeSource(id)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
