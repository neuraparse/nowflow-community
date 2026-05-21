'use client'

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  MessageCircle,
  Minimize2,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createLogger } from '@/lib/logs/console-logger'
import { generateUUID } from '@/lib/utils'
import { DeployedChatMessage, useDeployedChatStore } from '@/stores/deployed-chat/store'
import MarkdownRenderer from './components/markdown-renderer/markdown-renderer'

const logger = createLogger('WidgetChatClient')

// Define message type (alias for DeployedChatMessage for backward compatibility)
type ChatMessage = DeployedChatMessage

interface ChatConfig {
  id: string
  title: string
  description: string
  customizations: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    logoUrl?: string
    faviconUrl?: string
    chatPosition?: 'bottom-right' | 'bottom-left' | 'center' | 'full-screen'
    bubbleStyle?: 'rounded' | 'sharp' | 'minimal'
    fontSize?: 'small' | 'medium' | 'large'
    fontFamily?: string
    welcomeMessage?: string
    placeholderText?: string
    headerText?: string
    footerText?: string
    emptyStateMessage?: string
    errorMessage?: string
    showTimestamps?: boolean
    showTypingIndicator?: boolean
    showPoweredBy?: boolean
    enableCopyMessage?: boolean
    enableFeedback?: boolean
  }
  authType?: 'public' | 'password' | 'email'
}

