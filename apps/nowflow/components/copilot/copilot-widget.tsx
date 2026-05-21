'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Minimize2,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CopilotCharacter } from './copilot-character'
import { useCopilot } from './copilot-provider'
import {
  easeOut,
  formatRelativeTime,
  formatTime,
  getRandomNudgeMessage,
  getSuggestions,
  HIDDEN_CONTEXTS,
  spring,
  springGentle,
} from './copilot-utils'
import {
  ActionSummaryCard,
  MarkdownContent,
  MessageActions,
  ThinkingIndicator,
} from './copilot-widget-parts'

// ─── Panel Style Constants ──────────────────────────────────────────────────────

const PANEL_FONT_STYLE = {
  fontFeatureSettings: '"cv11", "ss01", "ss03"',
  WebkitFontSmoothing: 'antialiased',
} as const

const SCROLLBAR_CLASSES =
  '[scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.06)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.08)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/[0.06] dark:[&::-webkit-scrollbar-thumb]:bg-white/8 [&::-webkit-scrollbar-thumb]:rounded-full'

const HISTORY_SCROLLBAR_CLASSES =
  '[scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.08)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.1)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:bg-black/[0.08] dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full'

const formatTerminalStamp = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

// ─── Main Widget ────────────────────────────────────────────────────────────────

