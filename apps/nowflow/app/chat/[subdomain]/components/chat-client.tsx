'use client'

import {
  Children,
  isValidElement,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowUp, Loader2, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OTPInputForm } from '@/components/ui/input-otp-form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createLogger } from '@/lib/logs/console-logger'
import { cn, generateUUID } from '@/lib/utils'
import { DeployedChatMessage, useDeployedChatStore } from '@/stores/deployed-chat/store'
import MarkdownRenderer from './components/markdown-renderer/markdown-renderer'

const logger = createLogger('chat-client')

// Define message type (alias for DeployedChatMessage for backward compatibility)
type ChatMessage = DeployedChatMessage

// Define chat config type
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
    enableCopyMessage?: boolean
    enableFeedback?: boolean
    enableDownloadChat?: boolean
    showPoweredBy?: boolean
  }
  authType?: 'public' | 'password' | 'email'
}

// ChatGPT-style message component
function ClientChatMessage({
  message,
  customizations,
  bubbleStyleMap,
  userBubbleTextColor,
}: {
  message: ChatMessage
  customizations: ChatConfig['customizations']
  bubbleStyleMap: Record<string, string>
  userBubbleTextColor: string
}) {
  // Check if content is a JSON object
  const isJsonObject = useMemo(() => {
    return typeof message.content === 'object' && message.content !== null
  }, [message.content])

  const primaryColor = customizations.primaryColor || '#7C3AED'
  const bubbleStyle = customizations.bubbleStyle || 'rounded'
  const showTimestamps = customizations.showTimestamps !== false

  // For user messages (on the right)
  if (message.type === 'user') {
    return (
      <div className="py-5 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-end flex-col items-end">
            <div
              className="max-w-[90%] sm:max-w-[80%] py-3 px-4"
              style={{
                backgroundColor: primaryColor,
                color: userBubbleTextColor,
                borderRadius: bubbleStyleMap[bubbleStyle],
              }}
            >
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {isJsonObject ? (
                  <pre>{JSON.stringify(message.content, null, 2)}</pre>
                ) : (
                  <span>{String(message.content)}</span>
                )}
              </div>
            </div>
            {showTimestamps && (
              <div className="text-xs opacity-50 mt-1">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // For assistant messages (on the left)
  return (
    <div className="py-5 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col">
          <div className="max-w-[90%] sm:max-w-[80%]">
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {isJsonObject ? (
                <pre>{JSON.stringify(message.content, null, 2)}</pre>
              ) : (
                <MarkdownRenderer content={message.content as string} />
              )}
            </div>
          </div>
          {showTimestamps && (
            <div className="text-xs opacity-50 mt-1">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatClient({ subdomain }: { subdomain: string }) {
  // Use Zustand store for persistent messages
  const { getMessages, addMessage, clearMessages, appendMessageContent } = useDeployedChatStore()
  const messages = getMessages(subdomain)

  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Fetch chat config function
  const fetchChatConfig = async () => {
    try {
      // Use relative URL instead of absolute URL with process.env.NEXT_PUBLIC_APP_URL
      const response = await fetch(`/api/chat/${subdomain}`, {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (!response.ok) {
        // Check if auth is required
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

      // The API returns the data directly without a wrapper
      setChatConfig(data)

      // Add welcome message if configured and no messages exist yet
      if (data?.customizations?.welcomeMessage && messages.length === 0) {
        addMessage(subdomain, {
          content: data.customizations.welcomeMessage,
          type: 'assistant',
        })
      }
    } catch (error) {
      logger.error('Error fetching chat config:', error)
      setError('This chat is currently unavailable. Please try again later.')
    }
  }

  // Fetch chat config on mount
  useEffect(() => {
    fetchChatConfig()
  }, [subdomain])

  // Apply favicon when config loads
  useEffect(() => {
    if (chatConfig?.customizations?.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
      link.setAttribute('type', 'image/x-icon')
      link.setAttribute('rel', 'shortcut icon')
      link.setAttribute('href', chatConfig.customizations.faviconUrl)
      document.getElementsByTagName('head')[0].appendChild(link)
    }
  }, [chatConfig?.customizations?.faviconUrl])

  // Handle keyboard input for message sending
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Handle keyboard input for auth forms
  const handleAuthKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAuthenticate()
    }
  }

  // Handle authentication
  const handleAuthenticate = async () => {
    if (authRequired === 'password') {
      // Password auth remains the same
      setAuthError(null)
      setIsAuthenticating(true)

      try {
        const payload = { password }

        const response = await fetch(`/api/chat/${subdomain}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json()
          setAuthError(errorData.error || 'Authentication failed')
          return
        }

        await response.json()

        // Authentication successful, fetch config again
        await fetchChatConfig()

        // Reset auth state
        setAuthRequired(null)
        setPassword('')
      } catch (error) {
        logger.error('Authentication error:', error)
        setAuthError('An error occurred during authentication')
      } finally {
        setIsAuthenticating(false)
      }
    } else if (authRequired === 'email') {
      // For email auth, we now send an OTP first
      if (!showOtpVerification) {
        // Step 1: User has entered email, send OTP
        setAuthError(null)
        setIsSendingOtp(true)

        try {
          const response = await fetch(`/api/chat/${subdomain}/otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ email }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            setAuthError(errorData.error || 'Failed to send verification code')
            return
          }

          // OTP sent successfully, show OTP input
          setShowOtpVerification(true)
        } catch (error) {
          logger.error('Error sending OTP:', error)
          setAuthError('An error occurred while sending the verification code')
        } finally {
          setIsSendingOtp(false)
        }
      } else {
        // Step 2: User has entered OTP, verify it
        setAuthError(null)
        setIsVerifyingOtp(true)

        try {
          const response = await fetch(`/api/chat/${subdomain}/otp`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ email, otp: otpValue }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            setAuthError(errorData.error || 'Invalid verification code')
            return
          }

          await response.json()

          // OTP verified successfully, fetch config again
          await fetchChatConfig()

          // Reset auth state
          setAuthRequired(null)
          setEmail('')
          setOtpValue('')
          setShowOtpVerification(false)
        } catch (error) {
          logger.error('Error verifying OTP:', error)
          setAuthError('An error occurred during verification')
        } finally {
          setIsVerifyingOtp(false)
        }
      }
    }
  }

  // Add this function to handle resending OTP
  const handleResendOtp = async () => {
    setAuthError(null)
    setIsSendingOtp(true)

    try {
      const response = await fetch(`/api/chat/${subdomain}/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setAuthError(errorData.error || 'Failed to resend verification code')
        return
      }

      // Show a message that OTP was sent
      setAuthError('Verification code sent. Please check your email.')
    } catch (error) {
      logger.error('Error resending OTP:', error)
      setAuthError('An error occurred while resending the verification code')
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Add a function to handle email input key down
  const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAuthenticate()
    }
  }

  // Add a function to handle OTP input key down
  const handleOtpKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAuthenticate()
    }
  }

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Handle sending a message
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

    // Ensure focus remains on input field
    if (inputRef.current) {
      inputRef.current.focus()
    }

    try {
      // Use relative URL with credentials and include session info for memory persistence
      const response = await fetch(`/api/chat/${subdomain}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          message: messageContent,
          sessionToken,
          fingerprint,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      // Detect streaming response via content-type (text/plain) or absence of JSON content-type
      const contentType = response.headers.get('Content-Type') || ''

      if (contentType.includes('text/plain')) {
        // Handle streaming response
        // Add placeholder message to store and get the actual message ID
        const messageId = addMessage(subdomain, {
          content: '',
          type: 'assistant',
        })

        // Stop showing loading indicator once streaming begins
        setIsLoading(false)

        // Ensure the response body exists and is a ReadableStream
        const reader = response.body?.getReader()
        if (reader) {
          const decoder = new TextDecoder()
          let done = false
          while (!done) {
            const { value, done: readerDone } = await reader.read()
            if (value) {
              const chunk = decoder.decode(value, { stream: true })
              if (chunk) {
                appendMessageContent(subdomain, messageId, chunk)
              }
            }
            done = readerDone
          }
        }
      } else {
        // Fallback to JSON response handling
        const responseData = await response.json()
        logger.debug('Message response:', responseData)

        // Handle different response formats from API
        if (
          responseData.multipleOutputs &&
          responseData.contents &&
          Array.isArray(responseData.contents)
        ) {
          // For multiple outputs, create separate assistant messages for each
          responseData.contents.forEach((content: any) => {
            // Format the content appropriately
            let formattedContent = content

            // Convert objects to strings for display
            if (typeof formattedContent === 'object' && formattedContent !== null) {
              try {
                formattedContent = JSON.stringify(formattedContent)
              } catch (e) {
                formattedContent = 'Received structured data response'
              }
            }

            addMessage(subdomain, {
              content: formattedContent || 'No content found',
              type: 'assistant',
            })
          })
        } else {
          // Handle single output as before
          let responseContent = responseData.output

          if (!responseContent && responseData.content) {
            if (typeof responseData.content === 'object') {
              if (responseData.content.text) {
                responseContent = responseData.content.text
              } else {
                try {
                  responseContent = JSON.stringify(responseData.content)
                } catch (e) {
                  responseContent = 'Received structured data response'
                }
              }
            } else {
              responseContent = responseData.content
            }
          }

          addMessage(subdomain, {
            content: responseContent || "Sorry, I couldn't process your request.",
            type: 'assistant',
          })
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
      // Ensure focus remains on input field even after the response
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  // If error, show error message
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

  // If authentication is required, show auth form
  if (authRequired) {
    // Get title and description from the URL params or use defaults
    const title = new URLSearchParams(window.location.search).get('title') || 'chat'
    const primaryColor = new URLSearchParams(window.location.search).get('color') || '#802FFF'

    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafafa] dark:bg-slate-950 font-logo">
        <div className="p-6 max-w-md w-full mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-md border border-black/[0.06] dark:border-white/[0.06]">
          <div className="text-center mb-6">
            <h2 className="text-xl font-light tracking-tight font-logo text-zinc-800 dark:text-white mb-2">
              {title}
            </h2>
            <p className="text-zinc-400 dark:text-white/40">
              {authRequired === 'password'
                ? 'This chat is password-protected. Please enter the password to continue.'
                : 'This chat requires email verification. Please enter your email to continue.'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            {authRequired === 'password' ? (
              <div className="w-full max-w-sm mx-auto">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 space-y-4 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center justify-center">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <Lock className="h-5 w-5" />
                    </div>
                  </div>

                  <h2 className="text-lg font-light tracking-tight font-logo text-center text-zinc-800 dark:text-white">
                    Password Required
                  </h2>
                  <p className="text-zinc-400 dark:text-white/40 text-sm text-center">
                    Enter the password to access this chat
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAuthenticate()
                    }}
                  >
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="password" className="text-sm font-medium font-logo sr-only">
                          Password
                        </label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          disabled={isAuthenticating}
                          className="w-full"
                        />
                      </div>

                      {authError && (
                        <div className="text-sm text-red-600 dark:text-red-500">{authError}</div>
                      )}

                      <Button
                        type="submit"
                        disabled={!password || isAuthenticating}
                        className="w-full"
                        style={{
                          backgroundColor: chatConfig?.customizations?.primaryColor || '#802FFF',
                        }}
                      >
                        {isAuthenticating ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Authenticating...
                          </div>
                        ) : (
                          'Continue'
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-sm mx-auto">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-6 space-y-4 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center justify-center">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <Mail className="h-5 w-5" />
                    </div>
                  </div>

                  <h2 className="text-lg font-light tracking-tight font-logo text-center text-zinc-800 dark:text-white">
                    Email Verification
                  </h2>

                  {!showOtpVerification ? (
                    // Step 1: Email Input
                    <>
                      <p className="text-zinc-400 dark:text-white/40 text-sm text-center">
                        Enter your email address to access this chat
                      </p>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label htmlFor="email" className="text-sm font-medium font-logo sr-only">
                            Email
                          </label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleEmailKeyDown}
                            disabled={isSendingOtp || isAuthenticating}
                            className="w-full"
                          />
                        </div>

                        {authError && (
                          <div className="text-sm text-red-600 dark:text-red-500">{authError}</div>
                        )}

                        <Button
                          onClick={handleAuthenticate}
                          disabled={!email || isSendingOtp || isAuthenticating}
                          className="w-full"
                          style={{
                            backgroundColor: chatConfig?.customizations?.primaryColor || '#802FFF',
                          }}
                        >
                          {isSendingOtp ? (
                            <div className="flex items-center justify-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending Code...
                            </div>
                          ) : (
                            'Continue'
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Step 2: OTP Verification with OTPInputForm
                    <>
                      <p className="text-zinc-400 dark:text-white/40 text-sm text-center">
                        Enter the verification code sent to
                      </p>
                      <p className="text-center font-medium text-sm break-all mb-3">{email}</p>

                      <OTPInputForm
                        onSubmit={(value) => {
                          setOtpValue(value)
                          handleAuthenticate()
                        }}
                        isLoading={isVerifyingOtp}
                        error={authError}
                      />

                      <div className="flex items-center justify-center pt-3">
                        <button
                          type="button"
                          onClick={() => handleResendOtp()}
                          disabled={isSendingOtp}
                          className="text-sm font-logo text-primary hover:underline disabled:opacity-50 transition-opacity duration-200"
                        >
                          {isSendingOtp ? 'Sending...' : 'Resend code'}
                        </button>
                        <span className="mx-2 text-zinc-400 dark:text-white/25">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOtpVerification(false)
                            setOtpValue('')
                            setAuthError(null)
                          }}
                          className="text-sm font-logo text-primary hover:underline transition-opacity duration-200"
                        >
                          Change email
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Loading state while fetching config
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

  // Get customization values with defaults
  const customizations = chatConfig.customizations || {}
  const primaryColor = customizations.primaryColor || '#7C3AED' // More accessible purple (WCAG AA compliant)
  const backgroundColor = customizations.backgroundColor
  const textColor = customizations.textColor
  const fontFamily = customizations.fontFamily || 'system-ui, -apple-system, sans-serif'
  const fontSize = customizations.fontSize || 'medium'
  const bubbleStyle = customizations.bubbleStyle || 'rounded'
  const placeholderText = customizations.placeholderText || 'Message...'

  // Font size mapping (using rem for accessibility)
  const fontSizeMap = {
    small: '0.875rem', // 14px
    medium: '1rem', // 16px
    large: '1.125rem', // 18px
  }

  // Bubble style mapping
  const bubbleStyleMap = {
    rounded: '1.5rem',
    sharp: '0.25rem',
    minimal: '0.5rem',
  }

  // Helper function to determine if a color is light or dark
  const isLightColor = (hexColor: string): boolean => {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Determine text color for user bubble based on primary color brightness
  const userBubbleTextColor = isLightColor(primaryColor) ? '#000000' : '#ffffff'

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-950 text-zinc-800 dark:text-white font-logo viewport-safe-top viewport-safe-bottom"
      style={{
        ...(backgroundColor && { backgroundColor }),
        ...(textColor && { color: textColor }),
        fontFamily,
        fontSize: fontSizeMap[fontSize],
      }}
    >
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
          animation: growShrink 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Header with title */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-light tracking-tight font-logo">
          {chatConfig.customizations?.headerText || chatConfig.title || 'Chat'}
        </h2>
        {chatConfig.customizations?.logoUrl && (
          <img
            src={chatConfig.customizations.logoUrl}
            alt={`${chatConfig.title} logo`}
            className="h-6 w-6 object-contain"
          />
        )}
      </div>

      {/* Messages container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 px-4">
              <div className="text-center space-y-2">
                {customizations.logoUrl && (
                  <img
                    src={customizations.logoUrl}
                    alt="Logo"
                    className="h-16 w-16 mx-auto mb-4 object-contain"
                  />
                )}
                <h3 className="text-lg font-light tracking-tight font-logo">
                  {customizations.emptyStateMessage || 'How can I help you today?'}
                </h3>
                <p className="opacity-60 text-sm">{chatConfig.description || 'Ask me anything.'}</p>
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
              />
            ))
          )}

          {/* Loading indicator (shows only when executing) */}
          {isLoading && customizations.showTypingIndicator !== false && (
            <div className="py-5 px-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex">
                  <div className="max-w-[90%] sm:max-w-[80%]">
                    <div className="flex items-center h-6 gap-1">
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
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Input area (fixed at bottom) */}
      <div
        className="p-3 sm:p-6 bg-white dark:bg-slate-950 border-t border-black/[0.06] dark:border-white/[0.06]"
        style={{ ...(backgroundColor && { backgroundColor, borderColor: 'transparent' }) }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="relative border border-black/[0.06] dark:border-white/[0.06] shadow-sm bg-white dark:bg-slate-900"
            style={{ borderRadius: bubbleStyleMap[bubbleStyle] }}
          >
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              style={{
                borderRadius: bubbleStyleMap[bubbleStyle],
                ...(textColor && { color: textColor }),
              }}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 py-7 pr-16 bg-transparent pl-6 text-base min-h-[50px] text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/25"
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              style={{
                backgroundColor: primaryColor,
                borderRadius: bubbleStyleMap[bubbleStyle],
                color: userBubbleTextColor,
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 p-0 hover:opacity-90 disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>

          {/* Footer text and powered by */}
          {(customizations.footerText || customizations.showPoweredBy) && (
            <div className="mt-3 text-center text-xs opacity-60">
              {customizations.footerText && <div>{customizations.footerText}</div>}
              {customizations.showPoweredBy && (
                <div className="mt-1">
                  Powered by{' '}
                  <a
                    href={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Nowflow
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