function ClientChatMessage({
  message,
  customizations,
  bubbleStyleMap,
  userBubbleTextColor,
  subdomain,
}: {
  message: ChatMessage
  customizations: ChatConfig['customizations']
  bubbleStyleMap: Record<string, string>
  userBubbleTextColor: string
  subdomain: string
}) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const isJsonObject = useMemo(() => {
    return typeof message.content === 'object' && message.content !== null
  }, [message.content])

  const primaryColor = customizations.primaryColor || '#7C3AED'
  const secondaryColor = customizations.secondaryColor || '#f4f4f5'
  const textColor = customizations.textColor || '#000000'
  const bubbleStyle = customizations.bubbleStyle || 'rounded'
  const showTimestamps = customizations.showTimestamps !== false
  const enableCopyMessage = customizations.enableCopyMessage !== false
  const enableFeedback = customizations.enableFeedback !== false

  const handleCopy = async () => {
    const content =
      typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content, null, 2)
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = async (type: 'up' | 'down') => {
    setFeedback(type)
    try {
      await fetch(`/api/chat/${subdomain}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          feedback: type,
        }),
      })
    } catch (error) {
      logger.error('Failed to send feedback:', error)
    }
  }

  // User message - bubble on left, avatar on right (matching Preview)
  if (message.type === 'user') {
    return (
      <div className="px-4 py-2">
        <div className="flex gap-2 justify-end">
          <div
            className="max-w-[85%] py-2.5 px-4 text-sm shadow-sm"
            style={{
              backgroundColor: primaryColor,
              color: userBubbleTextColor,
              borderRadius: bubbleStyleMap[bubbleStyle],
            }}
          >
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {isJsonObject ? (
                <pre className="text-xs">{JSON.stringify(message.content, null, 2)}</pre>
              ) : (
                <span>{String(message.content)}</span>
              )}
            </div>
            {showTimestamps && (
              <div className="text-[9px] opacity-40 mt-2 pt-2 border-t border-white/10 text-right">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
          <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-white/[0.06] flex-shrink-0 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-zinc-400 dark:text-white/40" />
          </div>
        </div>
      </div>
    )
  }

  // Assistant message - avatar on left, bubble on right (matching Preview)
  return (
    <div className="px-4 py-2">
      <div className="flex gap-2 justify-start">
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <Bot className="w-3.5 h-3.5" />
        </div>
        <div
          className="max-w-[85%] py-2.5 px-4 text-sm shadow-sm"
          style={{
            backgroundColor: secondaryColor,
            color: textColor,
            borderRadius: bubbleStyleMap[bubbleStyle],
          }}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {isJsonObject ? (
              <pre className="text-xs">{JSON.stringify(message.content, null, 2)}</pre>
            ) : (
              <MarkdownRenderer content={message.content as string} />
            )}
          </div>
          {/* Message Actions - Matches Preview UI */}
          {(enableCopyMessage || enableFeedback || showTimestamps) && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-black/5">
              {enableCopyMessage && (
                <button
                  onClick={handleCopy}
                  className="opacity-50 hover:opacity-100 transition-opacity duration-200"
                  title="Copy message"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
              {enableFeedback && (
                <>
                  <button
                    onClick={() => handleFeedback('up')}
                    className={`transition-opacity duration-200 ${feedback === 'up' ? 'opacity-100 text-green-500' : 'opacity-50 hover:opacity-100'}`}
                    title="Helpful"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleFeedback('down')}
                    className={`transition-opacity duration-200 ${feedback === 'down' ? 'opacity-100 text-red-500' : 'opacity-50 hover:opacity-100'}`}
                    title="Not helpful"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                </>
              )}
              {showTimestamps && (
                <span className="text-[9px] opacity-40 ml-auto">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WidgetChatClient({ subdomain }: { subdomain: string }) {
  // Use Zustand store for persistent messages
  const { getMessages, addMessage, clearMessages, appendMessageContent } = useDeployedChatStore()
  const messages = getMessages(subdomain)

  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Session management for memory persistence
  const [sessionToken, setSessionToken] = useState<string>(() => {
    // Try to get existing session token from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`chat_session_${subdomain}`)
      if (stored) return stored
    }
    // Generate new session token
    const newToken = generateUUID()
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_session_${subdomain}`, newToken)
    }
    return newToken
  })

  const [fingerprint, setFingerprint] = useState<string>(() => {
    // Try to get existing fingerprint from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('chat_fingerprint')
      if (stored) return stored
    }
    // Generate new fingerprint based on browser characteristics
    const newFingerprint = generateUUID()
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat_fingerprint', newFingerprint)
    }
    return newFingerprint
  })

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const fetchChatConfig = async () => {
    try {
      // Use the same endpoint as chat-client (GET without /config)
      const response = await fetch(`/api/chat/${subdomain}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setChatConfig(data)
      } else {
        logger.warn('Failed to fetch chat config:', response.status)
      }
    } catch (error) {
      logger.error('Error fetching chat config:', error)
    }
  }

  useEffect(() => {
    fetchChatConfig()
  }, [subdomain])

  // Auto-open for center and full-screen positions
  useEffect(() => {
    if (chatConfig && !initialLoadComplete) {
      const chatPosition = chatConfig.customizations?.chatPosition || 'full-screen'
      if (chatPosition === 'center' || chatPosition === 'full-screen') {
        setIsOpen(true)
      }
      setInitialLoadComplete(true)
    }
  }, [chatConfig, initialLoadComplete])

  useEffect(() => {
    if (chatConfig?.customizations?.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
      link.setAttribute('type', 'image/x-icon')
      link.setAttribute('rel', 'shortcut icon')
      link.setAttribute('href', chatConfig.customizations.faviconUrl)
      document.getElementsByTagName('head')[0].appendChild(link)
    }
  }, [chatConfig?.customizations?.faviconUrl])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    // Add user message to store
    addMessage(subdomain, {
      content: inputValue,
      type: 'user',
    })

    const messageContent = inputValue
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/chat/${subdomain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          sessionToken,
          fingerprint,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Extract response content with multiple fallbacks
        const responseContent = data.content || data.output || data.message || 'No response'
        addMessage(subdomain, {
          content:
            typeof responseContent === 'object'
              ? responseContent.content || JSON.stringify(responseContent)
              : responseContent,
          type: 'assistant',
        })

        // Increment unread if widget is closed
        if (!isOpen) {
          setUnreadCount((prev) => prev + 1)
        }
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      addMessage(subdomain, {
        content:
          chatConfig?.customizations?.errorMessage ||
          'Sorry, there was an error processing your message. Please try again.',
        type: 'assistant',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleWidget = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setUnreadCount(0) // Clear unread when opening
    }
  }

  if (!chatConfig) {
    return null
  }

  const customizations = chatConfig.customizations || {}
  const primaryColor = customizations.primaryColor || '#7C3AED'
  const secondaryColor = customizations.secondaryColor || '#f4f4f5'
  const backgroundColor = customizations.backgroundColor || '#ffffff'
  const textColor = customizations.textColor || '#000000'
  const fontFamily = customizations.fontFamily || 'system-ui, -apple-system, sans-serif'
  const fontSize = customizations.fontSize || 'medium'
  const bubbleStyle = customizations.bubbleStyle || 'rounded'
  const placeholderText = customizations.placeholderText || 'Message...'
  const chatPosition = customizations.chatPosition || 'bottom-right'

  const fontSizeMap = {
    small: '0.875rem',
    medium: '1rem',
    large: '1.125rem',
  }

  const bubbleStyleMap = {
    rounded: '1.5rem',
    sharp: '0.25rem',
    minimal: '0.5rem',
  }

  const isLightColor = (hexColor: string): boolean => {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  const userBubbleTextColor = isLightColor(primaryColor) ? '#000000' : '#ffffff'

  // Position classes for narrow viewports
  const positionClasses = {
    'bottom-right': 'bottom-2 right-2 sm:bottom-4 sm:right-4',
    'bottom-left': 'bottom-2 left-2 sm:bottom-4 sm:left-4',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'full-screen': 'inset-0',
  }

  const widgetSizeClasses =
    chatPosition === 'full-screen'
      ? 'w-full h-full'
      : chatPosition === 'center'
        ? 'w-[90vw] max-w-2xl h-[80vh] max-h-[700px]'
        : 'w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100dvh-6rem)] sm:h-[600px] max-w-[400px]'

  return (
    <>
      <style jsx>{`
        @keyframes growShrink {
          0%,
          100% {
            transform: scale(0.9);
          }
          50% {
            transform: scale(1.1);
          }
        }
        .loading-dot {
          animation: growShrink 1s ease-in-out infinite;
        }
      `}</style>

      {/* Chat Widget */}
      {isOpen && (
        <div
          className={`fixed ${positionClasses[chatPosition]} ${widgetSizeClasses} z-[100] flex flex-col shadow-2xl border border-black/[0.06] dark:border-white/[0.06] font-logo`}
          style={{
            borderRadius: chatPosition === 'full-screen' ? '0' : '1rem',
            backgroundColor: backgroundColor || '#ffffff',
            color: textColor || '#111827',
            fontFamily,
            fontSize: fontSizeMap[fontSize],
          }}
        >
          {/* Header - matches Preview UI */}
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <div className="flex items-center gap-3">
              {customizations.logoUrl ? (
                <img
                  src={customizations.logoUrl}
                  alt="Logo"
                  className="h-10 w-10 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Bot className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold font-logo text-sm" style={{ color: textColor }}>
                  {customizations.headerText || chatConfig.title}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-zinc-400 dark:text-white/40">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {chatPosition !== 'full-screen' && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-[#fafafa] dark:bg-slate-950"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 px-4">
                <div className="text-center space-y-2">
                  {customizations.logoUrl && (
                    <img
                      src={customizations.logoUrl}
                      alt="Logo"
                      className="h-12 w-12 mx-auto mb-3 object-contain"
                    />
                  )}
                  <h3 className="text-sm font-light tracking-tight font-logo">
                    {customizations.emptyStateMessage || 'How can I help you today?'}
                  </h3>
                  <p className="opacity-60 text-xs">
                    {chatConfig.description || 'Ask me anything.'}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ClientChatMessage
                  key={message.id}
                  message={message}
                  customizations={customizations}
                  bubbleStyleMap={bubbleStyleMap}
                  userBubbleTextColor={userBubbleTextColor}
                  subdomain={subdomain}
                />
              ))
            )}

            {/* Typing Indicator - matches Preview UI */}
            {isLoading && customizations.showTypingIndicator !== false && (
              <div className="px-4 py-2">
                <div className="flex gap-2 items-center">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div
                    className="px-4 py-3 rounded-2xl"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 loading-dot"></div>
                      <div
                        className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 loading-dot"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 loading-dot"
                        style={{ animationDelay: '0.4s' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Input - matches Preview UI */}
          <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholderText}
                  className="w-full px-4 py-2.5 rounded-full border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 focus-visible:ring-2 focus-visible:ring-offset-0 text-sm"
                  style={{
                    color: textColor,
                    // @ts-ignore
                    '--tw-ring-color': primaryColor,
                  }}
                />
              </div>
              <Button
                onClick={handleSendMessage}
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                className="p-2.5 rounded-full text-white shadow-lg hover:opacity-90 disabled:opacity-50 h-10 w-10"
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Footer - matches Preview UI */}
          {(customizations.footerText || customizations.showPoweredBy) && (
            <div className="px-4 py-2 text-center text-[10px] text-zinc-400 dark:text-white/40 bg-[#fafafa] dark:bg-slate-900/50">
              {customizations.footerText ||
                (customizations.showPoweredBy && 'Powered by NowFlow AI')}
            </div>
          )}
        </div>
      )}

      {/* Widget Button */}
      {!isOpen && chatPosition !== 'full-screen' && chatPosition !== 'center' && (
        <button
          onClick={toggleWidget}
          className={`fixed ${positionClasses[chatPosition]} z-[100] h-14 w-14 rounded-full shadow-xl hover:scale-110 transition-transform duration-200 flex items-center justify-center`}
          style={{ backgroundColor: primaryColor, color: userBubbleTextColor }}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold font-logo">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      )}
    </>
  )
}
