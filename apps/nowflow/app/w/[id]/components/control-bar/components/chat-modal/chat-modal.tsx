'use client'

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createLogger } from '@/lib/logs/console-logger'
import { useExecutionStore } from '@/stores/execution/store'
import { useChatStore } from '@/stores/panel/chat/store'
import { ChatMessage as ChatMessageType } from '@/stores/panel/chat/types'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { OutputSelect } from '@/app/w/[id]/components/panel/components/chat/components/output-select/output-select'
import { JSONView } from '@/app/w/[id]/components/panel/components/console/components/json-view/json-view'
import { useWorkflowExecution } from '@/app/w/[id]/hooks/use-workflow-execution'

const logger = createLogger('ChatModal')

interface ChatMessageProps {
  message: ChatMessageType
}

// ChatGPT-style message component
function ModalChatMessage({ message }: ChatMessageProps) {
  // Check if content is a JSON object
  const isJsonObject = useMemo(() => {
    return typeof message.content === 'object' && message.content !== null
  }, [message.content])

  // For user messages (on the right)
  if (message.type === 'user') {
    return (
      <div className="workflow-editor-chat-message workflow-editor-chat-message--user py-3 px-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-end">
            <div className="workflow-editor-chat-bubble workflow-editor-chat-bubble--user max-w-[80%] rounded-md border border-primary bg-primary px-3 py-2 text-primary-foreground">
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {isJsonObject ? (
                  <JSONView data={message.content} initiallyExpanded={false} />
                ) : (
                  <span>{message.content}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // For assistant messages (on the left)
  return (
    <div className="workflow-editor-chat-message workflow-editor-chat-message--assistant py-3 px-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex">
          <div className="workflow-editor-chat-bubble workflow-editor-chat-bubble--assistant max-w-[80%] rounded-md border border-border bg-muted px-3 py-2">
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {isJsonObject ? (
                <JSONView data={message.content} initiallyExpanded={false} />
              ) : (
                <span>{message.content}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatModal({ open, onOpenChange }: ChatModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { activeWorkflowId } = useWorkflowRegistry()
  const {
    messages,
    addMessage,
    selectedWorkflowOutputs,
    setSelectedWorkflowOutput,
    appendMessageContent,
    finalizeMessageStream,
  } = useChatStore()
  const [chatMessage, setChatMessage] = useState('')

  // Use the execution store state to track if a workflow is executing
  const { isExecuting, setIsExecuting } = useExecutionStore()

  // Get workflow execution functionality
  const { handleRunWorkflow } = useWorkflowExecution()

  // Get selected workflow outputs
  const selectedOutputs = useMemo(() => {
    if (!activeWorkflowId) return []
    const selected = selectedWorkflowOutputs[activeWorkflowId]
    if (!selected || selected.length === 0) {
      return []
    }
    return [...new Set(selected)]
  }, [selectedWorkflowOutputs, activeWorkflowId])

  // Handle output selection
  const handleOutputSelection = (values: string[]) => {
    const dedupedValues = [...new Set(values)]
    if (activeWorkflowId) {
      setSelectedWorkflowOutput(activeWorkflowId, dedupedValues)
    }
  }

  // Get filtered messages for current workflow
  const workflowMessages = useMemo(() => {
    if (!activeWorkflowId) return []
    return messages
      .filter((msg) => msg.workflowId === activeWorkflowId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [messages, activeWorkflowId])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [workflowMessages])

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Handle send message
  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !activeWorkflowId || isExecuting) return

    // Store the message being sent for reference
    const sentMessage = chatMessage.trim()

    // Add user message
    addMessage({
      content: sentMessage,
      workflowId: activeWorkflowId,
      type: 'user',
    })

    // Clear input
    setChatMessage('')

    // Ensure input stays focused
    if (inputRef.current) {
      inputRef.current.focus()
    }

    // Execute the workflow to generate a response
    const result = await handleRunWorkflow({ input: sentMessage })

    // Check if we got a streaming response
    if (result && 'stream' in result && result.stream instanceof ReadableStream) {
      // Generate a unique ID for the message
      const messageId = crypto.randomUUID()

      // Create a content buffer to collect initial content
      let initialContent = ''
      let hasAddedMessage = false

      try {
        // Process the stream
        const reader = result.stream.getReader()
        const decoder = new TextDecoder()

        logger.debug('Starting to read from stream')

        while (true) {
          try {
            const { done, value } = await reader.read()
            if (done) {
              logger.debug('Stream complete')
              break
            }

            // Decode and append chunk
            const chunk = decoder.decode(value, { stream: true })

            if (chunk) {
              initialContent += chunk

              // Only add the message to UI once we have some actual content to show
              if (!hasAddedMessage && initialContent.trim().length > 0) {
                addMessage({
                  content: initialContent,
                  workflowId: activeWorkflowId,
                  type: 'workflow',
                  isStreaming: true,
                  id: messageId,
                } as any)
                hasAddedMessage = true
              } else if (hasAddedMessage) {
                // Append to existing message
                appendMessageContent(messageId, chunk)
              }
            }
          } catch (streamError) {
            logger.error('Error reading from stream:', streamError)
            break
          }
        }

        // If we never added a message (no content received), add it now
        if (!hasAddedMessage && initialContent.trim().length > 0) {
          addMessage({
            content: initialContent,
            workflowId: activeWorkflowId,
            type: 'workflow',
            id: messageId,
          } as any)
        }
      } catch (error) {
        logger.error('Error processing stream:', error)

        // If there's an error and we haven't added a message yet, add an error message
        if (!hasAddedMessage) {
          addMessage({
            content: 'Error: Failed to process the response.',
            workflowId: activeWorkflowId,
            type: 'workflow',
            id: messageId,
          } as any)
        } else {
          appendMessageContent(messageId, '\n\nError: Failed to process the response.')
        }
      } finally {
        logger.debug('Finalizing stream')
        if (hasAddedMessage) {
          finalizeMessageStream(messageId)
        }
        setIsExecuting(false)
      }
    }

    // Ensure input stays focused even after response
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle key press
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        placement="anchored"
        hideCloseButton
        hideOverlay
        className="workflow-editor-chat-modal flex h-[600px] max-h-[calc(100dvh-6rem)] w-[420px] max-w-[calc(100vw-3rem)] flex-col gap-0 overflow-hidden rounded-lg p-0"
        // Anchored to the top-right corner, just under the workflow control
        // bar, so it reads as a panel that belongs to the "Open Chat"
        // button rather than a blocking centered modal.
        style={{
          position: 'fixed',
          top: '5rem',
          right: '1.5rem',
          left: 'auto',
          bottom: 'auto',
          transform: 'none',
          margin: 0,
        }}
        // Dropdowns inside the dialog portal their content into the body,
        // so clicking a DropdownMenuItem triggers Radix's outside-click
        // detection and would otherwise auto-close this dialog. Allow
        // those portal clicks through untouched; the explicit Close
        // button + ESC still dismiss the dialog cleanly.
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault()
          }
        }}
      >
        {/* Header */}
        <div className="workflow-editor-chat-header flex items-center justify-between border-b border-border px-4 py-3">
          <DialogTitle className="workflow-editor-chat-title text-[15px] font-semibold text-foreground">
            Chat
          </DialogTitle>
          <DialogDescription className="sr-only">
            Conversational interface for the active workflow
          </DialogDescription>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Output Source Selector */}
        <div className="workflow-editor-chat-toolbar flex-none border-b border-border px-4 py-3">
          <div className="space-y-2">
            <div className="workflow-editor-chat-toolbar-label flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span>Output Sources</span>
            </div>
            <OutputSelect
              workflowId={activeWorkflowId}
              selectedOutputs={selectedOutputs}
              onOutputSelect={handleOutputSelection}
              disabled={!activeWorkflowId}
              placeholder="Select output sources"
            />
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="workflow-editor-chat-body flex-1 overflow-y-auto"
        >
          <div className="px-3 py-2">
            {workflowMessages.length === 0 ? (
              <div className="workflow-editor-chat-empty flex flex-col items-center justify-center py-8 px-4">
                <div className="workflow-editor-chat-empty-card space-y-3 rounded-lg border border-border bg-card p-6 text-center">
                  <h3 className="text-base font-medium text-foreground">
                    How can I help you today?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Send a message to interact with your workflow
                  </p>
                  {selectedOutputs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Select an output source above to see responses
                    </p>
                  )}
                </div>
              </div>
            ) : (
              workflowMessages.map((message) => (
                <ModalChatMessage key={message.id} message={message} />
              ))
            )}

            {/* Loading indicator */}
            {isExecuting && (
              <div className="workflow-editor-chat-message workflow-editor-chat-message--assistant py-3 px-3">
                <div className="flex">
                  <div className="max-w-[80%]">
                    <div className="workflow-editor-chat-loading flex h-7 items-center rounded-md border border-border bg-muted px-2.5">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground loading-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        {/* Input */}
        <div className="workflow-editor-chat-input-area border-t border-border p-3">
          <div className="workflow-editor-chat-input-shell relative rounded-md border border-border bg-background">
            <Input
              ref={inputRef}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Message..."
              className="min-h-[40px] flex-1 rounded-md border-0 bg-transparent py-3 pl-4 pr-12 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={!activeWorkflowId}
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              disabled={!chatMessage.trim() || !activeWorkflowId || isExecuting}
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md p-0"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="workflow-editor-chat-caption mt-2 text-center text-xs text-muted-foreground">
            <p>
              {activeWorkflowId
                ? 'Your messages will be processed by the active workflow'
                : 'Select a workflow to start chatting'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