export function CopilotWidget() {
  const {
    isOpen,
    setIsOpen,
    messages,
    sendMessage,
    isLoading,
    currentContext,
    activeConversation,
    conversations,
    isLoadingConversation,
    startNewConversation,
    switchConversation,
    deleteConversation,
  } = useCopilot()

  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFabHovered, setIsFabHovered] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isWaving, setIsWaving] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [nudgeMessage, setNudgeMessage] = useState('')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [contextCopied, setContextCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Proactive idle nudge — wave and offer help after 25s idle
  useEffect(() => {
    if (isOpen || nudgeDismissed) return

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      setShowNudge(false)
      setIsWaving(false)

      idleTimerRef.current = setTimeout(() => {
        setNudgeMessage(getRandomNudgeMessage(currentContext))
        setIsWaving(true)
        setTimeout(() => {
          setShowNudge(true)
        }, 800)
      }, 25000) // 25 seconds idle
    }

    resetTimer()
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [isOpen, nudgeDismissed, currentContext])

  // Reset nudge dismissed state when context changes (new page)
  useEffect(() => {
    setNudgeDismissed(false)
    setShowNudge(false)
    setIsWaving(false)
  }, [currentContext])

  // Elapsed timer while loading
  useEffect(() => {
    if (!isLoading) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isLoading])

  // Scroll to bottom on new messages, loading state, or when panel opens with history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) {
      // Scroll to last message when opening (handles conversation load)
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        inputRef.current?.focus()
      }, 200)
    }
  }, [isOpen, isLoadingConversation])

  useEffect(() => {
    if (!isOpen) setShowHistory(false)
  }, [isOpen])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 104) + 'px'
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleNewConversation = () => {
    startNewConversation()
    setShowHistory(false)
  }

  const handleSwitchConversation = (id: string) => {
    switchConversation(id)
    setShowHistory(false)
  }

  const handleCopyContext = useCallback(async () => {
    const contextSnapshot = [
      `Context: ${currentContext}`,
      activeConversation?.title ? `Conversation: ${activeConversation.title}` : null,
      `Timestamp: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n')

    await navigator.clipboard.writeText(contextSnapshot)
    setContextCopied(true)
    window.setTimeout(() => setContextCopied(false), 1600)
  }, [activeConversation?.title, currentContext])

  const suggestions = getSuggestions(currentContext)
  const contextLabel = currentContext.replace(/-/g, ' ')

  // Hide copilot on public/unauthenticated pages
  if ((HIDDEN_CONTEXTS as readonly string[]).includes(currentContext)) return null

  return (
    <LazyMotion features={domAnimation}>
      {/* ── Floating Action Button ── */}
      <AnimatePresence>
        {!isOpen && (
          <m.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={spring}
            className="copilot-fab-container fixed bottom-5 right-5 z-[9999]"
            onMouseEnter={() => setIsFabHovered(true)}
            onMouseLeave={() => setIsFabHovered(false)}
          >
            {/* Nudge speech bubble */}
            <AnimatePresence>
              {showNudge && !isFabHovered && (
                <m.div
                  initial={{ opacity: 0, x: 10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="absolute bottom-14 right-0 whitespace-nowrap"
                >
                  <button
                    onClick={() => {
                      setNudgeDismissed(true)
                      setShowNudge(false)
                      setIsWaving(false)
                      setIsOpen(true)
                    }}
                    className="smoky-glass-pane copilot-surface group relative rounded-2xl px-3.5 py-2 text-[12px] text-black/55 shadow-[0_18px_40px_rgba(24,24,24,0.10)] dark:text-white/72 dark:shadow-[0_24px_44px_rgba(0,0,0,0.34)] hover:text-black/90 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="font-medium">{nudgeMessage}</span>
                    {/* Tail */}
                    <div className="absolute -bottom-[5px] right-5 h-2.5 w-2.5 rotate-45 border-b border-r border-black/[0.06] bg-white/80 backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.08]" />
                  </button>
                  <button
                    onClick={() => {
                      setNudgeDismissed(true)
                      setShowNudge(false)
                      setIsWaving(false)
                    }}
                    className="smoky-glass-chip copilot-chip absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/15 dark:hover:bg-white/15"
                  >
                    <X className="h-2.5 w-2.5 text-black/40 dark:text-white/40" />
                  </button>
                </m.div>
              )}
            </AnimatePresence>

            <Tooltip>
              <TooltipTrigger asChild>
                <m.button
                  onClick={() => {
                    setIsOpen(true)
                    setNudgeDismissed(true)
                    setShowNudge(false)
                    setIsWaving(false)
                  }}
                  className="smoky-glass-panel copilot-shell copilot-fab group relative flex h-[60px] w-[60px] items-center justify-center rounded-[14px] transition-all duration-200 hover:scale-[1.035] active:scale-95"
                  animate={
                    isWaving
                      ? {
                          rotate: [0, -12, 14, -8, 10, -4, 0],
                          scale: [1, 1.08, 1.05, 1.08, 1.05, 1.02, 1],
                        }
                      : {}
                  }
                  transition={
                    isWaving
                      ? {
                          duration: 1.2,
                          ease: 'easeInOut',
                          repeat: Infinity,
                          repeatDelay: 2,
                        }
                      : {}
                  }
                >
                  <div className="absolute inset-0 rounded-[14px] bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(230,234,238,0.76))] transition-all duration-200 group-hover:shadow-[0_18px_38px_rgba(24,24,24,0.14)] dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))] dark:group-hover:shadow-[0_22px_44px_rgba(0,0,0,0.38)]" />
                  <div className="smoky-glass-pane copilot-surface relative z-10 flex h-[48px] w-[48px] items-center justify-center rounded-[12px] border-black/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <CopilotCharacter
                      size={42}
                      className="text-[#1f201f] dark:text-white transition-transform duration-200 group-hover:scale-110"
                      interactive
                      animate={isWaving}
                    />
                  </div>
                  {!isFabHovered && !isWaving && (
                    <div
                      className="absolute inset-0 rounded-[16px] animate-ping bg-black/10 dark:bg-white/10 pointer-events-none"
                      style={{ animationDuration: '4s' }}
                    />
                  )}
                  {isWaving && (
                    <m.div
                      className="absolute inset-0 rounded-[16px] bg-black/15 dark:bg-white/15 pointer-events-none"
                      animate={{ scale: [1, 1.5, 1.8], opacity: [0.4, 0.15, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </m.button>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className="smoky-glass-panel copilot-shell rounded-[10px] border-0 px-3 py-1.5 text-black/80 dark:text-white"
              >
                <div className="flex items-center gap-2 text-xs font-medium tracking-[-0.01em]">
                  <span>Copilot</span>
                  <kbd className="px-1 py-0.5 rounded bg-white/15 dark:bg-black/10 text-[10px] font-mono">
                    ⌘K
                  </kbd>
                </div>
              </TooltipContent>
            </Tooltip>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: easeOut }}
            data-expanded={isExpanded}
            className={`copilot-terminal-panel fixed z-[9999] ${
              isExpanded
                ? 'bottom-4 right-4 h-[680px] w-[620px]'
                : 'bottom-5 right-5 h-[580px] w-[430px]'
            } flex flex-col overflow-hidden`}
            style={PANEL_FONT_STYLE}
          >
            {/* ── Header ── */}
            <div className="copilot-terminal-header flex h-[52px] flex-shrink-0 items-center justify-between border-b px-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="copilot-terminal-avatar flex h-9 w-9 flex-shrink-0 items-center justify-center border border-white/10 bg-black/80">
                  <CopilotCharacter size={27} className="text-[#f1f7f1]" />
                </div>
                <div className="min-w-0">
                  <div className="copilot-terminal-log-label text-[11px] leading-none">
                    NOWFLOW COPILOT
                  </div>
                  <div className="copilot-terminal-kicker mt-1 truncate text-[10px] leading-none">
                    {activeConversation?.title ?? contextLabel}
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowHistory(!showHistory)}
                      className={`copilot-terminal-icon-button h-7 w-7 transition-colors ${
                        showHistory ? 'border-lime-300/35 text-lime-200' : 'text-white/55'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    History
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNewConversation}
                      className="copilot-terminal-icon-button h-7 w-7 text-white/55"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    New chat
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="copilot-terminal-icon-button h-7 w-7 text-white/55"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="copilot-terminal-icon-button h-7 w-7 text-white/55"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="relative flex-1 overflow-hidden">
              {/* History Panel */}
              <AnimatePresence>
                {showHistory && (
                  <m.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    className="copilot-terminal-history absolute inset-0 z-10 flex flex-col border-l border-white/8"
                  >
                    <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                      <button
                        onClick={() => setShowHistory(false)}
                        className="copilot-terminal-kicker flex items-center gap-1 text-[10px] text-white/48 transition-colors hover:text-white/82"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back
                      </button>
                      <span className="copilot-terminal-log-label text-[10px] text-white/74">
                        Conversations
                      </span>
                      <button
                        onClick={handleNewConversation}
                        className="copilot-terminal-kicker text-[10px] text-white/82 transition-opacity hover:opacity-70"
                      >
                        + New
                      </button>
                    </div>

                    <div className={`flex-1 overflow-y-auto py-1.5 ${HISTORY_SCROLLBAR_CLASSES}`}>
                      {conversations.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                          <MessageSquare className="mb-3 h-8 w-8 text-white/12" />
                          <p className="copilot-terminal-kicker text-[10px] text-white/36">
                            No conversations yet
                          </p>
                        </div>
                      ) : (
                        conversations.map((conv, i) => {
                          const isActive = conv.id === activeConversation?.id
                          return (
                            <m.div
                              key={conv.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.2 }}
                              onClick={() => handleSwitchConversation(conv.id)}
                              className="copilot-terminal-history-item group mx-2 flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:border-white/18"
                              data-active={isActive}
                            >
                              <div
                                className={`h-7 w-[3px] flex-shrink-0 transition-colors ${
                                  isActive ? 'bg-lime-300' : 'bg-transparent'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`truncate text-[12px] leading-tight ${
                                    isActive ? 'text-white' : 'text-white/54'
                                  }`}
                                >
                                  {conv.title || 'Untitled'}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="copilot-terminal-kicker text-[9px] tabular-nums text-white/34">
                                    {formatRelativeTime(conv.updatedAt)}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteConversation(conv.id)
                                }}
                                className="flex-shrink-0 p-1 text-white/20 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </m.div>
                          )
                        })
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {/* Messages Area */}
              <div
                className={`copilot-terminal-body h-full overflow-y-auto px-4 py-4 scroll-smooth ${SCROLLBAR_CLASSES}`}
              >
                {/* Loading */}
                {isLoadingConversation && (
                  <div className="flex h-full flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 animate-spin border-2 border-white/12 border-t-lime-300" />
                    <p className="copilot-terminal-kicker text-[10px] text-white/44">
                      Loading conversation...
                    </p>
                  </div>
                )}

                {/* Empty state */}
                {!isLoadingConversation && messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                    <m.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.05, ...springGentle }}
                      className="mb-4 w-full max-w-[340px]"
                    >
                      <div className="copilot-terminal-empty space-y-3 p-4 text-left">
                        <div className="copilot-terminal-log-label text-[11px]">
                          [SYSTEM] COPILOT READY
                        </div>
                        <div className="space-y-2 text-[12px] leading-[1.65] text-white/68">
                          <p>
                            Copilot is online for workflow building, debugging, analysis, and
                            deployment help.
                          </p>
                          <p className="copilot-terminal-kicker text-[10px] text-white/40">
                            Ask for block edits, failure diagnosis, deployment guidance, or
                            workspace navigation.
                          </p>
                        </div>
                      </div>
                    </m.div>

                    <div className="w-full max-w-[340px] space-y-1.5">
                      {suggestions.map((suggestion, i) => (
                        <m.button
                          key={i}
                          initial={{ y: 6, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.16 + i * 0.05 }}
                          onClick={() => sendMessage(suggestion)}
                          className="copilot-terminal-empty group flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:border-lime-300/25 hover:text-white"
                        >
                          <span className="line-clamp-1 text-[12px] leading-[1.6] text-white/62">
                            {suggestion}
                          </span>
                          <ArrowRight className="ml-2 h-3 w-3 flex-shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </m.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {!isLoadingConversation && messages.length > 0 && (
                  <div className="space-y-3 pb-8">
                    {messages.map((message, idx) => {
                      const isUser = message.role === 'user'
                      const isLast = idx === messages.length - 1
                      const isLastAssistant = !isUser && isLast && !isLoading
                      const roleLabel =
                        message.role === 'system'
                          ? 'SYSTEM'
                          : message.role === 'assistant'
                            ? 'ASSISTANT'
                            : 'USER'

                      return (
                        <m.div
                          key={message.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className={isUser ? 'ml-auto max-w-[88%]' : 'w-full'}
                        >
                          <div className="min-w-0">
                            <div className="copilot-terminal-log-label mb-1 flex items-center gap-2 text-[10px] leading-none">
                              <span>[{formatTerminalStamp(message.timestamp)}]</span>
                              <span>{roleLabel}:</span>
                            </div>
                            {/* Only render text bubble if there's actual content */}
                            {(isUser || message.content.trim()) && (
                              <div
                                className={`copilot-terminal-message-box px-3 py-2.5 text-[12.5px] leading-[1.65] ${
                                  isUser
                                    ? 'copilot-terminal-message-box--user text-white/88'
                                    : 'copilot-terminal-message-box--assistant text-white/76'
                                }`}
                              >
                                {isUser ? (
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                ) : (
                                  <MarkdownContent content={message.content} />
                                )}
                              </div>
                            )}

                            {/* Action summary pills */}
                            {!isUser && message.actionSummary && (
                              <ActionSummaryCard summary={message.actionSummary} />
                            )}

                            {/* Message actions for assistant messages */}
                            {isLastAssistant && <MessageActions content={message.content} />}

                            {/* Timestamp for non-last messages */}
                            {!isLast && message.timestamp && (
                              <p
                                className={`copilot-terminal-kicker mt-1 text-[9px] tabular-nums text-white/24 ${
                                  isUser ? 'text-right' : ''
                                }`}
                              >
                                {formatTime(message.timestamp)}
                              </p>
                            )}
                          </div>
                        </m.div>
                      )
                    })}
                  </div>
                )}

                {/* Thinking indicator */}
                {isLoading && (
                  <ThinkingIndicator currentContext={currentContext} elapsed={elapsed} />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ── Input Area ── */}
            <div className="copilot-terminal-footer relative flex-shrink-0 px-3 pb-3 pt-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="copilot-terminal-status flex items-center gap-2 text-[10px] text-white/58">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
                  <span>Workspace assistant online</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyContext}
                    className="copilot-terminal-secondary-button flex items-center gap-1.5 px-2.5 py-1 text-[10px]"
                  >
                    {contextCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span className="copilot-terminal-meta text-[10px] text-white/78">
                      {contextCopied ? 'Context Copied' : 'Copy Context'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="copilot-terminal-secondary-button px-2.5 py-1"
                  >
                    <span className="copilot-terminal-meta text-[10px] text-white/78">
                      {showHistory ? 'Hide History' : 'Show History'}
                    </span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="copilot-terminal-input-shell flex-1">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter command"
                    rows={1}
                    disabled={isLoadingConversation}
                    className="copilot-terminal-input block min-h-[38px] max-h-[104px] w-full resize-none px-3 py-2 text-[13px] leading-[1.5] disabled:opacity-50"
                    style={{ minHeight: '38px' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="copilot-terminal-send flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <Send className="h-4 w-4" />
                </button>
                <div
                  className="copilot-terminal-status-button flex h-[38px] min-w-[96px] items-center justify-center px-2.5"
                  data-state={isLoading ? 'busy' : 'ready'}
                >
                  <span className="copilot-terminal-meta text-[10px]">
                    {isLoading ? 'Waiting' : 'Ready'}
                  </span>
                </div>
              </form>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
