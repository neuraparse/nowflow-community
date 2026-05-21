'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type {
  CopilotContextType,
  CopilotConversation,
  CopilotMessage,
  WorkflowContext,
} from './copilot-types'
import { buildActionSummary, getContextFromPath, HIDDEN_CONTEXTS } from './copilot-utils'
import { handleWorkflowActions } from './copilot-workflow-actions'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CopilotContext = createContext<CopilotContextType | null>(null)

export function useCopilot() {
  const context = useContext(CopilotContext)
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider')
  }
  return context
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workflowContext, setWorkflowContext] = useState<WorkflowContext | null>(null)
  const [activeConversation, setActiveConversation] = useState<CopilotConversation | null>(null)
  const [conversations, setConversations] = useState<CopilotConversation[]>([])
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const pathname = usePathname()
  const abortControllerRef = useRef<AbortController | null>(null)
  const resolveAbortRef = useRef<AbortController | null>(null)
  const lastResolvedScopeRef = useRef<string>('')
  // Keep the latest messages array in a ref so `sendMessage` can read the
  // history without listing `messages` as a dependency. Without this, every
  // streamed token re-creates sendMessage → every consumer of useCopilot()
  // rebuilds its callbacks (Copilot ask/fix handlers, nudges, etc.).
  const messagesRef = useRef<CopilotMessage[]>([])

  const currentContext = getContextFromPath(pathname)

  // Extract workflow ID from pathname for workflow-editor context
  const workflowIdFromPath =
    currentContext === 'workflow-editor' ? pathname.match(/^\/w\/([^/]+)$/)?.[1] || null : null

  // Get workspace ID from registry store (safe lazy access)
  const getWorkspaceId = useCallback((): string | null => {
    try {
      const { useWorkflowRegistry } = require('@/stores/workflows/registry/store')
      return useWorkflowRegistry.getState().activeWorkspaceId || null
    } catch {
      return null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Persist a single message to the DB (fire-and-forget)
  // ---------------------------------------------------------------------------
  const persistMessage = useCallback(
    (conversationId: string, role: string, content: string, ctx?: string, metadata?: any) => {
      fetch(`/api/ai/copilot/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content: content || '', context: ctx, metadata }),
      }).catch((err) => console.error('[Copilot] Failed to persist message:', err))
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Map DB message rows → CopilotMessage (with actionSummary reconstruction)
  // ---------------------------------------------------------------------------
  const mapDbMessages = useCallback(
    (dbMessages: any[]): CopilotMessage[] =>
      dbMessages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content || '',
        timestamp: new Date(m.createdAt),
        context: m.context,
        actionSummary:
          m.metadata?.actions && Array.isArray(m.metadata.actions)
            ? buildActionSummary(m.metadata.actions)
            : undefined,
      })),
    []
  )

  // ---------------------------------------------------------------------------
  // Fetch conversation list for the dropdown
  // ---------------------------------------------------------------------------
  const fetchConversationList = useCallback(
    async (workspaceId: string | null) => {
      try {
        const params = new URLSearchParams()
        if (workspaceId) params.set('workspaceId', workspaceId)
        // Filter by current context so each page only shows its own conversations
        if (currentContext) params.set('context', currentContext)
        // For workflow-editor, also filter by workflowId so each workflow has its own history
        if (workflowIdFromPath) params.set('workflowId', workflowIdFromPath)
        params.set('limit', '20')

        const res = await fetch(`/api/ai/copilot/conversations?${params}`)
        if (res.ok) {
          const { data } = await res.json()
          setConversations(data || [])
        }
      } catch {
        // Non-blocking
      }
    },
    [currentContext, workflowIdFromPath]
  )

  // ---------------------------------------------------------------------------
  // Resolve (find or create) conversation for current scope
  // ---------------------------------------------------------------------------
  const resolveConversation = useCallback(
    async (force = false) => {
      const workspaceId = getWorkspaceId()
      const scopeKey = `${workspaceId}|${currentContext}|${workflowIdFromPath}`

      // Skip if already resolved for this scope (unless forced)
      if (!force && scopeKey === lastResolvedScopeRef.current) return

      // Abort any in-flight resolve
      if (resolveAbortRef.current) resolveAbortRef.current.abort()
      resolveAbortRef.current = new AbortController()

      setIsLoadingConversation(true)
      try {
        const res = await fetch('/api/ai/copilot/conversations/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            context: currentContext,
            workflowId: workflowIdFromPath,
          }),
          signal: resolveAbortRef.current.signal,
        })

        if (!res.ok) throw new Error('Failed to resolve conversation')

        const { data } = await res.json()
        setActiveConversation(data.conversation)
        setMessages(mapDbMessages(data.messages || []))
        lastResolvedScopeRef.current = scopeKey

        // Also fetch recent conversations for the dropdown
        fetchConversationList(workspaceId)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[Copilot] Failed to resolve conversation:', err)
        }
      } finally {
        setIsLoadingConversation(false)
      }
    },
    [currentContext, workflowIdFromPath, getWorkspaceId, fetchConversationList, mapDbMessages]
  )

  // ---------------------------------------------------------------------------
  // Auto-resolve conversation when copilot opens or context changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      resolveConversation()
    }
  }, [isOpen, currentContext, workflowIdFromPath, resolveConversation])

  // Keep messagesRef in sync with the live `messages` array so sendMessage
  // can read the latest history without subscribing to it.
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
        context: currentContext,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      // Persist user message
      if (activeConversation) {
        persistMessage(activeConversation.id, 'user', content, currentContext)
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const hasWorkflow = workflowContext && currentContext === 'workflow-editor'

        const response = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            context: currentContext,
            history: messagesRef.current.slice(-20).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: !hasWorkflow,
            ...(hasWorkflow ? { workflowState: workflowContext } : {}),
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to get copilot response')
        }

        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('text/event-stream') && response.body) {
          // Streaming response
          const assistantMessageId = crypto.randomUUID()
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              context: currentContext,
            },
          ])

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let fullContent = ''
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed === 'data: [DONE]') break
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6))
                  if (parsed.content) {
                    fullContent += parsed.content
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId ? { ...m, content: fullContent } : m
                      )
                    )
                  }
                  if (parsed.error) {
                    fullContent += `\n\n*Error: ${parsed.error}*`
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId ? { ...m, content: fullContent } : m
                      )
                    )
                  }
                } catch {
                  // skip malformed SSE lines
                }
              }
            }
          }

          // Persist assistant streaming response
          if (activeConversation) {
            persistMessage(activeConversation.id, 'assistant', fullContent, currentContext)
          }
        } else {
          // JSON response (non-streaming or workflow tool calls)
          const data = await response.json()

          const fullContent = data.response || ''
          const actionSummary =
            data.actions && data.actions.length > 0 ? buildActionSummary(data.actions) : undefined

          const assistantMessage: CopilotMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
            context: currentContext,
            actionSummary,
          }

          setMessages((prev) => [...prev, assistantMessage])

          // Persist assistant response with action metadata
          if (activeConversation) {
            persistMessage(activeConversation.id, 'assistant', fullContent, currentContext, {
              actions: data.actions || undefined,
            })
          }

          // Handle workflow actions if present
          if (data.actions && data.actions.length > 0 && workflowContext) {
            handleWorkflowActions(data.actions)
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          const errorMessage: CopilotMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [currentContext, workflowContext, activeConversation, persistMessage]
  )

  // ---------------------------------------------------------------------------
  // Start new conversation
  // ---------------------------------------------------------------------------
  const startNewConversation = useCallback(async () => {
    const workspaceId = getWorkspaceId()
    try {
      const res = await fetch('/api/ai/copilot/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          context: currentContext,
          workflowId: workflowIdFromPath,
        }),
      })

      if (!res.ok) throw new Error('Failed to create conversation')

      const { data } = await res.json()
      setActiveConversation(data)
      setMessages([])
      lastResolvedScopeRef.current = `${workspaceId}|${currentContext}|${workflowIdFromPath}`

      // Refresh the list
      fetchConversationList(workspaceId)
    } catch (err) {
      console.error('[Copilot] Failed to create new conversation:', err)
    }
  }, [currentContext, workflowIdFromPath, getWorkspaceId, fetchConversationList])

  // ---------------------------------------------------------------------------
  // Switch to an existing conversation
  // ---------------------------------------------------------------------------
  const switchConversation = useCallback(
    async (id: string) => {
      if (id === activeConversation?.id) return

      setIsLoadingConversation(true)
      try {
        const res = await fetch(`/api/ai/copilot/conversations/${id}`)
        if (!res.ok) throw new Error('Failed to load conversation')

        const { data } = await res.json()
        setActiveConversation(data.conversation)
        setMessages(mapDbMessages(data.messages || []))
      } catch (err) {
        console.error('[Copilot] Failed to switch conversation:', err)
      } finally {
        setIsLoadingConversation(false)
      }
    },
    [activeConversation, mapDbMessages]
  )

  // ---------------------------------------------------------------------------
  // Delete a conversation
  // ---------------------------------------------------------------------------
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/ai/copilot/conversations/${id}`, { method: 'DELETE' })

        setConversations((prev) => prev.filter((c) => c.id !== id))

        // If we deleted the active conversation, resolve a new one
        if (activeConversation?.id === id) {
          lastResolvedScopeRef.current = '' // Force re-resolve
          await resolveConversation(true)
        }
      } catch (err) {
        console.error('[Copilot] Failed to delete conversation:', err)
      }
    },
    [activeConversation, resolveConversation]
  )

  // Alias: clearMessages now starts a new conversation
  const clearMessages = useCallback(() => {
    startNewConversation()
  }, [startNewConversation])

  // Keyboard shortcut: Cmd/Ctrl+K to toggle copilot (disabled on public pages)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if ((HIDDEN_CONTEXTS as readonly string[]).includes(currentContext)) return
        const target = e.target as HTMLElement
        const tag = target?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea' && !target?.isContentEditable) {
          e.preventDefault()
          setIsOpen((prev) => !prev)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentContext])

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        messages,
        sendMessage,
        isLoading,
        currentContext,
        clearMessages,
        setWorkflowContext,
        activeConversation,
        conversations,
        isLoadingConversation,
        startNewConversation,
        switchConversation,
        deleteConversation,
      }}
    >
      {children}
    </CopilotContext.Provider>
  )
}
