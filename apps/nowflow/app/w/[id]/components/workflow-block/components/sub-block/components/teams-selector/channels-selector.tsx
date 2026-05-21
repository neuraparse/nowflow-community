'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, ChevronDown, Hash, RefreshCw } from 'lucide-react'
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
import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'

const logger = createLogger('ChannelsSelector')

export interface ChannelInfo {
  id: string
  displayName: string
  description?: string
  membershipType?: string
  webUrl?: string
  createdDateTime?: string
}

interface ChannelsSelectorProps {
  value: string
  onChange: (value: string, channelInfo?: ChannelInfo) => void
  blockId: string
  teamIdSubBlockId: string
  credentialSubBlockId: string
  label?: string
  disabled?: boolean
  onChannelInfoChange?: (info: ChannelInfo | null) => void
}

export function ChannelsSelector({
  value,
  onChange,
  blockId,
  teamIdSubBlockId,
  credentialSubBlockId,
  label = 'Select channel',
  disabled = false,
  onChannelInfoChange,
}: ChannelsSelectorProps) {
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get workflow ID from URL params
  const params = useParams()
  const workflowId = params.id as string

  // Get values from other subblocks with safe access
  const teamId = useSubBlockStore((state) => {
    try {
      if (!workflowId) return undefined
      const blockValues = state.workflowValues[workflowId]?.[blockId]
      return blockValues?.[teamIdSubBlockId]
    } catch (error) {
      logger.warn('Error accessing teamId from store:', error)
      return undefined
    }
  })

  const credentialId = useSubBlockStore((state) => {
    try {
      if (!workflowId) return undefined
      const blockValues = state.workflowValues[workflowId]?.[blockId]
      return blockValues?.[credentialSubBlockId]
    } catch (error) {
      logger.warn('Error accessing credentialId from store:', error)
      return undefined
    }
  })

  // Fetch channels from Microsoft Graph API
  const fetchChannels = useCallback(async () => {
    if (!credentialId || !teamId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/teams/channels?credentialId=${credentialId}&teamId=${teamId}`
      )

      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels || [])

        // If we have a selected channel ID, find the channel info
        if (value) {
          const channelInfo = data.channels?.find((channel: ChannelInfo) => channel.id === value)
          if (channelInfo) {
            setSelectedChannel(channelInfo)
            onChannelInfoChange?.(channelInfo)
          }
        }
      } else {
        logger.error('Failed to fetch channels:', response.statusText)
        setError('Failed to fetch channels')
        setChannels([])
      }
    } catch (error) {
      logger.error('Error fetching channels:', error)
      setError('Error fetching channels')
      setChannels([])
    } finally {
      setIsLoading(false)
    }
  }, [credentialId, teamId, value, onChannelInfoChange])

  // Fetch channels when team or credential changes
  useEffect(() => {
    if (credentialId && teamId) {
      fetchChannels()
    } else {
      setChannels([])
      setSelectedChannel(null)
    }
  }, [credentialId, teamId, fetchChannels])

  // Handle channel selection
  const handleChannelSelect = (channelId: string) => {
    const channelInfo = channels.find((channel) => channel.id === channelId)
    setSelectedChannel(channelInfo || null)
    onChange(channelId, channelInfo)
    onChannelInfoChange?.(channelInfo || null)
    setOpen(false)
  }

  // Handle open change
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)

    // Refresh channels when opening
    if (isOpen && credentialId && teamId) {
      fetchChannels()
    }
  }

  const isDisabled = disabled || !credentialId || !teamId

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isDisabled}
        >
          <div className="flex items-center gap-2 max-w-[calc(100%-20px)] overflow-hidden">
            <Hash className="h-4 w-4 text-muted-foreground" />
            {selectedChannel ? (
              <span className="font-normal truncate">{selectedChannel.displayName}</span>
            ) : (
              <span className="text-muted-foreground truncate">
                {!teamId ? 'Select team first' : label}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]" align="start">
        <Command>
          <CommandInput placeholder="Search channels..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Loading channels...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-center text-destructive">
                  <p className="text-sm font-medium">Error loading channels</p>
                  <p className="text-xs">{error}</p>
                </div>
              ) : !teamId ? (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium">Select a team first</p>
                  <p className="text-xs text-muted-foreground">
                    Choose a team to see its channels.
                  </p>
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium">No channels found</p>
                  <p className="text-xs text-muted-foreground">
                    This team has no accessible channels.
                  </p>
                </div>
              )}
            </CommandEmpty>
            {channels.length > 0 && (
              <CommandGroup>
                {channels.map((channel) => (
                  <CommandItem
                    key={channel.id}
                    value={channel.displayName}
                    onSelect={() => handleChannelSelect(channel.id)}
                    className="flex items-center gap-2"
                  >
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{channel.displayName}</div>
                      {channel.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {channel.description}
                        </div>
                      )}
                      {channel.membershipType && (
                        <div className="text-xs text-muted-foreground">
                          {channel.membershipType === 'private' ? '🔒 Private' : '🌐 Public'}
                        </div>
                      )}
                    </div>
                    {channel.id === value && <Check className="h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
