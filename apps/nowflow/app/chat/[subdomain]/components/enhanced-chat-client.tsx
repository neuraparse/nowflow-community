'use client'

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Mic,
  Paperclip,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OTPInputForm } from '@/components/ui/input-otp-form'
import { createLogger } from '@/lib/logs/console-logger'
import { cn, generateUUID } from '@/lib/utils'
import type { ChatConfig, ChatCustomizations, ChatSession, ResponseConfig } from '@/types/chat'
import MarkdownRenderer from './components/markdown-renderer/markdown-renderer'

const logger = createLogger('enhanced-chat-client')

// Message type
interface ChatMessage {
  id: string
  content: string
  type: 'user' | 'assistant' | 'system'
  timestamp: Date
  metadata?: {
    responseTime?: number
    blockId?: string
    outputPath?: string
  }
}

// Enhanced ChatGPT-style message component with actions
function EnhancedChatMessage({
  message,
  customizations,
  onFeedback,
  onCopy,
}: {
  message: ChatMessage
  customizations: ChatCustomizations
  onFeedback?: (messageId: string, isPositive: boolean) => void
  onCopy?: (content: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null)

  const isJsonObject = useMemo(() => {
    return typeof message.content === 'object' && message.content !== null
  }, [message.content])

  const handleCopy = () => {
    const textContent = isJsonObject
      ? JSON.stringify(message.content, null, 2)
      : (message.content as string)

    navigator.clipboard.writeText(textContent)
    setCopied(true)
    onCopy?.(textContent)

    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (isPositive: boolean) => {
    setFeedbackGiven(isPositive)
    onFeedback?.(message.id, isPositive)
  }

  // Apply customizations
  const bubbleStyle = customizations.bubbleStyle || 'rounded'
  const borderRadius =
    bubbleStyle === 'rounded'
      ? 'rounded-3xl'
      : bubbleStyle === 'sharp'
        ? 'rounded-md'
        : 'rounded-xl'
  const fontSize =
    customizations.fontSize === 'small'
      ? 'text-sm'
      : customizations.fontSize === 'large'
        ? 'text-lg'
        : 'text-base'
  const fontFamily = customizations.fontFamily || 'font-sans'

  // User messages (on the right)
  if (message.type === 'user') {
    return (
      <div className="py-5 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-end">
            <div
              className={cn(
                'max-w-[80%] py-3 px-4',
                borderRadius,
                fontFamily,
                'bg-[#F4F4F4] dark:bg-white/[0.06]'
              )}
            >
              <div
                className={cn(
                  'whitespace-pre-wrap break-words leading-relaxed text-zinc-800 dark:text-white',
                  fontSize
                )}
              >
                {isJsonObject ? (
                  <pre>{JSON.stringify(message.content, null, 2)}</pre>
                ) : (
                  <span>{message.content}</span>
                )}
              </div>
              {customizations.showTimestamps && (
                <div className="text-xs text-zinc-400 dark:text-white/40 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Assistant messages (on the left) with actions
  return (
    <div className="py-5 px-4 group">
      <div className="max-w-3xl mx-auto">
        <div className="flex">
          <div className="max-w-[80%]">
            <div
              className={cn(
                'whitespace-pre-wrap break-words leading-relaxed',
                fontSize,
                fontFamily
              )}
            >
              {isJsonObject ? (
                <pre>{JSON.stringify(message.content, null, 2)}</pre>
              ) : (
                <MarkdownRenderer content={message.content as string} />
              )}
            </div>

            {/* Message actions */}
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {customizations.showTimestamps && (
                <span className="text-xs text-zinc-400 dark:text-white/40 mr-auto">
                  {message.timestamp.toLocaleTimeString()}
                  {message.metadata?.responseTime && ` • ${message.metadata.responseTime}ms`}
                </span>
              )}

              {customizations.enableCopyMessage && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              )}

              {customizations.enableFeedback && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(true)}
                    className={cn(
                      'h-7 px-2',
                      feedbackGiven === true && 'bg-green-100 dark:bg-green-900'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(false)}
                    className={cn(
                      'h-7 px-2',
                      feedbackGiven === false && 'bg-red-100 dark:bg-red-900'
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EnhancedChatClient({ subdomain }: { subdomain: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Session tracking
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionToken, setSessionToken] = useState<string>('')

  // Authentication state
  const [authRequired, setAuthRequired] = useState<'password' | 'email' | null>(null)
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // OTP verification state
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  // Typing indicator
  const [isTyping, setIsTyping] = useState(false)

  // File upload (placeholder for future implementation)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Initialize session
  useEffect(() => {
    const token = localStorage.getItem(`chat_session_${subdomain}`) || generateUUID()
    setSessionToken(token)
    localStorage.setItem(`chat_session_${subdomain}`, token)
  }, [subdomain])

  // Fetch chat config
  const fetchChatConfig = async () => {
    try {
      const response = await fetch(`/api/chat/${subdomain}`, {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Session-Token': sessionToken,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          const errorData = await response.json()

          if (errorData.error === 'auth_required_password') {
            setAuthRequired('password')
            return
          } else if (errorData.error === 'auth_required_email') {
            setAuthRequired('email')
            return
          }
        }

        throw new Error(`Failed to load chat configuration: ${response.status}`)
      }

      const data = await response.json()
      setChatConfig(data)

      // Add welcome message if configured
      if (data?.customizations?.welcomeMessage) {
        setMessages([
          {
            id: 'welcome',
            content: data.customizations.welcomeMessage,
            type: 'assistant',
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      logger.error('Error fetching chat config:', error)
      setError(
        chatConfig?.customizations?.errorMessage ||
          'This chat is currently unavailable. Please try again later.'
      )
    }
  }

  useEffect(() => {
    if (sessionToken) {
      fetchChatConfig()
    }
  }, [subdomain, sessionToken])

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping])

  // Handle keyboard input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const startTime = Date.now()
    const userMessage: ChatMessage = {
      id: generateUUID(),
      content: inputValue,
      type: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    if (chatConfig?.customizations?.showTypingIndicator) {
      setIsTyping(true)
    }

    if (inputRef.current) {
      inputRef.current.focus()
    }

    try {
      const response = await fetch(`/api/chat/${subdomain}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({ message: userMessage.content }),
      })

      setIsTyping(false)

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const contentType = response.headers.get('Content-Type') || ''

      if (contentType.includes('text/plain')) {
        // Handle streaming response
        const messageId = crypto.randomUUID()

        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            content: '',
            type: 'assistant',
            timestamp: new Date(),
          },
        ])

        setIsLoading(false)

        const reader = response.body?.getReader()
        if (reader) {
          const decoder = new TextDecoder()
          let done = false
          while (!done) {
            const { value, done: readerDone } = await reader.read()
            if (value) {
              const chunk = decoder.decode(value, { stream: true })
              if (chunk) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg
                  )
                )
              }
            }
            done = readerDone
          }

          // Update with response time
          const responseTime = Date.now() - startTime
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, responseTime } } : msg
            )
          )
        }
      } else {
        // Handle JSON response
        const responseData = await response.json()
        const responseTime = Date.now() - startTime

        if (
          responseData.multipleOutputs &&
          responseData.contents &&
          Array.isArray(responseData.contents)
        ) {
          const assistantMessages = responseData.contents.map((content: any) => {
            let formattedContent = content

            if (typeof formattedContent === 'object' && formattedContent !== null) {
              try {
                formattedContent = JSON.stringify(formattedContent)
              } catch (e) {
                formattedContent = 'Received structured data response'
              }
            }

            return {
              id: crypto.randomUUID(),
              content: formattedContent || 'No content found',
              type: 'assistant' as const,
              timestamp: new Date(),
              metadata: { responseTime },
            }
          })

          setMessages((prev) => [...prev, ...assistantMessages])
        } else {
          let messageContent = responseData.output

          if (!messageContent && responseData.content) {
            if (typeof responseData.content === 'object') {
              if (responseData.content.text) {
                messageContent = responseData.content.text
              } else {
                try {
                  messageContent = JSON.stringify(responseData.content)
                } catch (e) {
                  messageContent = 'Received structured data response'
                }
              }
            } else {
              messageContent = responseData.content
            }
          }

          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            content:
              messageContent ||
              chatConfig?.responseConfig?.fallbackMessage ||
              "Sorry, I couldn't process your request.",
            type: 'assistant',
            timestamp: new Date(),
            metadata: { responseTime },
          }

          setMessages((prev) => [...prev, assistantMessage])
        }
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      setIsTyping(false)

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content:
          chatConfig?.customizations?.errorMessage ||
          'Sorry, there was an error processing your message. Please try again.',
        type: 'assistant',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  // Handle feedback
  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    try {
      await fetch(`/api/chat/${subdomain}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({ messageId, isPositive }),
      })
    } catch (error) {
      logger.error('Error submitting feedback:', error)
    }
  }

  // Handle copy
  const handleCopy = (content: string) => {
    logger.debug('Message copied:', content.substring(0, 50))
  }

  // Handle download chat
  const handleDownloadChat = () => {
    const chatText = messages
      .map((msg) => {
        const timestamp = msg.timestamp.toLocaleString()
        const sender = msg.type === 'user' ? 'You' : chatConfig?.title || 'Assistant'
        return `[${timestamp}] ${sender}: ${msg.content}`
      })
      .join('\n\n')

    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${subdomain}-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Authentication handling (same as original)
  const handleAuthenticate = async () => {
    // ... (keep the same authentication logic from original)
  }

  // Apply customizations
  const customizations = chatConfig?.customizations || {}
  const primaryColor = customizations.primaryColor || '#802FFF'
  const backgroundColor = customizations.backgroundColor || 'bg-background'
  const textColor = customizations.textColor || 'text-foreground'

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafafa] dark:bg-slate-950 font-logo">
        <div className="p-6 max-w-md mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-md border border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="text-xl font-light tracking-tight font-logo text-red-500 mb-2">Error</h2>
          <p className="text-zinc-800 dark:text-white">{error}</p>
        </div>
      </div>
    )
  }

  // Render auth state (same as original)
  if (authRequired) {
    // ... (keep the same auth UI from original)
    return null // Placeholder
  }

  // Loading state
  if (!chatConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafafa] dark:bg-slate-950 font-logo">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-white/[0.06] rounded mx-auto mb-4"></div>
          <div className="h-4 w-64 bg-zinc-200 dark:bg-white/[0.06] rounded mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col bg-[#fafafa] dark:bg-slate-950 text-zinc-800 dark:text-white font-logo viewport-safe-top viewport-safe-bottom'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          {customizations.logoUrl && (
            <img
              src={customizations.logoUrl}
              alt={`${chatConfig.title} logo`}
              className="h-8 w-8 object-contain"
            />
          )}
          <h2 className="text-lg font-light tracking-tight font-logo">
            {customizations.headerText || chatConfig.title || 'Chat'}
          </h2>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {customizations.enableDownloadChat && messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDownloadChat}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 px-4">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-zinc-400 dark:text-white/25" />
                <h3 className="text-lg font-light tracking-tight font-logo">
                  {customizations.emptyStateMessage || 'How can I help you today?'}
                </h3>
                <p className="text-zinc-400 dark:text-white/40 text-sm">
                  {chatConfig.description || 'Ask me anything.'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <EnhancedChatMessage
                key={message.id}
                message={message}
                customizations={customizations}
                onFeedback={handleFeedback}
                onCopy={handleCopy}
              />
            ))
          )}

          {/* Typing indicator */}
          {isTyping && customizations.showTypingIndicator && (
            <div className="py-5 px-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-white/25 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white dark:bg-slate-950 p-6 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 shadow-sm">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={customizations.placeholderText || 'Message...'}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 py-7 pr-16 bg-transparent pl-6 text-base min-h-[50px] rounded-2xl"
            />

            {/* Input actions */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {customizations.enableFileUpload && (
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Paperclip className="h-4 w-4" />
                </Button>
              )}

              {customizations.enableVoiceInput && (
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mic className="h-4 w-4" />
                </Button>
              )}

              <Button
                onClick={handleSendMessage}
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                className="h-10 w-10 p-0 rounded-xl bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity duration-200 disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Footer text */}
          {customizations.footerText && (
            <p className="text-xs text-center text-zinc-400 dark:text-white/40 mt-2">
              {customizations.footerText}
            </p>
          )}

          {customizations.showPoweredBy !== false && (
            <p className="text-xs text-center text-zinc-400 dark:text-white/40 mt-2">
              Powered by Nowflow
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
