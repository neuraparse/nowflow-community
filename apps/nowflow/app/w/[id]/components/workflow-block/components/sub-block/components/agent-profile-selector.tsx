'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, User, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProfilesStore } from '@/stores/agent-profiles/store'

interface AgentProfileSelectorProps {
  blockId: string
  subBlockId: string
  value: string
  onChange: (value: string) => void
}

export function AgentProfileSelector({
  blockId,
  subBlockId,
  value,
  onChange,
}: AgentProfileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const profiles = useAgentProfilesStore((s) => s.profiles)
  const isLoading = useAgentProfilesStore((s) => s.isLoading)
  const loadProfiles = useAgentProfilesStore((s) => s.loadProfiles)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!hasLoadedRef.current && Object.keys(profiles).length === 0 && !isLoading) {
      hasLoadedRef.current = true
      loadProfiles()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const profileList = Object.values(profiles)
  const selectedProfile = value ? profiles[value] : null

  // Hide entirely when no profiles exist and nothing is selected
  if (!isLoading && profileList.length === 0 && !value) {
    return null
  }

  // Still loading initial data — don't flash/hide
  if (isLoading && profileList.length === 0 && !value) {
    return null
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'human_agent':
        return <User className="h-3 w-3 text-amber-500" />
      case 'hybrid':
        return <Zap className="h-3 w-3 text-blue-500" />
      default:
        return <Bot className="h-3 w-3 text-violet-500" />
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'human_agent':
        return 'bg-amber-500/10'
      case 'hybrid':
        return 'bg-blue-500/10'
      default:
        return 'bg-violet-500/10'
    }
  }

  return (
    <div className="space-y-2 pt-1" data-subblock-id={subBlockId}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Agent Profile</label>
        <span className="text-[10px] text-muted-foreground/50 px-1.5 py-0.5 rounded-full bg-muted/20 border border-border/20">
          Optional
        </span>
      </div>

      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg border transition-all duration-200',
            'border-border/50 bg-background/50',
            'hover:border-border hover:bg-background/80',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40'
          )}
        >
          {selectedProfile ? (
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  'h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0',
                  getTypeBg(selectedProfile.type)
                )}
              >
                {getTypeIcon(selectedProfile.type)}
              </div>
              <span className="truncate text-[13px] font-medium">{selectedProfile.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/50 text-[13px]">Select a profile...</span>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground/50" />
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground/40 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm shadow-lg max-h-48 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-150">
            {profileList.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onChange(profile.id)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors',
                  'hover:bg-accent/50',
                  value === profile.id && 'bg-primary/8'
                )}
              >
                <div
                  className={cn(
                    'h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0',
                    getTypeBg(profile.type)
                  )}
                >
                  {getTypeIcon(profile.type)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[13px] font-medium">{profile.name}</p>
                  {profile.description && (
                    <p className="truncate text-[11px] text-muted-foreground/60">
                      {profile.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
