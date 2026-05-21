'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, ChevronDown, MessageCircle, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'

const logger = createLogger('ChatsSelector')

export interface ChatInfo {
  id: string
  topic?: string
  chatType: string
  members?: Array<{
    displayName: string
    email?: string
  }>
  createdDateTime?: string
  lastMessagePreview?: string
}

interface ChatsSelectorProps {
  value: string
  onChange: (value: string, chatInfo?: ChatInfo) => void
  blockId: string
  credentialSubBlockId: string
  label?: string
  disabled?: boolean
  allowEmailInput?: boolean
  onChatInfoChange?: (info: ChatInfo | null) => void
}

export function ChatsSelector({
  value,
  onChange,
  blockId,
  credentialSubBlockId,
  label = 'Select chat or enter email',
  disabled = false,
  allowEmailInput = true,
  onChatInfoChange,
}: ChatsSelectorProps) {
  const [open, setOpen] = useState(false)
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChat, setSelectedChat] = useState<ChatInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [isEmailMode, setIsEmailMode] = useState(false)

  // Get workflow ID from URL params
  const params = useParams()
  const workflowId = params.id as string

  // Get credential from other subblock with safe access
  const credentialId = useSubBlockStore((state) => {
    try {
      if (!workflowId) return undefined
      const blockValues = state.workflowValues[workflowId]?.[blockId]
      return blockValues?.[credentialSubBlockId]
    } catch (error) {
      logger.warn('Error accessing credential from store:', error)
      return undefined
    }
  })

  // Check if current value is an email
  const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)

  // Fetch chats from Microsoft Graph API
  const fetchChats = useCallback(async () => {
    if (!credentialId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/teams/chats?credentialId=${credentialId}`)

      if (response.ok) {
        const data = await response.json()
        setChats(data.chats || [])

        // If we have a selected chat ID, find the chat info
        if (value && !isEmail(value)) {
          const chatInfo = data.chats?.find((chat: ChatInfo) => chat.id === value)
          if (chatInfo) {
            setSelectedChat(chatInfo)
            onChatInfoChange?.(chatInfo)
          }
        }
      } else {
        logger.error('Failed to fetch chats:', response.statusText)
        setError('Failed to fetch chats')
        setChats([])
      }
    } catch (error) {
      logger.error('Error fetching chats:', error)
      setError('Error fetching chats')
      setChats([])
    } finally {
      setIsLoading(false)
    }
  }, [credentialId, value, onChatInfoChange])

  // Fetch chats when credential changes
  useEffect(() => {
    if (credentialId) {
      fetchChats()
    } else {
      setChats([])
      setSelectedChat(null)
    }
  }, [credentialId, fetchChats])

  // Update email mode based on current value
  useEffect(() => {
    if (value && isEmail(value)) {
      setIsEmailMode(true)
      setEmailInput(value)
      setSelectedChat(null)
    } else {
      setIsEmailMode(false)
      setEmailInput('')
    }
  }, [value])

  // Handle chat selection
  const handleChatSelect = (chatId: string) => {
    const chatInfo = chats.find((chat) => chat.id === chatId)
    setSelectedChat(chatInfo || null)
    setIsEmailMode(false)
    setEmailInput('')
    onChange(chatId, chatInfo)
    onChatInfoChange?.(chatInfo || null)
    setOpen(false)
  }

  // Handle email input
  const handleEmailChange = (email: string) => {
    setEmailInput(email)
    if (isEmail(email)) {
      setSelectedChat(null)
      setIsEmailMode(true)
      onChange(email)
      onChatInfoChange?.(null)
    }
  }

  // Handle open change
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)

    // Refresh chats when opening
    if (isOpen && credentialId) {
      fetchChats()
    }
  }

  // Get display name for a chat
  const getChatDisplayName = (chat: ChatInfo) => {
    if (chat.topic) return chat.topic

    if (chat.members && chat.members.length > 0) {
      const memberNames = chat.members
        .map((member) => member.displayName)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ')

      if (memberNames) {
        return chat.members.length > 3
          ? `${memberNames} +${chat.members.length - 3} more`
          : memberNames
      }
    }

    return chat.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat'
  }

  const isDisabled = disabled || !credentialId

  return (
    <div className="space-y-2">
      {/* Email input option */}
      {allowEmailInput && (
        <div className="flex gap-2">
          <Input
            placeholder="Enter email address (user@company.com)"
            value={emailInput}
            onChange={(e) => handleEmailChange(e.target.value)}
            disabled={isDisabled}
            className="flex-1"
          />
          {emailInput && !isEmail(emailInput) && (
            <div className="text-xs text-muted-foreground mt-1">Enter a valid email address</div>
          )}
        </div>
      )}

      {/* Chat selector */}
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
              {isEmailMode ? (
                <User className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              )}
              {isEmailMode ? (
                <span className="font-normal truncate">{emailInput}</span>
              ) : selectedChat ? (
                <span className="font-normal truncate">{getChatDisplayName(selectedChat)}</span>
              ) : (
                <span className="text-muted-foreground truncate">
                  {!credentialId ? 'Connect account first' : 'Select existing chat'}
                </span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[350px]" align="start">
          <Command>
            <CommandInput placeholder="Search chats..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading chats...</span>
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-destructive">
                    <p className="text-sm font-medium">Error loading chats</p>
                    <p className="text-xs">{error}</p>
                  </div>
                ) : !credentialId ? (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium">Connect account first</p>
                    <p className="text-xs text-muted-foreground">
                      Connect your Microsoft Teams account to see chats.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium">No chats found</p>
                    <p className="text-xs text-muted-foreground">
                      Use email input above to start a new chat.
                    </p>
                  </div>
                )}
              </CommandEmpty>
              {chats.length > 0 && (
                <CommandGroup>
                  {chats.map((chat) => (
                    <CommandItem
                      key={chat.id}
                      value={getChatDisplayName(chat)}
                      onSelect={() => handleChatSelect(chat.id)}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{getChatDisplayName(chat)}</div>
                        <div className="text-xs text-muted-foreground">
                          {chat.chatType === 'oneOnOne' ? 'Direct Message' : 'Group Chat'}
                        </div>
                        {chat.lastMessagePreview && (
                          <div className="text-xs text-muted-foreground truncate">
                            {chat.lastMessagePreview}
                          </div>
                        )}
                      </div>
                      {chat.id === value && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
